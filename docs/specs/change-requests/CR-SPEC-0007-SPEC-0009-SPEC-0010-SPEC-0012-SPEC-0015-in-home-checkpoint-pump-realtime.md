# CR-SPEC-0007 SPEC-0009 SPEC-0010 SPEC-0012 SPEC-0015 In-Home Checkpoint Pump And Realtime Progress

Target spec ids: SPEC-0007, SPEC-0009, SPEC-0010, SPEC-0012, SPEC-0015
Related spec ids: SPEC-0003, SPEC-0004, SPEC-0006
Status: proposed

## Reason For Change

The current in-home simulation implementation is close to the required product
flow, but the worker execution model is still too dependent on scheduled
pickup and long-running provider calls. The production path should be more
deterministic for visitors:

- a public action should start the relevant worker work immediately;
- recurring cron should recover and backstop work, not be the main execution
  path;
- each expensive AI operation should run inside a bounded checkpoint so one
  Edge Function invocation does not hold the whole room-preparation or
  placement pipeline;
- durable database state must remain the source of truth when a queue message,
  worker invocation, browser tab, or Edge isolate disappears;
- the visitor should see live progress updates without aggressive fixed polling;
- Realtime exposure must be scoped to one verified visitor's job and must not
  leak private paths, provider metadata, prompts, worker internals, or another
  visitor's state.

The admin fabric render system already proved a stronger pattern: explicit
service-side worker pump invocation, one-job worker invocations, database
capacity controls, Realtime observation, and manual or automatic resumption when
queued work remains. The public in-home simulation flow should adopt the same
core system shape, with stricter automation and privacy boundaries because no
operator is present in the public visitor flow.

## Proposed Change

### Architecture Contract

Update the affected specs so the in-home simulation execution path becomes:

```text
Public API action
  -> validate visitor session, rate limits, idempotency, and catalog selection
  -> create or update durable job state in the database
  -> enqueue or mark the next checkpoint as claimable
  -> invoke the in-home simulation worker pump immediately as best effort
  -> return the simulation job id or updated state to the visitor

Worker pump
  -> inspect durable database state
  -> respect global provider capacity and cost-meter pause state
  -> start one-checkpoint worker invocations up to available capacity
  -> stop quickly when no claimable work is available

Worker checkpoint invocation
  -> atomically claim one checkpoint for one job
  -> execute only that checkpoint's bounded work
  -> persist artifacts, progress, events, attempts, and next checkpoint state
  -> invoke pump again when another checkpoint can proceed

Cron or scheduler
  -> recover expired claims
  -> requeue or re-mark claimable checkpoints when needed
  -> invoke pump for remaining backlog
  -> never be the normal latency path for new visitor work
```

The durable job row and checkpoint tables are the source of truth. Queue
messages are an optimization and a wake-up mechanism, not the authority for
whether a job can proceed.

### SPEC-0007 Worker Changes

Update `SPEC-0007` so the in-home simulation worker is defined as a
checkpoint-based pump and worker system rather than a broad two-stage queue
consumer.

The public job statuses may remain:

- `queued`;
- `room_prep_processing`;
- `awaiting_dimensions`;
- `placement_queued`;
- `placement_processing`;
- `succeeded`;
- `failed`;
- `canceled`;
- `expired`.

Add an internal checkpoint model, exposed to visitors only through safe progress
labels:

- `room_validation`;
- `room_cleaning`;
- `room_corners`;
- `dimension_guide`;
- `awaiting_dimensions`;
- `placement_generation`;
- `placement_measurement`, only when the feedback loop is active;
- `placement_finalize`;
- `completed`;
- `failed`;
- `expired`.

The worker must enforce these rules:

- pump mode is short-lived orchestration and must not call AI providers;
- checkpoint mode processes one job checkpoint per invocation;
- a checkpoint invocation should make at most one expensive image-generation or
  vision provider call unless a later accepted spec explicitly approves a
  bounded exception;
- multi-attempt AI loops must be represented as persisted checkpoint attempts,
  not as several long provider calls inside one Edge invocation;
