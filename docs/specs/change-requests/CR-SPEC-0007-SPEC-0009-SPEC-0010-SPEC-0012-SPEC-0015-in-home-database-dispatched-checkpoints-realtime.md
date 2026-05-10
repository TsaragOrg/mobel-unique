# CR-SPEC-0007 SPEC-0009 SPEC-0010 SPEC-0012 SPEC-0015 In-Home Database-Dispatched Checkpoints And Realtime Progress

Target spec ids: SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Related spec ids: SPEC-0003, SPEC-0004, SPEC-0008
Status: accepted
Implementation Plans: PLAN-0068

## Reason For Change

The accepted checkpoint pump change moved the in-home simulation system in the
right direction by making durable checkpoint state authoritative and by exposing
visitor-safe Realtime progress. Local front-driven testing then exposed an
important architecture weakness: public API requests still try to invoke a
worker pump immediately after writing durable state.

That request-time pump is not the right boundary for the public simulation
flow:

- the public API should finish after validating the visitor action and writing
  committed database state;
- browser latency and API success should not depend on worker cold start,
  worker acknowledgement, or a short abort timeout;
- Realtime is an observation channel and must not be treated as a job execution
  mechanism;
- scheduled cron is not an acceptable execution mechanism for the
  visitor-facing in-home simulation path;
- durable checkpoint dispatch should be triggered by committed database state,
  with idempotent recovery when a dispatch notification is lost.

The stronger system boundary is API-woken checkpoint execution backed by a
transactional outbox: public API actions write checkpoint state transactionally,
then wake a short internal dispatcher. Workers process one bounded checkpoint
per invocation, and Realtime reflects progress to the visitor.

## Proposed Change

### Architecture Contract

Replace request-time worker pump invocation with an API-woken dispatch contract
backed by a transactional database outbox:

```text
Public API action
  -> validate visitor session, rate limits, idempotency, catalog selection
  -> write or update durable job and checkpoint state in one database mutation
  -> wake the internal worker dispatcher immediately after commit
  -> return without running checkpoint/provider work

Worker dispatch
  -> claim transactional outbox rows after the API wake-up
  -> call one internal checkpoint worker invocation per claimed row
  -> include only the checkpoint id, job id, and service secret
  -> never call OpenAI providers

Worker checkpoint invocation
  -> atomically claim one checkpoint for one job
  -> execute only that checkpoint's bounded work
  -> persist artifacts, progress, events, attempts, and next checkpoint state
  -> cause the next checkpoint to become claimable when the pipeline can proceed

Realtime progress
  -> publish safe progress metadata from durable database state
  -> trigger client status refresh when signed guide or result URLs are needed

Recovery
  -> recover expired claims
  -> redispatch claimable backlog through explicit service-side dispatch
  -> never depend on scheduled cron for normal visitor progress
```

The durable job row and checkpoint rows remain the source of truth. Dispatch
wake-ups and queue messages are delivery mechanisms, not authority. Losing a
dispatch wake-up must leave the job recoverable.

### Chosen Dispatch Mechanism

Use a transactional database outbox as the durable dispatch handoff.

When a public API mutation creates or marks a checkpoint claimable, the same
database transaction must insert or upsert a dispatch outbox row for that
checkpoint. The outbox row is the durable record that work needs to be
dispatched. Immediate delivery is started by the public API after the database
mutation commits. That service-side wake-up is not authoritative; the outbox row
is.

The outbox must support:

- one active dispatch intent per checkpoint;
- dispatch status such as `pending`, `dispatching`, `dispatched`, `retrying`,
  `failed`, or `dead`;
- attempt count, max attempts, next-attempt timestamp, and last safe error code;
- short dispatcher locks so multiple dispatchers cannot send the same outbox
  row concurrently;
- indexes for pending dispatch rows ordered by next-attempt timestamp;
- a service-role-only claim/mark-dispatched/mark-failed RPC surface;
- idempotent insertion so retrying the public API mutation cannot create
  duplicate dispatch work for the same checkpoint.

The dispatcher must be small. It may claim one or more outbox rows, invoke the
internal one-checkpoint worker endpoint for each claimed row, and then mark the
outbox row dispatched or retryable. It must not call OpenAI providers itself.

The dispatch recovery path must scan the same outbox plus checkpoint state to:

- redispatch pending rows that missed an API or worker wake-up;
- release stale dispatcher locks;
- recover expired checkpoint claims;
- recreate missing outbox rows for claimable checkpoints when a prior migration,
  failed transaction, or bug left the checkpoint without a dispatch row.

Local development must use the same outbox table and RPC semantics. Browser
testing must not require a local watch loop; public API routes wake the local
worker dispatcher directly. A manual one-shot dispatch command may exist for
operator diagnostics, but it is not part of the visitor workflow.

### Public API Changes

Public simulation API handlers must not wait on worker pump acknowledgement.
They must:

- write durable state through service-role server code only;
- create or mark exactly the next checkpoint as claimable;
- wake the internal worker dispatcher after durable state is committed;
- return a successful visitor response only when the durable write and dispatch
  wake-up have both succeeded;
- expose only safe accepted/degraded state when dispatch is delayed;
- keep `GET /api/public/simulations/{simulation_job_id}` as the authoritative
  fallback and signed URL source;
- avoid returning worker function names, dispatch ids, queue ids, provider
  names, private paths, or raw errors.

The API may call a database RPC that both mutates job state and inserts an
outbox/dispatch row inside the same transaction. It may call the worker in
`dispatch` mode after commit, but it must not call a worker pump or checkpoint
provider path directly after the mutation.

### Worker Changes

The in-home worker should keep a one-checkpoint execution mode. The request-time
`pump` mode must be removed or reduced to an internal recovery-only dispatcher
that is not called by public API route handlers.

Worker checkpoint execution must:

- claim one eligible checkpoint atomically;
- make at most one expensive provider call per invocation unless a later
  accepted spec explicitly approves a bounded exception;
- persist attempt metadata before and after provider work;
- record retryable versus terminal failures;
- make the next checkpoint claimable only after the current checkpoint commits
  successfully;
- preserve the latest successful result when a regeneration fails.

### Realtime Changes

Realtime remains the visitor progress channel, not the execution engine.

The frontend must:

- subscribe to a job-scoped, visitor-safe progress surface;
- render progress from safe progress step keys;
- refresh the status endpoint when progress reaches action-required or terminal
  states;
- keep bounded polling as fallback for Realtime disconnects, offline/online
  transitions, and signed URL refresh;
- never receive signed URLs, private paths, provider metadata, worker function
  names, or raw worker errors through Realtime.

### Recovery And Purge

Recovery must:

- find claimable checkpoints that missed dispatch;
- recover expired checkpoint claims;
- redispatch backlog without duplicating work;
- respect cost-meter pause and global provider capacity;
- be available through explicit service-side dispatch or operator tooling, not a
  scheduled cron runner.

Purge and expiration must remove or redact public progress, checkpoint attempts,
and private artifacts consistently with the retained job lifecycle.

## Impact

- API: removes direct public route-handler dependency on worker pump
  acknowledgement.
- Supabase: adds or revises transactional dispatch outbox state and recovery
  RPCs without a scheduled in-home worker cron runner.
- Worker: keeps bounded checkpoint execution but removes request-time pump as
  the normal product path.
- Frontend: keeps Realtime progress plus HTTP fallback; no browser worker
  invocation.
- Local development: the browser path uses the same API-triggered dispatch as
  DEV and PROD; one-shot operator tooling may drain the same durable outbox.

## Acceptance Criteria

- Creating a simulation job writes the first checkpoint and returns without
  calling a worker pump from the public API handler.
- Submitting dimensions writes the placement checkpoint and returns without
  calling a worker pump from the public API handler.
- Requesting regeneration writes the placement checkpoint and returns without
  calling a worker pump from the public API handler.
- A committed checkpoint is dispatched by the API-triggered worker wake-up in
  normal operation.
- Losing a dispatch wake-up leaves the checkpoint claimable and recoverable by
  explicit dispatch retry or operator recovery, without scheduled cron.
- Realtime progress updates are scoped to the owning visitor and contain no
  private paths, signed URLs, provider metadata, worker internals, or raw
  errors.
- Each worker invocation processes only one bounded checkpoint and does not run
  a multi-provider loop inside one Edge Function invocation.
- Recovery handles expired checkpoint claims and claimable backlog without
  duplicating successful work.
- Purge and expiration remove or redact checkpoint/progress state consistently.
