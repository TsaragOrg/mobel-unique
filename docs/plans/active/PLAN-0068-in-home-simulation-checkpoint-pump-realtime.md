# PLAN-0068 In-Home Simulation Database-Dispatched Checkpoints And Realtime

Plan: PLAN-0068
Spec: SPEC-0007
Related specs: SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Related change requests:

- CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-checkpoint-pump-realtime
- CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-database-dispatched-checkpoints-realtime
- CR-SPEC-0015-public-simulation-realtime-loading-copy

Status: active
Owner area: supabase
Affected packages:

- `apps/web`
- `supabase/functions/in-home-simulation-worker`
- `supabase/migrations`
- `scripts`
- `docs/roadmap`

## Goal

Move the public in-home simulation system from request-time worker pumping and
cron pickup to API-woken database-dispatched checkpoints with visitor-safe
Realtime progress.

The API should write durable state, wake the worker dispatcher immediately, and
return without running checkpoint/provider work. The database records
dispatchable checkpoint work in the same transaction. The worker processes one
bounded checkpoint per invocation. Realtime keeps the visitor connected to safe
progress state. In-home simulation worker cron runners must not be part of this
operation.

## Current State

Already delivered under this plan:

- accepted checkpoint and Realtime spec changes for the first pump-based design;
- durable checkpoint and public progress schema foundations;
- checkpoint claim RPCs;
- checkpoint success and progress helper foundations;
- public API wrappers that create checkpoint state;
- public Realtime access contract and frontend subscription fallback;
- worker support for explicit dispatch/checkpoint modes;
- local timeout tuning for dispatch invocation.

The design now needs correction before more implementation proceeds: public API
route handlers must wake the worker dispatcher directly after durable writes,
without cron, watch loops, or request-time pump/provider execution.

## Target Architecture

```text
Public API action
  -> validate visitor session, rate limits, idempotency, and catalog selection
  -> write job/checkpoint state and dispatch outbox intent in one database mutation
  -> wake in-home-simulation-worker with mode=dispatch
  -> return without running checkpoint/provider work

Worker dispatch
  -> drains transactional outbox rows after API or worker wake-up
  -> invokes one internal checkpoint worker for each claimed dispatch row
  -> marks dispatch rows as dispatched or retryable

Worker checkpoint invocation
  -> claims one checkpoint atomically
  -> executes one bounded unit of work
  -> persists artifacts, attempts, events, safe progress, and next checkpoint

Realtime progress
  -> broadcasts visitor-safe progress metadata only
  -> causes the browser to refresh status when signed URLs are needed

Recovery
  -> recovers expired checkpoint claims
  -> redispatches claimable backlog through explicit service-side dispatch
  -> respects cost-meter pause and provider capacity
```

Realtime is not a job runner. It is only the observation layer. The database is
the execution source of truth.

## Architecture Decisions

- Public API handlers must call the worker only in dispatch mode after durable
  state commits. They must not call a request-time pump or checkpoint/provider
  path.
- Job creation, dimension submission, and regeneration must finish after
  committed durable state plus successful dispatch wake-up, not after checkpoint
  work.
- Checkpoint rows or checkpoint state columns are authoritative for work
  eligibility.
- Dispatch delivery uses a transactional database outbox. Public API mutations
  create or upsert the outbox row in the same transaction that makes a
  checkpoint claimable.
- Immediate delivery is triggered by the public API after commit, but the outbox
  row is authoritative. Dispatch recovery drains the same outbox and repairs
  missing dispatch rows for claimable checkpoints.
- Lost dispatch delivery must leave the checkpoint recoverable by scanning
  durable state.
- Worker invocations must process one checkpoint for one job.
- A checkpoint invocation should make at most one expensive OpenAI image or
  vision call. Multi-attempt loops must be persisted as separate checkpoint
  attempts.
- Public Realtime must use a visitor-safe progress surface and a scoped access
  contract. It must not expose `in_home_simulation_jobs` directly.
- Signed guide/result URLs stay API-only.
- In-home simulation worker cron runners are removed from the product path and
  must not be reintroduced for fresh visitor actions.

## Local Development Behavior

Local browser testing uses the same database outbox semantics as DEV and PROD:
public web routes write the job, checkpoint, progress projection, and dispatch
outbox row, then wake the local worker function in dispatch mode. They need the
server-only in-home worker URL and invoke-secret variables in the web app
environment because the API is now responsible for starting dispatch.

Browser testing must not require a cron job or a long-running local dispatcher
watch loop. The developer still can drain the same outbox rows manually for
diagnostics:

```bash
pnpm sim:dispatch:once
```

The helper calls only `in-home-simulation-worker` with `mode=dispatch`. It is
operator tooling, not part of the visitor workflow.

## Workstreams

### 1. Spec Alignment

- [x] Accept or revise
      `CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-database-dispatched-checkpoints-realtime`.
- [x] Update `SPEC-0007` so the worker contract names database-dispatched
      checkpoints and removes public API pump invocation as the normal path.
