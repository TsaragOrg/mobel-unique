# PLAN-0074 Admin Selected Render Queue Resume

Plan: PLAN-0074
Spec: SPEC-0006
Related specs: SPEC-0014, SPEC-0010, SPEC-0011
Status: done
Owner area: web
Affected packages:

- `apps/web`
- `supabase/functions/fabric-render-worker`
- `supabase/migrations`
- `scripts`
- `docs/roadmap`

## Goal

Let an administrator resume a stalled fabric render queue from one selected
queued render cell, without automatically continuing the queue after a failed
job and without starting a second job while another job is already processing
for the same sofa.

## Context

`SPEC-0006` already allows queued fabric render jobs to remain visible when a
manual pump chain stops, and it allows a later explicit administrator resume
action. The current admin UI exposes a sofa-level `Resume queued jobs` action,
but it does not let the administrator choose which queued render cell should be
processed first.

The requested behavior is:

- `Generate missing` or `Generate all` may still create several queued jobs.
- If the active processing job fails, remaining queued jobs stay queued.
- The administrator opens or clicks one queued render cell and explicitly
  resumes from that cell.
- The selected queued cell is claimed first.
- If another job is already processing for the same sofa, the resume request
  returns a visible conflict error instead of starting more work.

## Scope

This plan includes:

- selected queued-cell resume from the sofa edit Renders workflow;
- request payload support for `render_cell_id` on the existing admin resume
  endpoint;
- service-side validation that selected-cell resume is allowed only for queued
  jobs and only when the same sofa has no active processing job;
- worker pump and claim support for a preferred queued job id;
- worker continuation changes so a failed job does not automatically start the
  next queued job;
- admin UI copy, comments, tests, and error messaging for the new cell action.

This plan does not include:

- changing prompt text, provider choice, model choice, or image normalization;
- changing `Generate missing`, `Generate all`, single-cell `Generate`, or
  failed-job `Retry generation` creation rules;
- automatic retry after a failed job;
- a new batch table;
- public catalog or publication changes.

## Architecture

The existing `POST /api/admin/fabric-render-jobs/resume` route remains the
admin entry point. It will accept the existing request-scoped and sofa-scoped
payloads, plus a new selected-cell payload:

```json
{
  "render_cell_id": "00000000-0000-4000-8000-000000000000"
}
```

For selected-cell resume, the web API finds the queued fabric render job for
that render cell, checks active processing jobs for the same sofa, and invokes
the worker pump with both `request_id` and `preferred_job_id`.

```text
Admin opens queued cell
  -> clicks Resume generation
  -> web API validates selected queued job and sofa processing lock
  -> web API invokes fabric-render-worker pump with preferred_job_id
  -> pump starts one job worker for the request
  -> job worker claims preferred_job_id first
  -> on success, the normal request chain may continue
  -> on failure, remaining queued jobs stay queued until another admin action
```

The database claim helper owns the final ordering guarantee. Browser state can
show a better action, but it must not be trusted to choose a job.

## File Plan

- Modify `apps/web/src/lib/admin-catalog.ts`
  - Extend `FabricRenderResumeInput`.
  - Validate `render_cell_id`.
  - Add selected queued-cell lookup and active-processing conflict checks.
  - Pass `preferred_job_id` to worker pump invocation.
