# PLAN-0036 Local Fabric Render Global Capacity

Plan: PLAN-0036
Spec: SPEC-0006
Status: done
Owner area: supabase
Affected packages:

- `supabase/functions/fabric-render-worker`
- `supabase/migrations`
- `scripts`
- `docs`

## Goal

Prevent local Gemini fabric render jobs from running in parallel across separate
manual `Generate` requests. `PLAN-0031` limited concurrency inside one
`request_id`, but two quick single-cell actions still created two independent
requests and could make the local Supabase Edge runtime cancel one worker before
it wrote a terminal job status.

## Tasks

- [x] Add source and migration tests for cross-request local capacity.
- [x] Add a worker capacity scope that stays `request` by default and becomes
      `global` for local Gemini worker runs.
- [x] Enforce the selected capacity scope in SQL claim helpers under advisory
      locks.
- [x] After a job completes, continue the same request when it still has queued
      jobs, otherwise pump the oldest queued request in global-capacity mode.
- [x] Update local worker docs and roadmaps.

## Tests

```bash
pnpm vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/supabase-migrations-unique.test.mjs
```

## Notes

Deployed workers keep the existing request-scoped behavior. The global scope is
selected only by the worker when it detects a local environment and the Gemini
provider.