- [x] Update `SPEC-0009` with the chosen dispatch mechanism, outbox/trigger
      state if needed, indexes, RLS, and recovery semantics.
- [x] Update `SPEC-0010` so public simulation APIs write durable state and do
      not wait on worker pump acknowledgement.
- [x] Update `SPEC-0012` and `SPEC-0015` so the frontend contract keeps
      Realtime as observation plus HTTP fallback, not execution.

### 2. Dispatch Design

- [x] Choose the dispatch mechanism: transactional database outbox plus a small
      API-woken dispatcher.
- [x] Add a migration for the checkpoint dispatch outbox table, including one
      active dispatch intent per checkpoint, status, attempts, next attempt
      time, dispatcher lock fields, and service-role-only RLS.
- [x] Add service-role RPCs to insert/upsert, claim, mark dispatched, mark
      retryable, and dead-letter dispatch outbox rows.
- [x] Document local development behavior for the chosen dispatch path.
- [x] Add migration tests proving a newly claimable checkpoint emits or records
      exactly one outbox row inside the durable state transaction.
- [x] Add idempotency tests proving duplicate public API retries and duplicate
      dispatcher wake-ups cannot start the same checkpoint twice.
- [x] Add failure tests proving lost immediate dispatch leaves the outbox row
      pending and recoverable by explicit dispatch retry.

### 3. Public API Decoupling

- [x] Add route-handler tests proving `POST /api/public/simulations` writes the
      first checkpoint and does not call `invokeWorkerPump`.
- [x] Add route-handler tests proving dimensions and regeneration write
      placement checkpoints and do not call `invokeWorkerPump`.
- [x] Remove request-time worker pump invocation from public route handlers.
- [x] Replace `SIMULATION_WORKER_PUMP_TIMEOUT_MS` usage with dispatch wake-up
      configuration or retire it if no longer needed.
- [x] Remove the public web `SIMULATION_QUEUE_NAME` and
      `SimulationQueueEnqueuer` remnants so public route handlers expose only
      durable dispatch-outbox dependencies.
- [x] Accept public HEIC/HEIF room uploads when browsers submit empty or generic
      content types by validating the ISO BMFF `ftyp` signature and preserving
      canonical `.heic` or `.heif` input storage paths.
- [x] Add a Node runtime preview-normalization endpoint so HEIC/HEIF selections
      that fail browser-side decoding can still be converted to previewable
      JPEG before the visitor continues.
- [x] Wake the in-home worker dispatcher from public create, dimensions, and
      regeneration APIs immediately after durable DB writes.
- [x] Keep safe API responses when dispatch fails; never expose dispatch
      ids, worker URLs, provider names, queue ids, or raw errors.

### 4. Worker Checkpoint Execution

- [ ] Add worker source tests for one-checkpoint invocation, claim capacity,
      retryable checkpoint failure, non-retryable checkpoint failure, and next
      checkpoint activation.
- [x] Add checkpoint handler coverage tests that compare declared worker
      checkpoint keys with `processClaimedCheckpoint` handlers and require an
      explicit PLAN-0068 justification for any intentionally unhandled
      executable checkpoint.
- [x] Refactor any remaining broad pump behavior into dispatch-only
      orchestration or remove it from the normal flow.
- [ ] Refactor room validation, room cleaning, corners, dimension-guide,
      placement generation, placement measurement, and placement finalization
      into bounded checkpoints.
- [x] Split `dimension_guide` out of `room_corners`: the corners checkpoint now
      validates and uploads the provider corner artifact, then a separate
      guide checkpoint downloads that artifact, draws dimension lines, uploads
      the guide image, and completes room preparation without replaying the
      corners provider call.
      Current intentionally unhandled executable checkpoints:
      - `placement_measurement`: still folded into `placement_generation`;
        split pending so measurement can fail/retry without replaying image
        generation.
      - `placement_finalize`: still folded into `placement_generation`; split
        pending so final persistence can fail/retry without replaying image
        generation or measurement.
- [ ] Add worker timeout tests proving multi-attempt provider loops are split
      across persisted checkpoint attempts.
- [x] Preserve previous successful output when a regeneration checkpoint fails.
- [x] Resolve placement prepared sofa bytes from `prepared_sofa_asset_id` when
      `prepared_sofa_path` is absent, so catalogue render/source assets can feed
      the placement provider after dimension submission.
- [x] Align worker HEIC/HEIF detection with public upload validation by scanning
      both the primary `ftyp` brand and compatible brands before conversion.
- [x] Load the HEIC decoder from a runtime-resolvable WASM bundle and emit an
      explicit worker log when room validation cannot convert HEIC/HEIF input.

### 5. Realtime And Frontend Progress

- [x] Add Realtime access tests proving one visitor cannot subscribe to another
      visitor's progress.
- [ ] Add frontend tests for progress rendering, fallback polling, foreground
      refresh, offline/online recovery, and signed URL refresh through the
      status endpoint.