- Modify `apps/web/src/lib/admin-catalog.test.ts`
  - Cover validation for `render_cell_id`.
  - Cover rejection when `render_cell_id` is combined with `request_id` or
    `sofa_id`.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.ts`
  - Shape selected-cell resume responses without changing the route path.
- Modify `apps/web/src/lib/admin-catalog-route-handlers.test.ts`
  - Cover route payload and response for selected-cell resume.
- Modify `apps/web/src/app/admin/AdminCatalogPages.tsx`
  - Add a queued-cell resume action in the render cell sheet.
  - Remove the generic sofa-level resume button from the Renders command bar,
    or keep it hidden from the normal sofa edit flow so the admin chooses a
    cell.
  - Update required Russian and French comments near changed `.tsx` code.
- Modify `apps/web/src/app/admin/AdminCatalogPages.test.tsx`
  - Cover the queued cell action, selected payload, and visible conflict error.
- Modify `apps/web/src/app/admin/admin-sofa-edit-model.ts`
  - Give queued cells a primary action label such as `Resume generation`.
- Modify `apps/web/src/app/admin/admin-sofa-edit-model.test.ts`
  - Cover queued-cell primary action behavior.
- Modify `apps/web/src/app/admin/admin-error-messages.ts`
  - Add a clear admin message for the processing conflict, for example:
    `Another image generation is already running. Wait for it to finish before
    resuming a queued cell.`
- Modify `apps/web/src/app/admin/admin-error-messages.test.ts`
  - Cover the new error code and ensure raw technical codes are not shown.
- Modify `supabase/functions/fabric-render-worker/index.ts`
  - Parse optional `preferred_job_id`.
  - Pass it from pump mode to the first job invocation.
  - Pass it from job mode to the claim RPC.
  - Continue the pump after success only; do not continue after a failed job.
- Add `supabase/migrations/20260509000100_fabric_render_selected_queue_resume.sql`
  - Replace `public.fabric_render_worker_claim_one_for_request` with an
    optional `p_preferred_job_id uuid default null`.
  - Claim the preferred queued job first when it belongs to the same request.
  - Keep existing request/global capacity behavior.
- Modify `scripts/fabric-render-worker-function.test.mjs`
  - Cover preferred job parsing, preferred job handoff, and failure stopping
    continuation.
- Modify `scripts/fabric-render-worker-migration.test.mjs`
  - Cover the new claim function signature and preferred-job ordering.
- Modify roadmap files after implementation:
  - `docs/roadmap/web.md`
  - `docs/roadmap/api.md`
  - `docs/roadmap/image-worker.md`
  - `docs/roadmap/supabase.md`

## Tasks

- [x] Add failing validation tests for selected queued-cell resume payloads in
      `apps/web/src/lib/admin-catalog.test.ts`.
- [x] Add failing route-handler tests for
      `POST /api/admin/fabric-render-jobs/resume` with `render_cell_id`.
- [x] Add failing admin UI tests for opening a queued render cell and clicking
      `Resume generation`.
- [x] Add failing admin UI tests showing a conflict message when the same sofa
      already has a processing render job.
- [x] Add failing model tests that queued cells expose the resume action while
      processing cells remain informational.
- [x] Add failing worker function tests for `preferred_job_id` parsing and
      handoff.
- [x] Add failing worker function tests proving failed jobs do not invoke the
      next pump automatically.
- [x] Add failing migration tests for preferred-job claim ordering.
- [x] Extend `FabricRenderResumeInput` and
      `validateFabricRenderResumePayload` with the exclusive
      `render_cell_id` option.
- [x] Add or update the route response type so selected-cell resume can return
      `preferred_job_id` and `render_cell_id`.
- [x] Implement selected queued-cell lookup in the admin catalog store.
- [x] Reuse `markExpiredFabricRenderJobsForSofa` before checking active
      processing jobs so stale claims become failed before conflict detection.
- [x] Return `409` with a clear error code when the selected render cell has no
      queued job.
- [x] Return `409` with a clear processing-conflict error code when the same
      sofa already has a non-expired processing job.
- [x] Update `invokeFabricRenderPump` so it can send `preferred_job_id`.
- [x] Add the migration that updates
      `fabric_render_worker_claim_one_for_request` to prefer
      `p_preferred_job_id`.
- [x] Update the worker request parser to accept optional `preferred_job_id` for
      pump and job modes.
- [x] Update pump mode so selected-cell resume starts one preferred job worker
      first instead of filling all available slots at once.
- [x] Update job mode so successful jobs may continue the request chain, but
      failed jobs leave remaining queued jobs visible for another explicit
      admin resume action.
- [x] Add the queued-cell `Resume generation` action in the render cell sheet.
- [x] Remove or hide the generic sofa-level `Resume queued jobs` command from
      the normal Renders command bar.
- [x] Update `.tsx` comments touched by the UI change in Russian and French
      using the repository comment rules.
- [x] Add the new admin-facing error message and tests.
- [x] Update the roadmap files listed in this plan.
- [x] Run focused tests.
- [x] Run package-level web typecheck.
- [x] Run `pnpm spec:check`.

## Tests

Focused checks:

```bash
pnpm --filter @mobel-unique/web test -- src/lib/admin-catalog.test.ts src/lib/admin-catalog-route-handlers.test.ts src/app/admin/admin-sofa-edit-model.test.ts src/app/admin/admin-error-messages.test.ts src/app/admin/AdminCatalogPages.test.tsx
pnpm vitest run scripts/fabric-render-worker-function.test.mjs scripts/fabric-render-worker-migration.test.mjs
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

Manual local verification:

- Open `/admin/sofas/[sofa_id]` and switch to Renders.
- Queue more than one missing render job.
- Let the current processing job fail.
- Confirm remaining jobs stay queued.
- Open one queued cell and click `Resume generation`.
- Confirm that selected cell becomes processing first.
- While one job is processing, click `Resume generation` on another queued cell.
- Confirm the UI shows the processing-conflict message and no second job starts.

## Roadmap

- `docs/roadmap/web.md`: selected queued-cell resume in the sofa edit Renders
  workflow.
- `docs/roadmap/api.md`: admin resume endpoint supports a selected render cell
  and returns processing conflicts.
- `docs/roadmap/image-worker.md`: worker accepts a preferred queued job and does
  not continue after failed jobs.
- `docs/roadmap/supabase.md`: claim RPC supports preferred queued job ordering.

## Notes

- The selected-cell behavior belongs under `SPEC-0006` because the worker
  already defines explicit manual resume after queued work remains.
- `SPEC-0014` remains related because the visible action lives in the sofa edit
  Renders UI.
- The selected job must be chosen by durable database state, not by table order
  in the browser.
- Failed-job retry remains separate: retry creates a new queued job from the
  failed job. Selected-cell resume only starts an existing queued job.

## Closure

Closed on 2026-05-09 after implementation, focused tests, web typecheck,
specification guard, and roadmap updates were completed.
