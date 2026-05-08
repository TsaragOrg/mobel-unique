# PLAN-0039 Public Simulation DB Foundation, Cost Meter, And Test Catalog Seed

Plan: PLAN-0039
Spec: SPEC-0015
Status: active
Owner area: supabase
Affected packages:

- `supabase/migrations`
- `supabase/functions/in-home-simulation-worker/lib/cost-meter.ts` (new)
- `supabase/functions/in-home-simulation-worker/index.ts`
- `supabase/functions/in-home-simulation-purge/index.ts`
- `scripts/seed-simulation-test-data.mjs` (new)
- `scripts/seed-simulation-test-data.test.mjs` (new)
- `package.json` (new `seed:simulation-test` script)
- `scripts/seed-local-admin-fixtures.mjs`
- `scripts/seed-local-admin-fixtures.test.mjs`
- `fixtures/local-admin-catalog`
- `docs/local-supabase-worker-development.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Goal

Provision the persistence layer SPEC-0015 needs (`idempotency_keys`,
`simulation_rate_limits`, `simulation_cost_meter`), wire the daily OpenAI
cost cap into the existing job-claim RPCs and the worker, extend the purge
function to cover the new tables, and add a deterministic test catalog seed
script with one straight `back_wall` sofa and one corner-tagged sofa so the
upcoming API and UI plans have something to exercise end-to-end.

The worker code change is limited to a new fixed-cost increment hook that
runs after each paid OpenAI call. This hook adds telemetry; it does not
touch prompts, providers, or the validated v003 pipeline.

## Tasks

### Database migrations

- [x] Add a Vitest assertion that asserts `simulation_idempotency_keys`
      exists with the expected columns, primary key, and an
      `expires_at` index.
- [x] Add migration creating `simulation_idempotency_keys`
      (`key_hash text primary key`, `simulation_job_id uuid references in_home_simulation_jobs`,
      `created_at timestamptz default now()`,
      `expires_at timestamptz default now() + interval '24 hours'`)
      with RLS denying anon read/write and a service-role policy for the API.
- [x] Add Vitest assertion for `simulation_rate_limits` (composite PK
      on `(subject_kind, subject_value_hash, window_start)`, count
      column, `subject_kind in ('ip','email')` check, index on
      `window_start` for the cleanup sweep).
- [x] Add migration creating `simulation_rate_limits` with the
      columns above and matching RLS.
- [x] Add Vitest assertion for `simulation_cost_meter` (one row per
      `cost_date`, `usd_cost_estimate_cents` cents counter,
      `worker_paused boolean default false`).
- [x] Add migration creating `simulation_cost_meter` with RLS.
- [x] Add Vitest assertion that all three claim RPCs
      (`claim_in_home_simulation_room_prep_job`,
      `claim_specific_in_home_simulation_room_prep_job`,
      `claim_specific_in_home_simulation_placement_job`) call
      `public.simulation_cost_meter_paused()` and return early when
      it returns true.
- [x] Update the three claim RPCs to short-circuit on paused meter
      via the new `simulation_cost_meter_paused()` helper.
- [x] Add Vitest assertion that the purge function deletes
      `simulation_idempotency_keys` rows alongside the existing
      per-job artifact clearing.
- [x] Update the purge function to clean
      `simulation_idempotency_keys` for the purged job and ship
      `cleanup_simulation_idempotency_keys()` plus
      `cleanup_simulation_rate_limit_windows()` helpers for stale
      records.

### Worker cost meter hook

- [x] Add unit test for `lib/cost-meter.ts` covering: the
      `PROVIDER_ROLE_CHARGE_CENTS` table, `parseDailyCapCents`
      defaults / valid / invalid paths, the `chargeForRole` happy
      path that returns the meter row, the swallow-and-log path
      when the client throws, and the Supabase RPC client building
      the right URL, headers, and payload.
- [x] Implement `lib/cost-meter.ts` with `chargeForRole(client, role, capCents)`
      and `makeSupabaseCostMeterClient` factories. Provider role
      costs use a fixed table: `validation: 1`, `cleaning: 4`,
      `corners: 4`, `placement: 4`, `placement_measurement: 1`
      cents. The accompanying SQL migration
      `20260502000700_simulation_cost_meter_record_charge.sql`
      adds the `simulation_cost_meter_record_charge(charge_cents,
cap_cents)` RPC the helper invokes.
- [x] Wire `chargeMeter(role)` into the worker dispatch path
      after each successful validation, cleaning, corners, and
      placement provider call. Telemetry failures are swallowed
      and logged with `console.warn`; they never break dispatch.
- [x] Add `SIMULATION_DAILY_COST_CAP_USD` (default 50, parsed by
      `parseDailyCapCents`) handling to both Stage 1 and Stage 2
      dispatch paths. The cap value is forwarded to the cost
      meter client, which the SQL function compares against the
      running total to flip `worker_paused`.
- [x] Add migration
      `20260508000100_fix_simulation_cost_meter_record_charge_ambiguity.sql`
      after local live-worker testing surfaced Postgres 42702 on
      `simulation_cost_meter_record_charge`: the RPC output column
      `cost_date` collided with the unqualified `on conflict (cost_date)`
      target. The replacement uses the primary-key constraint as the
      conflict target and assigns the returned date through a local
      `charged_cost_date` variable.
- [ ] Integration test that runs a mock Stage 1 + Stage 2
      simulation and asserts the cost meter was incremented the
      expected number of times. Deferred to PLAN-0042's manual
      production smoke; the unit tests + the migration regression
      cover the happy path for now.

### Test catalog seed

- [x] Add a Vitest regression test that asserts the seed migration
      ships the expected upserts (deterministic sofa ids, corner-tag
      slug forwarding, shared fabric, visual matrix columns,
      published render cells, idempotent `on conflict` clauses) and
      that `scripts/seed-simulation-test-data.mjs` honours the
      service-role-key requirement, the local-only safety guard,
      and the `corner_tag_slug` argument forwarding.
- [x] Implement `scripts/seed-simulation-test-data.mjs` as an
      idempotent Node script that calls the new
      `public.seed_simulation_test_catalog(corner_tag_slug)` RPC
      added by migration `20260502000800`. The RPC upserts:
  - one straight back-wall sofa and one corner-tagged sofa using
    deterministic uuids;
  - one shared fabric with swatch + AI-reference assets;
  - one visual matrix column per sofa with sequence 1; and
  - one render cell per sofa pointing at a placeholder prepared
    sofa storage asset.
    Every insert uses `on conflict do nothing` or `do update` so
    the script is safe to re-run.
- [x] Tighten the seed regression after local browser smoke testing:
      assert every deterministic UUID constant is syntactically valid,
      seed medium render variants required by the public catalog view,
      seed private prepared-sofa assets required by public job creation,
      and copy source fixture bytes into original, medium, swatch,
      AI-reference, and prepared-sofa storage paths.
- [x] Add `scripts/seed-simulation-test-data/fixtures/README.md`
      documenting the storage paths the seed expects and noting
      that real placeholder bytes are uploaded by PLAN-0042. The
      catalog rows reference the storage paths but the bucket
      objects are added in PLAN-0042 manual setup; PLAN-0040's
      API-level publishability checks do not require the bucket
      objects to exist.
- [x] Add `seed:simulation-test` to `package.json` scripts.
- [x] Make `pnpm supabase:reset` restore a complete local test base by
      running `seed:simulation-test:local-fixtures` after the admin
      fixture seed. The admin fixture seed now generates deterministic
      local images for missing files and applies default lifecycle/render
      coverage scenarios to local manifests: one published complete sofa,
      one draft complete sofa, one archived complete sofa, one source-only
      draft, and one no-image draft.
- [x] Correct `seed:simulation-test:local-fixtures` to copy published sofa
      render bytes from the local admin fixture seed into the simulation-test
      render paths instead of copying fabric swatch bytes as sofa renders.
- [x] Keep complete local render scenarios sofa-like by reusing available
      source sofa photos for manual render cells before falling back to
      generated placeholders, and use two different published local sofa
      renders as the simulation-test straight/corner sources.
- [x] Publish the first three local sofas by default when a local manifest
      omits explicit lifecycle states, while keeping later scenario rows for
      archived and no-image draft coverage.
- [x] Document the seed script in
      `docs/local-supabase-worker-development.md`.

### Verification

- [x] Update `docs/roadmap/supabase.md`, `docs/roadmap/image-worker.md`,
      `docs/roadmap/workflow.md`, and `docs/roadmap/web.md` as later
      local browser smoke support also documents the public API's worker
      pump environment variables.
- [x] Run `pnpm vitest run scripts/seed-local-admin-fixtures.test.mjs scripts/in-home-simulation-seed-catalog-migration.test.mjs`.
- [x] Run `pnpm supabase:reset` locally and verify Postgres has
      published, draft, and archived sofas; public catalog rows; complete
      and incomplete render-cell coverage; generated storage assets; and
      simulation-test storage copies.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check origin/dev`
      — all green locally; CI re-validates on the PR.
- [ ] Worker behavior parity check (manual, by Ahmed): run the
      standard test photo through the worker after the cost-meter
      hook is wired and confirm the artifact set is pixel-equivalent
      to the previous baseline. Pending Ahmed's local verification.

## Tests

- SQL migration tests (see Tasks).
- Cost meter unit tests + dispatch integration test.
- Seed script smoke test running against the local Supabase project.

## Roadmap

- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`

## Notes

- The corner-tag value used by the seed script is the same one the API will
  use in PLAN-0040 to derive `room_geometry_mode` at job creation. PLAN-0042
  obtains the final, catalog-owner-confirmed value; until then the script
  accepts the value via an `--corner-tag` flag with a sane default.
- The worker is a black box for this plan: only the cost-meter increment is
  added, on top of the existing provider call sites. No prompt, retry, or
  pipeline behavior changes.
- `simulation_rate_limits` is consumed by PLAN-0040; this plan only ships
  the table + cleanup. The actual rate-limit logic lives in the API layer.
- Migration timestamps follow the existing repo convention; check the
  highest committed timestamp before naming a new file to avoid collisions.