- checkpoint attempts must record attempt number, provider role, safe error
  code, retryability, started time, completed time, and claim expiration;
- a retryable checkpoint failure returns the checkpoint to a claimable state if
  attempts remain;
- a non-retryable failure moves the simulation to the appropriate failed state;
- a failed regeneration after a previous successful output still returns to
  `succeeded` and keeps the latest result available while retained;
- regeneration must reserve the next generation index before placement work and
  clear it on success or failure according to existing regeneration rules;
- the cron recovery path must recover expired checkpoint claims and invoke pump
  for recovered work;
- a job that is `queued` or `placement_queued` but has no queue message must
  still be discoverable and processable by the pump or recovery path.

The worker must publish safe progress changes when:

- a checkpoint becomes claimable;
- a checkpoint is claimed;
- a checkpoint succeeds;
- a checkpoint is retried;
- a checkpoint reaches a terminal failure;
- the job reaches `awaiting_dimensions`, `succeeded`, `failed`, `canceled`, or
  `expired`.

### SPEC-0009 Data Model Changes

Update `SPEC-0009` to add durable checkpoint and public progress support.

The implementation may add either columns on `in_home_simulation_jobs` or a
dedicated checkpoint table, but the data model must support:

- current checkpoint;
- current checkpoint status, such as `queued`, `processing`, `succeeded`,
  `retrying`, or `failed`;
- checkpoint attempt count and maximum attempts;
- checkpoint claim owner and claim expiration;
- checkpoint started and completed timestamps;
- safe progress step key;
- progress ordinal and total step count for UI display;
- progress update timestamp;
- last safe progress message key;
- retryable versus non-retryable failure classification;
- indexes for claimable checkpoints ordered by queued time;
- indexes for active processing checkpoints and expired claims;
- indexes for visitor-scoped progress lookup by simulation job id and session
  capability.

Add a public-safe Realtime surface. This may be a dedicated table such as
`simulation_public_progress` or an equivalent Realtime-safe projection. It must
contain only fields that are safe for the owning visitor:

- simulation job id or opaque public job id;
- public job status;
- current progress step key;
- progress ordinal;
- progress total;
- whether visitor action is required;
- whether a guide is available;
- whether a latest result is available;
- whether regeneration remains available;
- retention deadline;
- updated timestamp.

The Realtime surface must not contain:

- private storage paths;
- signed URLs;
- provider names, provider models, or prompt versions;
- raw worker errors;
- queue message ids;
- service or worker identifiers;
- another visitor's progress state.

RLS must prevent a public visitor from subscribing to another visitor's
simulation progress. If Supabase Realtime requires a JWT claim to enforce this,
the API must issue a short-lived simulation realtime token scoped to one job and
one verified simulation session. The token must authorize only the Realtime
progress surface and must not authorize direct reads of private simulation
tables or storage.

### SPEC-0010 API Changes

Update public simulation API contracts so worker start is event-driven.

`POST /api/public/simulations` must:

- create the durable job and first checkpoint state;
- enqueue or mark the first checkpoint as claimable;
- invoke the in-home simulation worker pump immediately as best effort;
- return `202 Accepted` or an equivalent accepted response once durable state is
  created;
- keep the job queued if the immediate pump invocation fails, because the
  scheduler backstop must be able to recover it;
- return a safe degraded-start indicator only when useful to the frontend and
  never expose worker internals.

`POST /api/public/simulations/{simulation_job_id}/dimensions` must:

- persist dimensions atomically;
- create or mark the placement checkpoint as claimable;
- invoke the worker pump immediately as best effort;
- remain idempotent for safe client retries.

`POST /api/public/simulations/{simulation_job_id}/regenerations` must:

- reserve the next generation index atomically;
- create or mark the placement checkpoint as claimable;
- invoke the worker pump immediately as best effort;
- keep the latest previous result visible while the new generation is in
  progress.

`GET /api/public/simulations/{simulation_job_id}` remains required as the
authoritative read fallback and as the only source for short-lived signed guide
and result URLs.

