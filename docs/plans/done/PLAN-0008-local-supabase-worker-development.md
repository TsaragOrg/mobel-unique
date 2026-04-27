# PLAN-0008 Local Supabase Worker Development

Plan: PLAN-0008
Spec: SPEC-0008
Status: done
Owner area: supabase
Affected packages:

- `package.json`
- `supabase`
- `apps/api`
- `apps/web`
- `workers/image`
- `docs/roadmap/supabase.md`
- `docs/roadmap/workflow.md`

## Goal

Implement the local Supabase worker development foundation defined by
`SPEC-0008` so developers can run local Supabase, serve local Edge Functions,
and execute worker infrastructure smoke tests without using DEV or PROD
Supabase resources.

## Tasks

- [x] Add Supabase CLI to root development tooling.
- [x] Add committed Supabase local configuration under `supabase/`.
- [x] Add root scripts for local Supabase start, stop, reset, status, function
  serving, and worker infrastructure smoke tests.
- [x] Add local migrations for the minimum queue and smoke-test job foundation.
- [x] Add private local storage bucket configuration or migration support needed
  by smoke tests.
- [x] Add at least one local Edge Function smoke path that reads local
  configuration, connects to local Supabase, and updates local job state.
- [x] Add local worker infrastructure smoke tests that pass without real AI
  provider keys.
- [x] Update `.env.example` files with local worker foundation variables.
- [x] Document the local worker development workflow.
- [x] Update relevant roadmaps.
- [x] Run the quality gate.

## Tests

Add or update tests before implementation:

- local worker infrastructure smoke test for queue and job-state processing;
- migration or setup verification for required local queue resources;
- storage setup verification for required private local buckets;
- Edge Function smoke test that does not require real AI provider keys.

The smoke test may skip with a clear message when local Supabase is not
running, but it must fail clearly when local Supabase is running with missing
required worker foundation resources.

## Roadmap

Update these roadmap files when implementation changes are made:

- `docs/roadmap/supabase.md`;
- `docs/roadmap/workflow.md`;
- `docs/roadmap/api.md` if API local configuration changes;
- `docs/roadmap/image-worker.md` if worker package scripts or compatibility
  files change.

## Notes

This plan must not implement the full `SPEC-0006` or `SPEC-0007` worker
behavior. It should create only the local foundation needed to develop and test
those workers later.

Real provider calls must remain opt-in. The default local smoke path must use
mocked provider behavior and must not require `GEMINI_API_KEY` or
`OPENAI_API_KEY`.
