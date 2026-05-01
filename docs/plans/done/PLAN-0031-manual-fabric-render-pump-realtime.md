# PLAN-0031 Manual Fabric Render Pump And Realtime

Plan: PLAN-0031
Spec: SPEC-0006
Related specs: SPEC-0008, SPEC-0009, SPEC-0010, SPEC-0013
Change request: CR-SPEC-0006-SPEC-0010-SPEC-0013-manual-fabric-render-invocation-and-realtime
Status: done
Owner area: supabase
Affected packages:

- `apps/web`
- `supabase/functions/fabric-render-worker`
- `supabase/migrations`
- `scripts`

## Goal

Replace cron-first fabric render processing with explicit administrator-driven
processing:

- single-cell `Generate` and `Refine` create jobs with a `request_id`;
- sofa-level `Generate all` creates one job per eligible cell with one shared
  `request_id`;
- the admin API invokes the internal fabric render Edge Function in pump mode;
- pump mode keeps at most `FABRIC_RENDER_MAX_CONCURRENT_JOBS` one-job workers
  active for the request;
- job mode processes exactly one claimed job and re-invokes pump mode when it
  finishes;
- the chain stops when no queued jobs remain for the request;
- the admin sofa page observes job status through Supabase Realtime and offers
  manual resume when queued jobs remain without visible progress.

## Scope

This plan includes:

- adding `fabric_render_jobs.request_id` and claim helper indexes;
- removing cron as the product execution path for fabric render jobs;
- adding pump/job invocation modes to `fabric-render-worker`;
- preserving service-side worker authorization;
- adding admin API orchestration for single, refine, generate-all, retry, and
  resume actions;
- adding Realtime-safe database publication and admin-only observation support;
- replacing continuous sofa-edit polling with Realtime updates, with a bounded
  fallback only when Realtime is unavailable;
- keeping failed jobs visible and manual-only for retry.

This plan does not include:

- changing the Gemini prompt, provider model, or output normalization rules;
- creating a separate batch table;
- automatic cron fallback or automatic retry;
- public catalog publication changes;
- in-home simulation worker changes.

## Architecture

The implementation uses one lightweight request identifier instead of a batch
table.

```text
Admin action
  -> admin API creates one or more fabric_render_jobs with request_id
  -> admin API invokes fabric-render-worker { mode: "pump", request_id }
  -> pump claims capacity and invokes job workers up to the configured limit
  -> each job worker claims and processes exactly one job
  -> each job worker writes succeeded/failed and invokes pump again
  -> pump starts nothing when no queued jobs remain for request_id
```

Concurrency is enforced by database state, not by browser state. Pump mode must
count active `processing` jobs for the `request_id` before starting more
workers.

If the chain stops because an invocation is killed before the next pump starts,
queued jobs remain visible. The administrator can press a manual resume action,
which invokes pump mode again for the same request or sofa-scoped queued jobs.

## Tasks

- [x] Add failing migration tests for `request_id`, pump helper indexes,
      Realtime publication support, and cron removal or deactivation.
- [x] Add failing worker source tests for pump mode, job mode, one-job
      processing, concurrency limits, and self-invocation after job completion.
- [x] Add failing admin API tests for single generate, refine, generate-all,
      retry, and resume invoking pump mode service-side.
- [x] Add failing admin UI tests for sofa-scoped Realtime subscription,
      generated job updates, failed job display, and resume action visibility.
- [x] Add `request_id` and helper indexes to `fabric_render_jobs`.
- [x] Add or update database RPCs for request-scoped job claiming and active
      worker counting.
- [x] Remove or disable the fabric render cron runner from the product path.
- [x] Implement worker pump mode.
- [x] Implement worker job mode.
- [x] Update worker failure handling so failed jobs do not automatically retry.
- [x] Implement admin API pump invocation for single generate and refine.
- [x] Implement the sofa-level generate-all endpoint.
- [x] Implement manual retry for failed fabric render jobs.
- [x] Implement manual resume for queued jobs.
- [x] Add Realtime subscription support to the sofa edit render coverage flow.
- [x] Refresh render coverage or candidate data once when Realtime reports a
      succeeded job.
- [x] Update local environment examples and smoke scripts for the manual
      pump/job workflow.
- [x] Update roadmaps and move this plan to `docs/plans/done` when complete.

## Tests

Run focused checks first:

```bash
pnpm vitest run scripts/fabric-render-worker-migration.test.mjs
pnpm vitest run scripts/fabric-render-worker-function.test.mjs
pnpm --filter @mobel-unique/web test
pnpm --filter @mobel-unique/web typecheck
pnpm spec:check
```

Before completion, run the broader local gate:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Local Supabase verification should prove:

- `Generate` processes one job without manual `curl`;
- `Generate all` creates multiple jobs and drains them through at most the
  configured number of active job workers;
- failed jobs remain failed and visible;
- queued jobs can be resumed manually;
- Realtime updates the sofa page without continuous polling.

## Roadmap

Update these roadmaps as the plan moves:

- `docs/roadmap/api.md`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Notes

- `request_id` is intentionally a column on `fabric_render_jobs`, not a new
  batch table.
- Pump mode is orchestration only and should return quickly.
- Job mode owns image generation and processes exactly one job per invocation.
- Realtime is only an observation mechanism. It must not start work.
- Cron migrations and old cron workflow tests are historical and should be
  superseded by this plan's manual pump/job contract.
