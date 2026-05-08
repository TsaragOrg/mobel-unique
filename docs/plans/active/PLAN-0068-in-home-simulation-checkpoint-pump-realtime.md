# PLAN-0068 In-Home Simulation Database-Dispatched Checkpoints And Realtime

Plan: PLAN-0068
Spec: SPEC-0007
Related specs: SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Related change requests:

- CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-checkpoint-pump-realtime
- CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015-in-home-database-dispatched-checkpoints-realtime

Status: active
Owner area: supabase
Affected packages:

- `apps/web`
- `supabase/functions/in-home-simulation-worker`
- `supabase/migrations`
- `scripts`
- `docs/roadmap`

## Goal

Move the public in-home simulation system from request-time worker pumping to
database-dispatched checkpoints with visitor-safe Realtime progress.

The API should write durable state and return. The database should emit or
record dispatchable checkpoint work after commit. The worker should process one
bounded checkpoint per invocation. Realtime should keep the visitor connected to
safe progress state. Cron should exist only as recovery and backlog backstop.

## Current State

Already delivered under this plan:

- accepted checkpoint and Realtime spec changes for the first pump-based design;
- durable checkpoint and public progress schema foundations;
- checkpoint claim RPCs;
- checkpoint success and progress helper foundations;
- public API wrappers that create checkpoint state;
- public Realtime access contract and frontend subscription fallback;
- worker support for explicit pump/checkpoint modes;
- local timeout tuning for request-time pump invocation.

The design now needs correction before more implementation proceeds: public API
route handlers should not invoke a worker pump directly after writing durable
state. That coupling creates noisy aborts, ties visitor response behavior to
worker startup, and is the wrong boundary for a public workflow.

## Target Architecture

```text
Public API action
  -> validate visitor session, rate limits, idempotency, and catalog selection
  -> write job/checkpoint state and dispatch outbox intent in one database mutation
  -> return after commit succeeds

Database dispatch
  -> observes or drains transactional outbox rows after commit
  -> invokes one internal checkpoint worker for each claimed dispatch row
  -> marks dispatch rows as dispatched or retryable

Worker checkpoint invocation
  -> claims one checkpoint atomically
  -> executes one bounded unit of work
  -> persists artifacts, attempts, events, safe progress, and next checkpoint

Realtime progress
  -> broadcasts visitor-safe progress metadata only
  -> causes the browser to refresh status when signed URLs are needed

Recovery cron
  -> recovers expired checkpoint claims
  -> redispatches claimable backlog
  -> respects cost-meter pause and provider capacity
```

Realtime is not a job runner. It is only the observation layer. The database is
the execution source of truth.

## Architecture Decisions

- Public API handlers must not call the worker pump as the normal product path.
- Job creation, dimension submission, and regeneration must finish after
  committed durable state, not after worker acknowledgement.
- Checkpoint rows or checkpoint state columns are authoritative for work
  eligibility.
- Dispatch delivery uses a transactional database outbox. Public API mutations
  create or upsert the outbox row in the same transaction that makes a
  checkpoint claimable.
- Immediate delivery may be triggered by a database-originated signal, but the
  outbox row is authoritative. The scheduled backstop drains the same outbox
  and repairs missing dispatch rows for claimable checkpoints.
- Lost dispatch delivery must leave the checkpoint recoverable by scanning
  durable state.
- Worker invocations must process one checkpoint for one job.
- A checkpoint invocation should make at most one expensive OpenAI image or
  vision call. Multi-attempt loops must be persisted as separate checkpoint
  attempts.
- Public Realtime must use a visitor-safe progress surface and a scoped access
  contract. It must not expose `in_home_simulation_jobs` directly.
- Signed guide/result URLs stay API-only.
- Cron may run every minute as recovery, but it must not be the normal latency
  path for fresh visitor actions.

## Local Development Behavior

Local browser testing uses the same database outbox semantics as DEV and PROD:
public web routes write the job, checkpoint, progress projection, and dispatch
outbox row only. They do not call the worker function directly and do not need
in-home worker URL or invoke-secret variables in `apps/web/.env.example`.