- [x] Use the latest visitor-safe Realtime progress payload to render specific
      loading copy for room preparation and placement while keeping signed URLs
      on the HTTP status endpoint.
- [x] Keep a slow signed-status reconciliation read while Realtime is connected
      so a missed progress event cannot strand the visitor on stale loading UI.
- [x] Convert HEIC/HEIF photos to browser-previewable JPEG on selection when
      the browser cannot display the original file, while falling back to the
      server preview-normalization endpoint when local conversion is
      unavailable.
- [x] Surface public upload failure diagnostics in the browser with structured
      console logs plus visible API code, HTTP status, server message, and
      attempt count.
- [x] Surface visitor-safe failed-job diagnostics on the terminal simulation
      screen without exposing worker internals, provider names, storage paths,
      or raw module errors.
- [ ] Ensure Realtime payloads contain only safe step keys, public status,
      ordinal/total progress, action-required flags, result/guide availability,
      retention deadline, and timestamps.
- [ ] Ensure the browser refreshes the status endpoint for guide and result
      signed URLs instead of reading URLs from Realtime.

### 6. Recovery, Purge, And Cost Controls

- [x] Remove in-home simulation worker cron runners from migrations and deploy
      workflow.
- [x] Keep dispatch recovery RPCs able to recover expired checkpoint claims and
      redispatch claimable backlog when explicitly woken.
- [x] Add tests for recovery when an API or worker dispatch wake-up was missed.
- [x] Add tests for cost-meter pause leaving checkpoints visible, delayed, and
      recoverable rather than failed.
- [x] Update purge behavior so expired simulations redact or delete checkpoint
      attempts and public progress consistently with artifacts and session data.
- [x] Add purge tests covering progress rows, checkpoint attempts, and private
      artifacts.

### 7. Verification And Closure

- [x] Update roadmaps for `api`, `supabase`, `image-worker`, `web`, and
      `workflow` after each slice.
- [x] Run focused migration, worker, API, Realtime, and frontend tests.
- [x] Run `pnpm spec:check`.
- [x] Run relevant package typechecks.
- [x] Manually verify the local browser happy path with a real HEIC upload,
      OpenAI room preparation, dimension submission, first placement result,
      and one regeneration.
- [x] Run `pnpm test` and `pnpm build` before closing the plan.
- [ ] Move this plan to `docs/plans/done` only after request-time pump and
      worker cron paths are removed from the public simulation flow and recovery
      behavior is verified.

## Tests

Focused tests to add or update:

```bash
pnpm vitest run scripts/in-home-simulation-checkpoint-pump-migration.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-claim.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-pump-status.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-success.test.mjs
pnpm vitest run scripts/in-home-simulation-worker-pump.test.mjs
pnpm vitest run scripts/in-home-simulation-remove-worker-crons-migration.test.mjs
pnpm vitest run scripts/in-home-simulation-realtime-progress.test.mjs
pnpm --filter @mobel-unique/web test -- src/lib/simulation-public-route-handlers.test.ts
pnpm --filter @mobel-unique/web test -- src/app/simulations/[simulation_job_id]/PublicSimulationContinuation.test.tsx
```

Existing related tests that should remain green or be intentionally updated:

```bash
pnpm vitest run scripts/in-home-simulation-stage-1-checkpoint.test.mjs
pnpm vitest run scripts/in-home-simulation-openai-fetch.test.mjs
pnpm vitest run scripts/in-home-simulation-worker-internal-fetch-timeouts.test.mjs
pnpm vitest run scripts/in-home-simulation-recovery-cron.test.mjs
pnpm vitest run scripts/in-home-simulation-requeue-recovered-jobs-migration.test.mjs
pnpm vitest run scripts/simulation-public-api-rpc-migration.test.mjs
```

Manual verification before PLAN-0042 launch sign-off:

- Back-wall happy path from upload to result with Realtime progress.
- Corner happy path from upload to result with Realtime progress.
- Regeneration while previous result remains visible.
- Realtime disconnect followed by fallback polling.
- Missed dispatch followed by explicit dispatch retry or operator recovery.
- Expired claim recovery for every checkpoint type.
- RLS negative test with a second visitor token.
- Cost-meter pause leaves work recoverably delayed.

## Roadmap

Update these roadmaps as implementation lands:

- `docs/roadmap/api.md`
- `docs/roadmap/image-worker.md`
- `docs/roadmap/supabase.md`
- `docs/roadmap/web.md`
- `docs/roadmap/workflow.md`

## Notes

- The old pump-based CR remains historical context. The new database-dispatch
  CR is the target architecture for remaining work.
- Do not reintroduce in-home simulation worker cron behavior for visitor-facing
  execution.
- The Realtime contract must be privacy-reviewed before launch.
- The public UI must not show provider names, prompt names, raw worker errors,
  storage paths, queue ids, dispatch ids, worker URLs, or signed URLs.
