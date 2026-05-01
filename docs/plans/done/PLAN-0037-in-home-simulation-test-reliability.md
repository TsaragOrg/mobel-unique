# In-Home Simulation Test Reliability Plan

**Goal:** Make the root test gate deterministic for SPEC-0007 in-home simulation coverage by removing avoidable local Vitest failures and making smoke harness timeouts fail clearly.

**Architecture:** Keep the production worker code unchanged. The fix is limited to repository workflow tests and local smoke-test harness behavior: ensure the Node/Vitest dependency path is installed, run child-process-heavy smoke tests outside file-level parallelism, and classify psql timeouts as failures instead of local database skips.

Plan: PLAN-0037
Spec: SPEC-0007
Related Specs:

- SPEC-0008

Status: done
Owner area: workflow
Depends on:

- PLAN-0010
- PLAN-0011
- PLAN-0012

Affected packages:

- Root workflow scripts
- `scripts`
- `docs/roadmap`

## Current Gap

- `scripts/in-home-simulation-corners.test.mjs` and `scripts/in-home-simulation-stage-1-providers.test.mjs` require the root `imagescript` dev dependency to be present for the Deno URL alias used by Vitest.
- The six psql smoke harness test files spawn many child Node processes when Vitest runs files in parallel.
- Under load, the smoke scripts can hit their psql timeout path and report `SKIP local Supabase database is not reachable`, which hides a test harness timeout as an environment skip.

## Tasks

- [x] Confirm the failing and flaky surfaces with the narrow in-home simulation test sets.
- [x] Split the root `pnpm test` command so normal tests run in parallel and the six psql smoke harness tests run with `--no-file-parallelism`.
- [x] Increase smoke harness psql timeout defaults and fail clearly on timeout instead of skipping.
- [x] Add timeout coverage to the smoke harness tests.
- [x] Run targeted tests, `pnpm spec:check`, `pnpm typecheck`, and the root `pnpm test`.
- [x] Move this plan to `docs/plans/done` and update the workflow roadmap.