When local Supabase does not provide an immediate database-originated dispatch
signal, the developer can drain the same outbox rows manually through the worker
dispatcher:

```bash
pnpm sim:dispatch:once
```

For browser testing, keep the local dispatcher backstop running in a separate
terminal:

```bash
pnpm sim:dispatch:watch
```

The helper calls only `in-home-simulation-worker` with `mode=dispatch`. It must
not be replaced by a public API route-handler pump. The local helper allows a
long request timeout because the local Edge Runtime can keep a dispatch request
open until the background checkpoint finishes; this is a local development
constraint, not the public route behavior.

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
      dispatcher/backstop.
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
      pending and recoverable by the backstop.

### 3. Public API Decoupling

- [x] Add route-handler tests proving `POST /api/public/simulations` writes the
      first checkpoint and does not call `invokeWorkerPump`.
- [x] Add route-handler tests proving dimensions and regeneration write
      placement checkpoints and do not call `invokeWorkerPump`.
- [x] Remove request-time worker pump invocation from public route handlers.
- [x] Replace `SIMULATION_WORKER_PUMP_TIMEOUT_MS` usage with dispatch/backstop
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
- [ ] Keep safe API responses when dispatch is delayed; never expose dispatch
      ids, worker URLs, provider names, queue ids, or raw errors.

### 4. Worker Checkpoint Execution

- [ ] Add worker source tests for one-checkpoint invocation, claim capacity,
      retryable checkpoint failure, non-retryable checkpoint failure, and next
      checkpoint activation.
- [x] Refactor any remaining broad pump behavior into internal recovery-only
      dispatch or remove it from the normal flow.
- [ ] Refactor room validation, room cleaning, corners, dimension-guide,
      placement generation, placement measurement, and placement finalization
      into bounded checkpoints.
- [ ] Add worker timeout tests proving multi-attempt provider loops are split
      across persisted checkpoint attempts.
- [ ] Preserve previous successful output when a regeneration checkpoint fails.
- [x] Resolve placement prepared sofa bytes from `prepared_sofa_asset_id` when
      `prepared_sofa_path` is absent, so catalogue render/source assets can feed
      the placement provider after dimension submission.
- [x] Align worker HEIC/HEIF detection with public upload validation by scanning
      both the primary `ftyp` brand and compatible brands before conversion.
- [x] Load the HEIC decoder from a runtime-resolvable WASM bundle and emit an
      explicit worker log when room validation cannot convert HEIC/HEIF input.

### 5. Realtime And Frontend Progress

- [ ] Add Realtime access tests proving one visitor cannot subscribe to another
      visitor's progress.
- [ ] Add frontend tests for progress rendering, fallback polling, foreground
      refresh, offline/online recovery, and signed URL refresh through the
      status endpoint.
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

- [x] Update recovery cron to recover expired checkpoint claims and redispatch
      claimable backlog.
- [x] Add tests for recovery when the database dispatch signal was missed.
- [ ] Add tests for cost-meter pause leaving checkpoints visible, delayed, and
      recoverable rather than failed.
- [ ] Update purge behavior so expired simulations redact or delete checkpoint
      attempts and public progress consistently with artifacts and session data.
- [ ] Add purge tests covering progress rows, checkpoint attempts, and private
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
- [ ] Move this plan to `docs/plans/done` only after the request-time pump path
      is removed from the public simulation flow and the recovery path is
      verified.

## Tests

Focused tests to add or update:

```bash
pnpm vitest run scripts/in-home-simulation-checkpoint-pump-migration.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-claim.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-pump-status.test.mjs
pnpm vitest run scripts/in-home-simulation-checkpoint-success.test.mjs
pnpm vitest run scripts/in-home-simulation-worker-pump.test.mjs
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
- Missed dispatch followed by cron recovery.
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
- Do not remove existing recovery cron behavior until database-dispatch recovery
  tests are green.
- The Realtime contract must be privacy-reviewed before launch.
- The public UI must not show provider names, prompt names, raw worker errors,
  storage paths, queue ids, dispatch ids, worker URLs, or signed URLs.
