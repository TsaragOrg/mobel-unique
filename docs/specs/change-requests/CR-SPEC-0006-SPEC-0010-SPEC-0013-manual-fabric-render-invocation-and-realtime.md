# CR-SPEC-0006 SPEC-0010 SPEC-0013 Manual Fabric Render Invocation And Realtime

Target spec id: SPEC-0006
Related spec ids: SPEC-0010, SPEC-0013, SPEC-0008
Status: accepted

## Reason For Change

The current accepted fabric render flow allows the worker to be invoked by an
API or scheduler, and the recent implementation plan made Supabase Cron the
primary production runner for queued fabric render jobs.

That architecture is too automatic for the MVP admin workflow. Fabric render
generation is not a continuously arriving background workload. It is a
punctual administrator action used during catalog preparation. The expected
operator behavior is:

- the administrator clicks `Generate` or `Refine`;
- the system starts that requested generation attempt immediately;
- success or failure is written to durable database state;
- if the attempt fails, the administrator sees the failure and manually decides
  whether to retry.

A recurring cron runner can hide failures, retry work without a fresh admin
decision, and leave local development dependent on scheduler configuration
when the product behavior is actually manual.

The accepted specs should define manual, service-side invocation as the primary
contract and Realtime job observation as the preferred admin UI update
mechanism.

## Proposed Change

Update `SPEC-0006` so fabric render worker execution is manually triggered by
an administrator request, not by an always-on scheduler:

- each `initial` or `refine` generation attempt must originate from an
  explicit admin action;
- an admin action may create one job, such as `Generate` for one cell, or many
  jobs, such as `Generate all` for all eligible cells on a sofa;
- the admin-facing service API must create the durable `fabric_render_jobs`
  records for the action and start the worker pump as part of the same manual
  workflow;
- jobs created by the same admin action must share a lightweight `request_id`
  so the pump can drain the work created by that action without a separate batch
  table;
- worker start means invoking the internal fabric render Supabase Edge Function
  in pump mode after the database write succeeds;
- pump mode must inspect durable database state, keep at most
  `FABRIC_RENDER_MAX_CONCURRENT_JOBS` job workers active for the `request_id`,
  and stop when there is no remaining queued work for that request;
- job mode must claim one eligible job atomically, process only that job, mark
  it `succeeded` or `failed`, and then invoke pump mode so another queued job
  can fill the freed worker slot;
- the browser must still never call worker-only Edge Functions directly;
- the worker invocation must be service-side, using service authorization and
  server-only worker invocation secrets where required;
- when an admin action creates many jobs, such as 15 image generations, the
  pump must start no more than the configured concurrency, for example three
  one-job workers, and must continue refilling freed slots until no queued jobs
  remain for the `request_id`;
- pump mode must be short-lived orchestration. It must not perform image
  generation itself and must not hold one long-running invocation open for an
  entire large set of images;
- Supabase Cron must not be the primary fabric render execution mechanism;
- no automatic cron fallback may retry or process failed fabric render work
  without a fresh administrator action;
- the implementation may keep an explicit operator-only maintenance command or
  smoke-test helper for local diagnostics, but that helper must not define the
  product workflow.

Update failure behavior:

- if the admin API creates a job but cannot start the worker, it must record a
  safe failure state for that job instead of leaving it indefinitely `queued`;
- if the worker starts and later fails during claim, input resolution, provider
  execution, storage upload, normalization, or candidate persistence, the worker
  must mark the job `failed` and store a readable safe error message;
- failed fabric render jobs must remain visible in admin render coverage and
  job detail responses;
- retries must be explicit admin actions through a retry or new-generation
  endpoint;
- if the pump chain stops before all queued jobs for a request are started, the
  administrator must have an explicit resume action that invokes pump mode again
  for the remaining queued work;
- retry must preserve enough audit context to understand the failed attempt and
  must not automatically make any failed or previous output public-usable;
- provider retry classification may still be recorded for diagnostics, but it
  must not cause automatic background retries in the MVP manual workflow.

Update `SPEC-0010` admin API contracts:

