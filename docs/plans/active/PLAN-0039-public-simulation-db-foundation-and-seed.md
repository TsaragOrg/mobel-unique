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
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`

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

- [ ] Add unit test for `lib/cost-meter.ts` covering: increment by a fixed
      cents amount per provider role, lazy creation of today's row, flip to
      `worker_paused = true` once `usd_cost_estimate_cents >= cap_cents`,
      and a no-op when the meter is already paused.
- [ ] Implement `lib/cost-meter.ts` with `incrementForRole(role)` and
      `isPausedForToday()` helpers. Provider role costs use a small fixed
      table (e.g. `validation: 1`, `cleaning: 4`, `corners: 4`,
      `placement: 4`, `placement_measurement: 1` cents) tunable via env.
- [ ] Add integration test that runs a stage 1 + stage 2 mock simulation
      and asserts the cost meter was incremented the expected number of
      times.
- [ ] Wire `cost-meter.incrementForRole(...)` into the worker dispatch path
      after each successful provider call.
- [ ] Add `SIMULATION_DAILY_COST_CAP_USD` (default 50) and
      `SIMULATION_COST_METER_TABLE` env handling to the worker config.

### Test catalog seed

- [ ] Add a smoke test that runs `seed-simulation-test-data.mjs` against a
      local Supabase project and asserts both sofas, fabrics, visual
      positions, renders, and fixture images exist with the expected
      relationships and the corner sofa carries the corner tag.
- [ ] Implement `scripts/seed-simulation-test-data.mjs` as an idempotent
      script with `--out`-friendly logging. It must:
  - upsert one straight sofa without the corner tag and one corner-tagged
    sofa using the corner-tag value documented in SPEC-0015 cross-team
    contracts (PLAN-0042 confirms the final value);
  - upsert at least one fabric per sofa;
  - upsert one visual position per sofa with a deterministic prepared
    sofa render referencing a fixture image under
    `scripts/seed-simulation-test-data/fixtures/`;
  - skip rows that already match the seeded shape so the script is safe
    to re-run.
- [ ] Add the fixture images under
      `scripts/seed-simulation-test-data/fixtures/` (one straight, one
      corner-rendered placeholder) and reference them from the script.
- [ ] Add `seed:simulation-test` to `package.json` scripts.
- [ ] Document the seed script in `docs/local-supabase-worker-development.md`.

### Verification

- [ ] Update `docs/roadmap/supabase.md` and `docs/roadmap/web.md`.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm spec:check`.
- [ ] Worker behavior parity check (manual, by Ahmed): run the standard
      test photo through the worker after the cost-meter hook is wired and
      confirm the artifact set is pixel-equivalent to the previous baseline.

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
