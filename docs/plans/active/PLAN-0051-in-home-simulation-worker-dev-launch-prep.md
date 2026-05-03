# PLAN-0051 In-Home Simulation Worker DEV Launch Preparation

Plan: PLAN-0051
Spec: SPEC-0015
Status: active
Owner area: supabase
Affected packages:

- `supabase/functions/in-home-simulation-worker/index.ts`
- `supabase/migrations/20260503000100_in_home_simulation_worker_cron.sql` (new)
- `.github/workflows/quality.yml`
- `scripts/supabase-dev-deploy-workflow.test.mjs`
- `scripts/seed-simulation-test-data.mjs`
- `scripts/seed-simulation-test-data/fixtures/README.md`
- `docs/specs/manifest.json`
- `docs/roadmap/supabase.md`

## Goal

Make the production `in-home-simulation-worker` Edge Function reachable
on the DEV Supabase project, on a recurring schedule, with the test
catalog storage objects populated. After this plan lands and CI runs,
PLAN-0042 (manual launch test) can execute the full browser end-to-end
flow: catalog → email gate → upload room photo → submit dimensions →
receive placed sofa image.

This plan exists because PLAN-0038 through PLAN-0041 delivered worker
code, DB schema, public API, and wizard UI, but the worker itself was
never deployed to DEV, no cron triggers it, and the test catalog
storage paths referenced by `seed_simulation_test_catalog` point at
objects that do not exist.

## Scope

This plan covers four pieces, each mirroring an established
fabric-render-worker pattern:

1. **Worker invocation auth** — add an `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`
   header check to the worker, mirroring the
   `validateWorkerInvocation` helper in `fabric-render-worker/index.ts`.
   Without this, the function (deployed with `--no-verify-jwt` like
   every worker in this repo) would be open to the public internet.
2. **Cron migration** — add `20260503000100_in_home_simulation_worker_cron.sql`
   that schedules `in-home-simulation-worker-runner` once per minute,
   reading the function URL and invoke secret from Vault. Mirrors
   `20260429000200_fabric_render_worker_cron.sql`.
3. **CI deploy** — extend the `supabase-dev` job in
   `.github/workflows/quality.yml` so a push to `dev` deploys the
   in-home worker, sets its Edge Function secrets
   (`OPENAI_API_KEY`, `IN_HOME_SIMULATION_PROVIDER_MODE=live`,
   `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`, `APP_ENV=dev`), and
   upserts the matching Vault secrets for cron. Mirrors the existing
   fabric-render blocks.
4. **Storage seed** — extend `scripts/seed-simulation-test-data.mjs`
   so it also copies bytes from existing dev catalog assets into the
   four storage paths the test sofas reference. Source slugs are
   passed via CLI args so the script never hardcodes a specific dev
   sofa.

This plan does **not** include:

- PROD deployment of the in-home worker (out of scope for SPEC-0015
  launch test; covered after PLAN-0042 sign-off).
- Any change to the worker pipeline itself (cleaning, corners, lines,
  placement). The pipeline is at parity with the canonical live
  harness as of PLAN-0016 + PLAN-0038.
- Any change to wizard UI or public API behavior.
- Producing new sofa renders. The seed step copies existing dev
  catalog bytes; choosing which sofa/fabric to use is an operator
  decision Ahmed makes when running the seed.

## Tasks

- [ ] Add `validateInHomeSimulationWorkerInvocation` helper in
      `supabase/functions/in-home-simulation-worker/index.ts` and call
      it inside `Deno.serve` after the method check. The helper mirrors
      `validateWorkerInvocation` in
      `supabase/functions/fabric-render-worker/index.ts:293-318`:
      missing env var with non-local environment → 500;
      header `x-in-home-simulation-worker-secret` mismatch → 401.
- [ ] Create `supabase/migrations/20260503000100_in_home_simulation_worker_cron.sql`
      modeled on `20260429000200_fabric_render_worker_cron.sql`. Job
      name: `in-home-simulation-worker-runner`. Vault secret names:
      `in_home_simulation_worker_function_url`,
      `in_home_simulation_worker_invoke_secret`. Header:
      `x-in-home-simulation-worker-secret`.