- `POST /api/admin/fabric-render-jobs` must create the durable job and start
  service-side worker processing by invoking the internal Edge Function pump
  after the database write succeeds;
- the API must also provide a manual generate-all path for one sofa that creates
  multiple eligible `fabric_render_jobs` rows with one shared `request_id` and
  invokes the pump once;
- a successful response means the job was accepted and worker start was
  attempted, not that image generation has completed;
- if worker start cannot be attempted or is rejected before the worker owns the
  job, the API must return an error and persist the job as `failed` or avoid
  creating a durable job according to the implementation plan;
- worker APIs remain internal and must not be browser-callable in DEV or PROD;
- scheduler invocation language should be narrowed so scheduler or cron is not
  treated as the normal fabric render path;
- `POST /api/admin/fabric-render-jobs/{job_id}/retry` must be a manual action
  and must not rely on automatic cron pickup.
- the API must provide a manual resume path for queued fabric render jobs that
  are not currently being processed, scoped by `request_id` or by sofa according
  to the implementation plan.

Update `SPEC-0013` admin frontend behavior:

- the render coverage section should use Supabase Realtime or an equivalent
  authorized realtime channel to observe `fabric_render_jobs` status changes
  for the relevant sofa;
- when an administrator opens a sofa edit page, the page must load current
  render coverage and subscribe to Realtime updates for jobs belonging to that
  sofa, including jobs that were already `queued` or `processing` before the
  page opened;
- Realtime is an observation mechanism only and must not start worker work;
- after a job reaches `succeeded`, the UI should refresh render coverage or
  candidate data once so the new private candidate can be reviewed;
- after a job reaches `failed`, the UI must show the safe failure state and
  offer a manual retry action when allowed;
- if the page shows queued jobs for the sofa and no worker progress is active,
  the UI should offer an explicit resume action that starts pump mode through
  the admin API;
- polling should not be the primary live-update mechanism for fabric render
  jobs once Realtime is implemented;
- if Realtime is unavailable, the UI may fall back to manual refresh or a
  clearly bounded compatibility polling path, but the backend must still record
  the durable job result.

Update local development expectations in `SPEC-0008`:

- local `Generate`, `Generate all`, and `Refine` actions should start worker
  processing without requiring the developer to run a separate manual `curl`
  invocation;
- local smoke tests may still invoke worker functions directly for diagnostics;
- local setup must document the function-serving and environment requirements
  needed for service-side worker invocation.

## Impact

- Spec: `SPEC-0006` must replace scheduler-primary execution language with
  manual service-side worker invocation.
- API: `SPEC-0010` must define that admin job creation starts worker
  processing and records failure if worker start fails.
- UI: `SPEC-0013` must define Realtime job observation and manual retry UX for
  failed jobs.
- Local development: `SPEC-0008` should clarify that normal local admin
  generation should not require manual worker `curl` calls.
- Supabase: existing cron migration behavior from `PLAN-0025` is superseded for
  the product path. A follow-up plan should remove or disable the fabric render
  cron runner and any required Vault-only cron secrets.
- Worker: the fabric render Edge Function should support pump mode and job
  mode. Plans must define `request_id`, maximum active job workers, claim order,
  timeout behavior, and how a 15-job or 50-job admin action drains through
  repeated one-job worker invocations without cron.
- Database: a helper may be needed to mark a newly created job failed when the
  service-side invocation cannot be started.
- Realtime: migrations or setup must add the required publication and RLS-safe
  access for admin observation of fabric render job status changes.
- Tests: follow-up implementation plans must cover manual job creation starting
  the worker, failed worker-start persistence, worker-side failed persistence,
  no cron dependency, Realtime subscription behavior or its adapter boundary,
  and manual retry behavior.
- Roadmaps: follow-up plans should update `api`, `supabase`, `web`,
  `image-worker`, and `workflow` roadmaps because this change crosses all five
  areas.

## Approval Note

Accepted after architecture review of the MVP admin render workflow. Fabric
render generation is a punctual administrator operation, so automatic cron-based
pickup should not be the main product path. The durable job table remains the
source of truth, worker failures remain persisted, and administrators retain
manual control over retries.
