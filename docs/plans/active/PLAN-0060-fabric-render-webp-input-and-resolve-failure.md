# PLAN-0060 Fabric Render WebP Input And Resolve Failure

Plan: PLAN-0060
Spec: SPEC-0006
Status: active
Owner area: supabase
Change request: CR-SPEC-0006-fabric-render-webp-input-and-resolve-failure
Depends on: SPEC-0006, SPEC-0009, SPEC-0010, SPEC-0013
Affected packages:

- `supabase/migrations`
- `supabase/functions/fabric-render-worker`
- `scripts`
- `docs/roadmap`

## Goal

Make fabric render generation consistent with admin uploads by accepting WebP
private input assets and by persisting input-resolution failures directly on
claimed jobs.

## Scope

- Allow `image/webp` in `fabric_render_worker_validate_input_asset`.
- Ensure `fabric_render_worker_resolve_inputs` failures are caught by the Edge
  Function job failure path.
- Preserve the existing pump continuation behavior after failure.
- Add focused tests and update roadmaps.

## Out Of Scope

- Changing provider prompts.
- Changing Gemini model selection.
- Adding a fabric render watchdog cron.
- Changing admin UI layout.

## Tasks

- [x] Add a migration that allows WebP fabric render input assets.
- [x] Move claimed-job input resolution inside the worker failure boundary.
- [x] Add worker tests that protect input-resolution failure persistence.
- [x] Add migration tests for WebP input support.
- [x] Update Supabase roadmap.
- [x] Update workflow roadmap.
- [x] Run focused worker and migration tests.
- [x] Run `pnpm spec:check`.

## Verification

Expected commands:

- `pnpm exec vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-migration.test.mjs scripts/supabase-migrations-unique.test.mjs`
- `pnpm spec:check`

## Manual Recovery Note

Existing local jobs that are already stuck in `processing` from the old failure
path still need to expire or be manually marked failed once. New jobs should
record the `fabric_render_worker_resolve_inputs` error immediately if input
resolution fails.