- [ ] Extend `.github/workflows/quality.yml` `supabase-dev` job:
  - add `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`,
    `IN_HOME_SIMULATION_WORKER_FUNCTION_URL`, and
    `OPENAI_API_KEY` to the job env from the corresponding
    `SUPABASE_DEV_*` GitHub secrets;
  - extend the validate step with `test -n` guards for those vars;
  - add a "Set Supabase DEV in-home simulation worker secrets" step
    that runs `supabase secrets set` with `APP_ENV=dev`,
    `IN_HOME_SIMULATION_PROVIDER_MODE=live`, `OPENAI_API_KEY`, and
    `IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`;
  - add a "Deploy Supabase DEV in-home simulation worker" step that
    runs `supabase functions deploy in-home-simulation-worker
    --project-ref ... --no-verify-jwt`;
  - add a "Set Supabase DEV in-home simulation cron Vault secrets"
    step that mirrors the fabric-render Vault upsert block, swapping
    the secret names and the env var names.
- [ ] Extend `scripts/supabase-dev-deploy-workflow.test.mjs` with four
      new `it(...)` blocks asserting the same shape exists for the
      in-home worker: env vars, validation guards, secrets+deploy
      ordering, and Vault upsert ordering.
- [ ] Extend `scripts/seed-simulation-test-data.mjs` with an upload
      step. Accepts CLI flags `--source-straight-render-path`,
      `--source-corner-render-path`, `--source-fabric-swatch-path`,
      `--source-fabric-ai-reference-path`. For each, the script
      downloads the bytes from the named source storage object and
      uploads to the matching `seed/simulation-test/...` target path.
      Idempotent (`upsert: true`). When a flag is omitted, the script
      logs a warning and skips that asset, so local seeds against an
      empty bucket still succeed.
- [ ] Update `scripts/seed-simulation-test-data/fixtures/README.md` to
      describe the new copy-from-storage flow and remove the stale
      "drop PNG bytes here" instruction.
- [ ] Add `"PLAN-0051"` to the `SPEC-0015.implementationPlans` array
      in `docs/specs/manifest.json`.
- [ ] Add a one-line entry under `docs/roadmap/supabase.md` referencing
      PLAN-0051.
- [ ] Run `pnpm typecheck`, `pnpm test --filter` for the focused
      workflow test, and `pnpm spec:check` locally.

## Tests

- `scripts/supabase-dev-deploy-workflow.test.mjs` — extended with the
  in-home worker assertions; this is the primary automated check that
  the workflow change is wired correctly.
- Worker invocation auth is exercised in DEV after deploy by curling
  the function with and without the header (manual smoke; documented
  in PLAN-0042 runbook follow-up).

## Roadmap

- `docs/roadmap/supabase.md`

## Notes

- The "production worker input parity" memory rule still binds: this
  plan does not change worker behavior, so parity with the terminal
  harness is preserved by construction.
- Per the "verify memory against code" rule, this plan was scoped only
  after grepping the worker source and CI workflow to confirm what is
  actually missing (no cron migration, no auth header check, no CI
  deploy block). Memory claiming "production worker is at parity"
  refers to the pipeline implementation, not to deployment state.
- After this plan merges, Ahmed must add two GitHub repository secrets
  (`SUPABASE_DEV_OPENAI_API_KEY`,
  `SUPABASE_DEV_IN_HOME_SIMULATION_WORKER_INVOKE_SECRET`) before the
  next push to `dev` will succeed. The validate step in CI fails fast
  with a clear message if either is missing.
- The seed script's storage upload step requires
  `SUPABASE_SERVICE_ROLE_KEY` and only runs against DEV when
  `SIMULATION_TEST_SEED_ALLOW_NON_LOCAL=1` is set, mirroring the
  existing safety on the catalog upsert.