Add a Realtime access contract. The implementation may use either:

- an explicit endpoint such as
  `POST /api/public/simulations/{simulation_job_id}/realtime-token`; or
- a `realtime` object returned by the status endpoint.

The contract must provide only what the browser needs to subscribe to the
visitor-safe progress surface:

```json
{
  "simulation_job_id": "opaque-job-id",
  "channel": "simulation-progress",
  "topic": "job-scoped-topic-or-table-filter",
  "expires_at": "2026-05-07T12:00:00Z"
}
```

The API must not place simulation access tokens in URLs and must not expose
service-role credentials, private bucket paths, or worker function names.

### SPEC-0012 Frontend Changes

Update public frontend flow specs so Realtime progress is the preferred
observation path and HTTP polling is a fallback.

The simulation continuation page must:

- subscribe to the job-scoped Realtime progress surface after job creation or
  page resume;
- render progress based on safe progress step keys;
- refetch the status endpoint when progress indicates an action state or
  terminal state, because signed URLs are delivered only through the API;
- fall back to bounded HTTP polling with backoff when Realtime is unavailable,
  disconnected, or unsupported;
- pause or soften observation when the browser is offline or the page is
  hidden;
- perform a status refresh when the page becomes visible again;
- stop live observation when the job reaches a terminal state or when the
  visitor leaves the flow.

The UI must not show exact percentages unless the backend provides a defensible
step count. Prefer step-based progress such as preparation, room cleanup,
guide creation, placement, and finalization.

### SPEC-0015 Wizard Changes

Update `SPEC-0015` to replace fixed two-second polling as the nominal behavior.

The wizard must:

- use upload progress from the browser upload request before job creation;
- use Realtime progress after job creation;
- keep HTTP status polling as a compatibility fallback;
- show progress steps for room preparation and placement;
- avoid exposing provider names, worker internals, private storage paths, or raw
  errors in progress text;
- refresh signed guide and result URLs through the status endpoint when needed;
- keep regeneration-in-progress behavior unchanged: the previous successful
  result stays visible while a new placement checkpoint runs;
- keep the existing generation limit of three successful outputs per simulation
  attempt.

## Impact

- Specs: `SPEC-0007`, `SPEC-0009`, `SPEC-0010`, `SPEC-0012`, and `SPEC-0015`
  need direct updates after this change request is accepted.
- API: public simulation create, dimensions, and regeneration endpoints must
  invoke the worker pump as best effort and expose a Realtime access contract.
- Database: migrations are needed for checkpoint state, claim indexes, Realtime
  publication, and visitor-safe RLS.
- Worker: the in-home simulation Edge Function needs pump mode, one-checkpoint
  job mode, persisted attempts, global capacity controls, and recovery support.
- Realtime: visitor progress must be delivered through a job-scoped, RLS-safe
  surface. Signed URLs must stay API-only.
- UI: continuation screens should render live step progress and use polling
  only as fallback.
- Cron: the existing worker runner should become a backlog/backstop runner, and
  the recovery cron should remain a watchdog.
- Tests: follow-up plans must cover pump start on API actions, one-checkpoint
  processing, expired-claim recovery, orphan queued discovery, Realtime RLS,
  fallback polling, and no private data leakage.
- Roadmaps: `api`, `supabase`, `image-worker`, `web`, and `workflow` roadmaps
  should be updated by the implementation plans.

## Follow-Up Implementation Slices

1. Data model and Realtime access foundation.
2. Worker pump and checkpoint claim RPCs.
3. Worker checkpoint execution refactor.
4. Public API pump invocation and realtime token contract.
5. Frontend Realtime progress and polling fallback.
6. Recovery, backlog, purge, and launch verification.

## Approval Note

Pending approval. This change request captures the intended direction after
architecture review of the in-home simulation timeout and queue behavior. The
goal is to keep the public visitor flow responsive while making the worker
pipeline resilient to queue gaps, provider timeouts, Edge Function wall-clock
limits, browser disconnects, and scheduler delays.
