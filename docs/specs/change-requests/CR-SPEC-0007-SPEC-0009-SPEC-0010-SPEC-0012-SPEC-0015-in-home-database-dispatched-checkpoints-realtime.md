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
- cron every minute is acceptable as recovery, but it is too coarse as the
  normal start path for a visitor-facing simulation;
- durable checkpoint dispatch should be triggered by committed database state,
  with idempotent recovery when a dispatch notification is lost.

The stronger system boundary is database-dispatched checkpoint execution:
public API actions write checkpoint state transactionally, the database emits a
post-commit dispatch signal, workers process one bounded checkpoint per
invocation, and Realtime reflects progress to the visitor.

## Proposed Change

### Architecture Contract

Replace request-time worker pump invocation with a database-dispatched
checkpoint contract:

```text
Public API action
  -> validate visitor session, rate limits, idempotency, catalog selection
  -> write or update durable job and checkpoint state in one database mutation
  -> return after the database commit succeeds

Database dispatch
  -> observe newly claimable checkpoint state after commit
  -> call a small internal dispatch endpoint or worker checkpoint endpoint
  -> include only the checkpoint id, job id, dispatch id, and service secret
  -> never call OpenAI providers

Worker checkpoint invocation
  -> atomically claim one checkpoint for one job
  -> execute only that checkpoint's bounded work
  -> persist artifacts, progress, events, attempts, and next checkpoint state
  -> cause the next checkpoint to become claimable when the pipeline can proceed

Realtime progress
  -> publish safe progress metadata from durable database state
  -> trigger client status refresh when signed guide or result URLs are needed

Recovery backstop
  -> recover expired claims
  -> redispatch claimable backlog that missed a database dispatch signal
  -> run on a schedule only as recovery, not as the normal latency path
```

The durable job row and checkpoint rows remain the source of truth. Dispatch
signals, webhooks, `pg_net` calls, or queue messages are delivery mechanisms,
not authority. Losing a dispatch signal must leave the job recoverable.

### Chosen Dispatch Mechanism

Use a transactional database outbox as the durable dispatch handoff.

When a public API mutation creates or marks a checkpoint claimable, the same
database transaction must insert or upsert a dispatch outbox row for that
checkpoint. The outbox row is the durable record that work needs to be
dispatched. Immediate delivery may be started by a database-originated signal
such as a trigger, database webhook, or `pg_net` call to a lightweight internal
dispatcher, but that signal is not authoritative.

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

The scheduled backstop must scan the same outbox plus checkpoint state to:

- redispatch pending rows that missed the immediate database-originated signal;
- release stale dispatcher locks;
- recover expired checkpoint claims;
- recreate missing outbox rows for claimable checkpoints when a prior migration,
  failed transaction, or bug left the checkpoint without a dispatch row.

Local development must use the same outbox table and RPC semantics. If local
Supabase cannot reliably execute the immediate database-originated signal, the
local dispatcher/backstop command may be run manually, but it must drain the
same outbox rows that DEV and PROD use.

### Public API Changes

Public simulation API handlers must not wait on worker pump acknowledgement.
They must:

- write durable state through service-role server code only;
- create or mark exactly the next checkpoint as claimable;
- return a successful visitor response once durable state is committed;
- expose only safe accepted/degraded state when dispatch is delayed;
- keep `GET /api/public/simulations/{simulation_job_id}` as the authoritative
  fallback and signed URL source;
- avoid returning worker function names, dispatch ids, queue ids, provider
  names, private paths, or raw errors.

The API may call a database RPC that both mutates job state and inserts an
outbox/dispatch row inside the same transaction. It must not call a worker pump
directly after the mutation.

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
- be safe to run every minute as a backstop.

Purge and expiration must remove or redact public progress, checkpoint attempts,
and private artifacts consistently with the retained job lifecycle.

## Impact

- API: removes direct public route-handler dependency on worker pump
  acknowledgement.
- Supabase: adds or revises a database-originated dispatch mechanism and
  recovery backstop.
- Worker: keeps bounded checkpoint execution but removes request-time pump as
  the normal product path.
- Frontend: keeps Realtime progress plus HTTP fallback; no browser worker
  invocation.
- Local development: needs a documented way to run the database dispatch path
  locally or a deterministic local fallback that preserves the same durable
  state transitions.

## Acceptance Criteria

- Creating a simulation job writes the first checkpoint and returns without
  calling a worker pump from the public API handler.
- Submitting dimensions writes the placement checkpoint and returns without
  calling a worker pump from the public API handler.
- Requesting regeneration writes the placement checkpoint and returns without
  calling a worker pump from the public API handler.
- A committed checkpoint is dispatched automatically from database-originated
  state in normal operation.
- Losing the dispatch signal leaves the checkpoint claimable and recoverable by
  the scheduled backstop.
- Realtime progress updates are scoped to the owning visitor and contain no
  private paths, signed URLs, provider metadata, worker internals, or raw
  errors.
- Each worker invocation processes only one bounded checkpoint and does not run
  a multi-provider loop inside one Edge Function invocation.
- Recovery handles expired checkpoint claims and claimable backlog without
  duplicating successful work.
- Purge and expiration remove or redact checkpoint/progress state consistently.
