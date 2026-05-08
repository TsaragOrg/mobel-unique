# SPEC-0007 In-Home Simulation Worker

Spec: SPEC-0007
Status: accepted
Layer: technical
Parent Spec: SPEC-0004
Depends On: SPEC-0001, SPEC-0003, SPEC-0004
Areas: api, supabase
Implementation Plans: PLAN-0010 (room preparation), PLAN-0011 (sofa placement), PLAN-0012 (resilience and purge), PLAN-0068 (database-dispatched checkpoints and realtime progress)
Last Reviewed: 2026-04-30

## Traceability

This spec defines the second technical contract for Supabase-hosted image job
processing, alongside the fabric render worker.

It follows `SPEC-0001 Repo Foundation`, which created the monorepo worker
boundary. The first production implementation for this spec uses Supabase Edge
Functions rather than the initial `workers/image` Node service foundation.

It follows `SPEC-0003 Business Context - AI Sofa Visualization`, which defines
the in-home simulation as a product invariant, requires customer room photo and
generated simulation output retention to remain at most 24 hours in the MVP,
requires proportionate anti-abuse protection for public simulation requests,
and lists the in-home simulation flow as a required follow-up specification
area.

It follows `SPEC-0004 Public Customer Experience`, which defines the public
simulation launch wizard, the prepared room intermediate state with visual
dimension guides, the required dimension collection step, the simulation
result display, the email verification gate before generation, and the MVP
regeneration limit.

It is a sibling to `SPEC-0006 Fabric Render Worker`, which defines the
admin-driven fabric render generation job using the same Supabase Edge
Functions, Supabase Queues, storage, and observability conventions. The two job
types have distinct inputs, retention rules, visibility rules, and failure
handling.

`CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015 In-Home Database-Dispatched Checkpoints And Realtime Progress`
updates this worker contract so cron is a recovery backstop rather than the
normal product latency path, and so expensive provider work is split into
durable checkpoints.

A future domain-level `In-Home Simulation Flow` spec may emerge later to
consolidate wizard rules, validation rules, dimension semantics, regeneration
counting, and failure-state UX. This worker contract intentionally focuses on
the server-side processing contract and references SPEC-0004 for the public
wizard.

The existing local Python bench at `mebel/worker_test/` is treated as a
reference implementation for the in-home simulation behavior. Its behavior can
be used to seed repository implementation once an implementation plan exists,
but Python is not the production runtime for this spec. The production
implementation must use Supabase Edge Functions written in TypeScript on the
Deno runtime, with Supabase Queues as the durable job queue. This spec does not
copy code and does not approve any implementation change by itself.

## Goal

Define the in-home simulation worker contract for generating a final
visualization of a selected catalog sofa placed in a customer's uploaded room
photo.

The worker must support the two-stage public simulation flow defined in
SPEC-0004 where:

- the customer first uploads a room photo and receives a dimension-guide image
  based on the cleaned room photo;
- the customer then provides the requested wall dimensions and receives a final placement
  of the previously selected sofa, fabric, and visual position.

The output is a generated room photo with the selected sofa placed against
the room's main wall or room corner at a size that matches the supplied wall
dimensions.

## Scope

This spec includes:

- the public in-home simulation job type;
- the two-stage processing model required to support the public wizard;
- the logical input and output artifact contract;
- the required job statuses including the wait between the two stages;
- the first AI provider and prompt versioning rules for the in-home simulation
  pipeline;
- storage ownership rules for inputs, intermediate artifacts, generated
  outputs, and worker scratch files;
- retry, failure, and idempotency expectations;
- regeneration limit enforcement per SPEC-0004;
- 24-hour retention enforcement per SPEC-0003;
- the Supabase Edge Functions and Supabase Queues runtime decision;
- how the existing local Python bench at `mebel/worker_test/` maps to the
  future repository behavior;
- the minimum environment variables required by the worker.

## Out Of Scope

This spec does not define:

- the public simulation wizard UI;
- email verification code delivery, email consent storage, or commercial
  contact consent storage;
- the anti-abuse mechanism details;
- the sofa, fabric, and visual position catalog data model;
- the fabric render preparation flow, which belongs to SPEC-0006;
- exact API routes;
- exact Supabase table definitions or migrations;
- exact Supabase Storage bucket names;
- admin authentication;
- ZIP export;
- pricing, cart, checkout, orders, or Shopify synchronization;
- a provider cost dashboard;
- a Python production worker runtime.

Those details must be covered by dedicated follow-up specs or implementation
plans when their parent behavior is approved.

## Users And Permissions

### Visitor

A visitor creates an in-home simulation through the public simulation flow
defined in SPEC-0004.

The visitor cannot call the worker directly, cannot read worker scratch
files, and cannot read another visitor's room photo, intermediate artifacts,
or generated output.

### Administrator

An administrator can review operational simulation activity through the
lightweight operational overview defined in SPEC-0003. The administrator
does not generate in-home simulations and does not consume the simulation
result on the visitor's behalf.

### API Service

The API service is expected to create and update in-home simulation job
records on behalf of the public flow.

The browser must not call the worker directly. The browser must not receive
worker credentials.

The API must enforce the SPEC-0003 anti-abuse posture before creating a
job, including the verified email simulation session required by SPEC-0004.

### Image Worker

The image worker runs with private server-side credentials. It may read
private input artifacts, call the configured AI providers, write generated
outputs, and update operational job status.

Service-role credentials and AI provider keys must remain server-side only.

## User Flow

This worker supports the public simulation flow defined by SPEC-0004
§Simulation Launch. The mapping from public wizard steps to worker activity
is:

1. The visitor confirms the selected sofa, fabric, and visual position, then
   completes email verification through the public flow. No worker activity.
2. After the visitor has a verified simulation session, the visitor uploads a
   room photo. The API creates an in-home simulation job, resolves and stores
   the prepared sofa asset reference for the selected sofa, fabric, and visual
   matrix column, and queues stage 1.
3. The worker claims the job, runs stage 1 room preparation, and stores the
   prepared room and the dimension-guide overlay.
4. The job status becomes `awaiting_dimensions`. The API exposes the
   dimension-guide overlay to the visitor through the public flow.
5. The visitor provides the requested wall dimensions through the wizard.
6. The API attaches the wall dimensions to the existing job and queues stage 2.
7. The worker claims the job again and runs stage 2 sofa placement.
8. On success, the worker stores the final result artifact and marks the
   job `succeeded`. The API exposes the final result to the visitor.
9. On failure, the worker stores the failure reason and marks the job
   `failed`. The API exposes a readable failure to the visitor and decides
   whether the visitor may retry within the SPEC-0004 regeneration limit.

When the retention deadline of 24 hours after job creation passes, the
system must purge all room photo, intermediate, and generated output
artifacts. After purge, the visitor must see the expired-result message
defined in SPEC-0004.

## Data Model

The exact Supabase table names, relationships, storage bucket names, storage
paths, and database constraints belong in a dedicated Supabase data model and
storage specification. This spec defines the logical data the worker contract
requires.

### In-Home Simulation Job

An in-home simulation job represents one attempt to render the visitor's
selected sofa, fabric, and visual position into the visitor's uploaded room.

The logical job record must track:

- job id;
- selected sofa id;
- selected fabric id;
- selected visual matrix column id;
- verified email simulation session or anti-abuse subject reference;
- private storage prefix for all job-owned simulation artifacts;
- prepared sofa asset reference resolved from the selected sofa, fabric,
  and visual position;
- customer room photo asset reference;
- normalized room asset reference;
- compressed room asset reference;
- cleaned room asset reference;
- room geometry mode, either `back_wall` or `corner`;
- room geometry confidence score returned by the scene classifier;
- room geometry failure reason when the room is not exploitable;
- room geometry point coordinates in the cleaned room pixel space, derived
  by detecting the yellow architectural-corner dots placed by the corners
  step on the cleaned room photo;
- back-wall anchor coordinates when mode is `back_wall`, as the four
  architectural corners of the main wall named `topLeft`, `topRight`,
  `bottomLeft`, and `bottomRight`;
- corner anchor coordinates when mode is `corner`, as the six points named
  `topLeft`, `topCenter`, `topRight`, `bottomLeft`, `bottomCenter`, and
  `bottomRight`. `topCenter` and `bottomCenter` mark the inner architectural
  corner where the two walls meet (ceiling and floor anchors of the inner
  vertical edge); the four outer points are the far ends of the two visible
  walls along ceiling and floor;
- the corners-annotated PNG (cleaned room with yellow dots) and the
  dimension-guide overlay PNG (cleaned room with width/height/depth lines
  and language-tagged labels) exposed to the visitor between stages;
- supplied dimensions in metres, with the following keys depending on mode:
  - `back_wall` mode requires `wall_width` and `wall_height`. Optional but
    recommended for placement quality: `room_depth` (camera-to-back-wall
    distance), `sofa_width`, `sofa_height`, and `position` (one of `left`,
    `center`, or `right`; defaults to `center`).
  - `corner` mode requires `left_wall_width`, `right_wall_width`, and
    `room_height`. Optional but recommended: `room_depth`, `sofa_left`,
    `sofa_right`, and `sofa_height`. Corner mode does not take a position
    keyword; the corner sofa is always anchored at the inner architectural
    corner.
  - Sofa dimensions are not strictly required for stage 2 to run, but the
    self-correcting placement loop only activates when full target ratios
    can be computed (see Stage 2);
- generated output asset references for each generated result, ordered by
  regeneration index;
- latest generated output index when at least one result exists;
- generated output count;
- reserved generation index when a placement or regeneration is in progress;
- status;
- regeneration count;
- room preparation attempt count;
- placement attempt count;
- maximum attempts per stage;
- claim expiration timestamp when a worker is processing the current stage;
- last error message;
- last regeneration error message;
- retention deadline computed as the job creation time plus the SPEC-0003
  retention window;
- created timestamp;
- claimed timestamp for each stage;
- stage transition timestamps.

The selected sofa, fabric, and visual matrix column must be the
catalog-managed selection captured by the public flow per SPEC-0004. The
visitor must not upload a sofa photo. The prepared sofa asset must be the
public-usable render that already exists for the selected visual matrix cell
at job creation time.

The dimension-guide overlay drawn at the end of stage 1 includes a depth
line ("Глубина") in addition to the wall and height lines. `room_depth`
is therefore presented to the visitor as an optional input that improves
the placement model's perspective scaling. It is not a hard requirement:
when omitted, the placement prompt receives "unspecified" for room depth
and the MVP still produces a usable result.

### Job Status

The required status values are:

- `queued`: stage 1 work is waiting for a worker;
- `room_prep_processing`: a worker has claimed stage 1;
- `awaiting_dimensions`: stage 1 succeeded and the worker is waiting for the
  visitor to provide dimensions;
- `placement_queued`: dimensions have been provided and stage 2 is waiting
  for a worker;
- `placement_processing`: a worker has claimed stage 2;
- `succeeded`: stage 2 produced the final output;
- `failed`: the job cannot continue without a new visitor or system action;
- `canceled`: the job was intentionally stopped before completion;
- `expired`: the SPEC-0003 retention deadline passed and all artifacts have
  been purged.

The `failed`, `canceled`, and `expired` statuses are operational. The
visitor-facing experience defined in SPEC-0004 must not treat any of them
as a public render state.

The implementation may add internal transition metadata, but it must
enforce that no generated output reaches the visitor while the job is in
any non-`succeeded` state.

### Checkpoint Progress

The public status values above are intentionally coarse. The worker must also
track an internal checkpoint so the system can resume safely after timeouts and
so the visitor can see progress without exposing worker internals.

The minimum checkpoint set is:

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

Checkpoint names are operational identifiers. Visitor-facing UI may map them
to safe progress labels, but must not expose provider names, prompt versions,
raw worker errors, queue ids, storage paths, or service identifiers.

Each checkpoint attempt must be durable enough to support recovery:

- checkpoint key;
- checkpoint status;
- attempt number and maximum attempts;
- worker claim owner and claim expiration;
- started and completed timestamps;
- retryable versus non-retryable failure classification;
- safe error code when failure is visible to the API;
- the next checkpoint to make claimable when the attempt succeeds.

The worker must publish safe progress changes whenever a checkpoint becomes
claimable, is claimed, succeeds, is retried, fails terminally, or moves the job
into a visitor-action or terminal state.

### Regeneration

A regeneration is a new placement attempt for the same job after a
`succeeded` state, requested by the visitor through the public flow per
SPEC-0004 §Simulation Launch.

A regeneration:

- reuses the previously stored cleaned room and room geometry points;
- reuses the previously stored prepared sofa asset;
- may reuse or update the wall dimensions if the visitor adjusted them before
  requesting regeneration;
- counts toward the SPEC-0004 MVP limit only when it successfully produces a
  generated output, with a maximum of three generated results per simulation
  attempt including the initial result;
- stores each generated result under a regeneration-indexed output path;
- must not extend the SPEC-0003 24-hour retention deadline beyond the
  original job creation time.

The worker must reject a regeneration request that would exceed the MVP
limit. The API is responsible for keeping the visible regeneration
affordance consistent with that limit per SPEC-0004.

The regeneration state transition must reuse the existing placement statuses
instead of introducing new public or operational statuses:

1. From `succeeded`, the API verifies that the job has not reached the MVP
   limit of three generated outputs.
2. The API atomically reserves the next regeneration index, stores it as the
   reserved generation index, and transitions the job to `placement_queued`.
3. The worker claims the job by transitioning it to `placement_processing`.
4. On success, the worker writes `output-{index}.png`, updates
   `latest_generated_output_index`, increments the generated output count, clears
   the reserved generation index, and transitions the job back to `succeeded`.
5. On failure when a previous generated output exists, the worker clears the
   reserved generation index, records the last regeneration error, and returns
   the job to `succeeded` so the previous result remains available to the
   visitor.
6. On failure when no previous generated output exists, the job becomes
   `failed`.

Technical retries of a placement attempt must not count as generated outputs.
Only a successfully persisted generated output consumes one of the three MVP
generated results.

In addition to the per-job simulation limit, the API must enforce visitor-session
anti-abuse limits before creating an initial simulation job or accepting a
regeneration request, and those limits must include the verified email
simulation session required by SPEC-0004. This protects the system from a
single visitor producing too many generated images by repeatedly starting new
jobs. The worker enforces the job-level limit for the work message it is
processing; the API owns cross-job visitor/session throttling.

The worker must not implement cross-job per-IP or per-session deduplication in
the MVP. Visitor-session anti-abuse and duplicate active simulation prevention
belong to the API layer because the API owns public request context, visitor
session context, and rate-limit decisions.

The persistent output paths for the MVP are:

```text
simulations/{job_id}/outputs/output-0.png
simulations/{job_id}/outputs/output-1.png
simulations/{job_id}/outputs/output-2.png
```

The API exposes the latest successful result by using the job's latest output
index. Earlier successful outputs may remain private and associated with the
same job until the retention purge runs, but the public flow does not need to
show a result history in the MVP.

### Generated Output Artifact

A generated output artifact must track:

- storage path or object key;
- content type;
- width;
- height;
- source type `ai_generated_in_home_simulation`;
- provider name;
- provider model;
- prompt version;
- regeneration index for traceability when more than one result was
  generated for the same job.

Generated outputs must remain private. They must not become part of any
public catalog asset and must not be reused outside the originating job.

## API

This spec does not approve final API route names. The API contracts spec
must define them.

Future API contracts must provide server-side behavior for:

- creating an in-home simulation job and storing the uploaded room photo in one
  server-side operation, only from a verified email simulation session, a
  confirmed sofa, fabric, and visual position selection, plus the uploaded room
  photo;
- attaching wall dimensions to the job and transitioning it from
  `awaiting_dimensions` to `placement_queued`;
- reading job status, stage-specific artifacts, and the latest generated
  result;
- requesting a regeneration within the SPEC-0004 MVP limit.

The MVP upload and job creation flow must be atomic from the visitor's
perspective:

- if the room photo upload fails, the API must not create a simulation job;
- if database job creation fails after the upload object was written, the API
  must immediately delete the uploaded object;
- if immediate deletion fails, a cleanup process must remove orphaned room
  upload objects older than one hour;
- the MVP must not add a public `upload_pending` job status.

The public frontend must learn simulation progress through API polling in the
MVP. After job creation, the API returns an opaque simulation identifier and
establishes the visitor's short-lived access capability for that simulation.
The frontend polls the API status endpoint for that simulation until the job
reaches a visitor-action state or terminal state.

The polling contract must support these frontend transitions:

- `queued` and `room_prep_processing`: continue waiting for stage 1;
- `awaiting_dimensions`: stop stage-1 polling and show the prepared room
  dimension-guide artifact;
- `placement_queued` and `placement_processing`: continue waiting for stage 2;
- `succeeded`: stop polling and show the latest generated result artifact;
- `failed`, `canceled`, or `expired`: stop polling and show the matching
  visitor-facing failure or expired state.

The polling cadence belongs in the API or frontend implementation plan, but it
must use a bounded backoff strategy rather than unbounded fixed-interval
polling. The frontend must stop polling when the simulation reaches a terminal
state, when the visitor leaves the flow, when the browser page is hidden for a
worker-defined grace period, or when an implementation-defined maximum wait is
reached.

The status endpoint may include short-lived signed URLs for the artifacts the
visitor is allowed to see at the current state, such as the dimension-guide
overlay in `awaiting_dimensions` or the latest generated result in `succeeded`.
Those URLs must be generated by the API from private storage and must not make
the underlying storage bucket public.

The API must:

- enforce the SPEC-0003 anti-abuse posture for public simulation requests
  before queueing work, including verified email simulation session
  requirements and visitor-session generation limits across initial simulation
  jobs and regeneration requests;
- validate that the selected sofa, fabric, and visual matrix column form a
  published public-usable triple at job creation time;
- never expose service-role credentials, AI provider keys, or storage write
  credentials to the browser;
- never expose intermediate or generated artifacts that belong to another
  visitor's job.

## Worker Jobs

### Job Type

The job type is `in_home_simulation`.

It runs in two stages, separated by an `awaiting_dimensions` checkpoint
that returns control to the visitor through the public wizard.

### Runtime And Queue

The first production implementation must run as Supabase Edge Functions written
in TypeScript on the Deno runtime.

Supabase Queues may provide durable wake-up messages, but queue messages are
not the source of truth for simulation progress. The durable database job row
and checkpoint state are authoritative for status, attempts, claims, retention,
and recovery.

The worker must support a dispatch mode and a checkpoint job mode:

- dispatch mode is short-lived orchestration. It claims transactional dispatch
  outbox rows, respects global provider capacity and cost-meter pause state,
  starts bounded one-checkpoint worker invocations, and exits quickly. It must
  not call AI providers or perform image generation.
- checkpoint job mode atomically claims one eligible checkpoint for one job,
  performs only that checkpoint's bounded work, persists artifacts and progress,
  and wakes dispatch mode when another checkpoint can proceed.

Public API actions that create the initial job, submit dimensions, or request a
regeneration must write a checkpoint and dispatch outbox row in the same
database transaction. Public API handlers must not wait on worker acknowledgement
or invoke the worker directly. Scheduler invocation remains required as a
watchdog and backlog backstop, but it must drain the same outbox rows instead
of being the normal latency path for new visitor work.

A job that is `queued` or `placement_queued` but has no live queue message must
still be discoverable and processable by dispatch or recovery logic.

The queue consumer function may process more than one queued message per
invocation, but it must respect a configurable concurrency limit based on the
active AI provider rate limits, Supabase Edge Function execution limits, and the
operational needs of the MVP.

Each checkpoint invocation should make at most one expensive image-generation
or vision provider call. Multi-attempt AI loops must be represented as
persisted checkpoint attempts instead of several long provider calls inside one
Edge Function invocation, unless a later accepted spec explicitly approves a
bounded exception.

The local Python bench must remain a behavior reference only. The production
runtime must not depend on Python or a long-running external worker process for
this spec.

### Stage 1: Room Preparation

Stage 1 is a deterministic multi-step pipeline. Earlier drafts of this
spec assumed a single image-model call would return mode + points as JSON;
that approach was rejected during implementation because gpt-image-2 is
unreliable at producing structured numeric coordinates. The current
pipeline splits the work into a vision-only mode classifier, an
image-edit dot-placement step, and pure pixel-detection code.

The worker must, in this logical order, idempotently:

1. **Materialize** the customer room photo into the scratch folder.
2. **Normalize** the photo inside the worker, not at the API edge.
   Normalization must convert unsupported-but-accepted input formats such
   as HEIC or HEIF to the worker processing format and may compress images
   that exceed the worker-defined maximum edge (default longest edge 720
   px, see `IN_HOME_SIMULATION_MAX_EDGE_PX`). Normalization must apply
   EXIF orientation so the stored processing image has unambiguous pixel
   orientation, must not reject the image based on a minimum short edge,
   and must not reject the image based on brightness.
3. **Validate** that the photo is a usable interior of a residential room
   with either a visible main wall or a visible room corner and adequate
   lighting. Validation must rely on a vision model (GPT-5 vision in the
   live configuration) and produce a readable failure code when it fails.
4. Persist the normalized and, when applicable, compressed room artifact
   for the remaining room preparation steps.
5. **Clean** the room: generate an artifact in which the room's existing
   furniture has been removed while the room geometry, openings, fixtures,
   and lighting remain visually identical (gpt-image-2 image-edit in the
   live configuration).
6. **Classify the scene mode** with a dedicated vision-JSON call (GPT-5
   vision). The classifier returns `{mode, confidence, reason}` where
   `mode` is one of `back_wall`, `corner`, or `reshoot`. A `reshoot`
   verdict fails the job with a non-retryable readable error so the
   visitor knows to upload a different photo. The visitor never chooses
   the mode.
7. **Place corner dots** with an image-edit call against the cleaned room
   (gpt-image-2 in the live configuration). The image model must paint
   small bright yellow dots at the architectural corners of the room:
   exactly four dots for `back_wall` mode (top-left / top-right /
   bottom-left / bottom-right of the back wall), or exactly six dots for
   `corner` mode (top-left / top-center / top-right at the ceiling, then
   bottom-left / bottom-center / bottom-right at the floor; the *center*
   pair anchors the inner vertical seam of the room corner).
8. **Detect dots** in pure local code on the corners-annotated PNG: a
   pixel-color filter for the yellow ink range followed by a flood-fill
   that yields one cluster per dot. Clusters must be sorted by size and
   the largest expected count (4 or 6 depending on mode) retained.
9. **Classify dots** into named architectural corners by sorting clusters
   by Y to split top vs. bottom, then by X to label left/(center)/right.
10. **Validate placement geometry** with deterministic rules before
    accepting the result:
    - `back_wall`: top and bottom dots on each side must share the same
      X within ~6% of image width; no dot may sit within ~3% of the
      photo edge; left dots must be left of right dots; tops must sit
      above bottoms.
    - `corner`: `topCenter` and `bottomCenter` must share the same X
      within ~6% of image width; `bottomCenter` must sit in the lower
      half of the image (floor anchor) and `topCenter` in the upper
      half (ceiling anchor); the four outer dots must sit within ~15%
      of the matching photo edge.
    If validation fails, the worker re-runs the corners image-edit step
    up to `MAX_CORNER_PLACEMENT_ATTEMPTS` (default 3) with the same
    cleaned room input. After the final failed attempt the stage fails
    with a `corners_failed` reason. The geometric validator is pure code
    and is therefore directly unit-testable.
11. **Render the dimension-guide overlay** deterministically on the
    corners-annotated PNG. The overlay draws three or four labelled
    lines depending on mode and uses Russian language-tagged words
    rather than numeric measurements at this stage:
    - `back_wall`: red "Ширина" along the back-wall floor edge,
      blue "Высота" up the left back-wall seam, and green "Глубина"
      from the camera anchor to the back-wall midpoint;
    - `corner`: red "Лев. стена" and "Прав. стена" along the two floor
      edges, blue "Высота" up the inner vertical seam, and green
      "Глубина" from the camera anchor to the inner-corner floor point.
    The overlay must use deterministic pixel rendering rather than image
    generation. The worker must preserve `room_cleaned.png` (no marks),
    `room_corners.png` (yellow dots only), and `room_dimensions.png`
    (lines + labels). The MVP does not require a worker watermark on
    the dimension-guide overlay.

The stage 1 success outputs are the cleaned room artifact, the
corners-annotated artifact, the dimension-guide overlay artifact, the
detected geometry mode, the classified corner coordinates in cleaned-room
pixel space, and the scene-classifier confidence. After stage 1 succeeds,
the job becomes `awaiting_dimensions` and the API may expose the overlay
artifact to the visitor.

### Stage 2: Sofa Placement

The worker must, in this logical order, idempotently:

1. **Validate the supplied dimensions** for the job's room geometry mode
   against the worker accept range and reject obviously inconsistent
   values, such as a sofa wider than the supplied wall width for
   `back_wall` mode, a corner sofa wider than either the supplied left or
   right wall width for `corner` mode, or a sofa taller than the
   supplied wall or room height.
2. **Materialize the prepared sofa asset** that was resolved from the
   selected sofa, fabric, and visual matrix column at job creation.
3. **Build the placement prompt** from the cleaned-room context, the
   supplied dimensions, the geometry mode, and the position keyword
   (back_wall mode only: `left`, `center`, or `right`; defaults to
   `center`). The prompt is generated by the pure helper
   `buildPlacementPrompt` and must include:
   - calibrated corner positions in metres (e.g. "the sofa BOTTOM-LEFT
     corner sits 0.45 m to the right of the LEFT back-wall seam");
   - explicit "EXACTLY {width} m × {height} m" wording rather than
     approximate language;
   - an ANTI-REGRESSION block instructing the model not to shrink the
     sofa toward a generic stock-sofa shape;
   - a DOORS-DO-NOT-BLOCK block instructing the model to render the sofa
     in front of any architectural feature (door, window, AC, socket,
     vent, etc.) at full requested size, never shrinking or shifting
     the sofa to avoid them;
   - an optional `{{FEEDBACK_BLOCK}}` placeholder used by the
     self-correcting loop on retry attempts.
4. **Compose** the cleaned room, the room geometry, the supplied
   dimensions, and the prepared sofa into a final visualization
   (gpt-image-2 image-edit in the live configuration). The composition
   call is wrapped in the self-correcting loop described below for
   `back_wall` mode and is a single-shot call for `corner` mode.

#### Self-Correcting Placement Loop (back_wall mode)

When the supplied dimensions allow computing target ratios
(`sofa_width / wall_width` and `sofa_height / wall_height`), the worker
runs up to `MAX_PLACEMENT_ATTEMPTS` (default 3) generate-and-measure
attempts:

1. **Generate** a candidate output via gpt-image-2 with the placement
   prompt and the cleaned room + prepared sofa multi-image inputs.
2. **Measure** the candidate output via a dedicated GPT-5 vision JSON
   call. The measurement provider returns `{sofa_width_pct,
   sofa_height_pct, position}` describing how much of the back wall the
   rendered sofa occupies and which third of the wall its center sits in.
3. **Compare** measured vs. target. If the absolute width and height
   deltas are both within `PLACEMENT_TOLERANCE_PCT` (default 5
   percentage points) and the position matches, accept the attempt.
4. **Otherwise**, build a corrective `FEEDBACK_BLOCK` describing the
   measured numbers, the target numbers, and per-dimension fix
   instructions ("ENLARGE the sofa width by N percentage points",
   "INCREASE the sofa height", "Move the sofa to center"), inject it
   into the next prompt, and retry.
5. After all attempts, return the **closest** candidate by total absolute
   delta. The loop never returns the worst attempt.

If the measurement provider itself fails on a candidate (vision call
errors out, returns malformed JSON, etc.), the worker accepts that
candidate as-is rather than burning a retry on a measurement-only
problem.

#### Corner mode

Corner-mode placement is single-shot in the current MVP. The placement
prompt still receives the strengthened DOORS / EXACTLY / ANTI-REGRESSION
language, but the measurement and feedback loop are not used. This is a
deliberate scope decision: the vision-based measurement contract is
defined for back-wall geometry only, and L-shape silhouettes (chaise
extensions, ottomans) inflate the measured width relative to the
along-wall length, so the loop would oscillate without an L-shape-aware
measurement contract. Corner-mode quality therefore relies entirely on
the strengthened prompt.

The stage 2 success output is the final generated visualization. The
worker must save the scratch result as `output.png`, persist it under
the regeneration-indexed output path for the current attempt, and mark
the job `succeeded`.

### Generation Core File Contract

The current generation core uses the following scratch folder contract:

```text
job-folder/
  room_original.{jpg,jpeg,png,heic,heif}
  room_normalized.jpg
  room_compressed.jpg
  room_cleaned.png
  room_corners.png
  room_dimensions.png
  sofa_prepared.png
  output.png
  worker_error.txt
```

Rules:

- `room_original.*` is the visitor's uploaded room photo;
- `room_normalized.jpg` is the EXIF-corrected and HEIC-converted room photo;
- `room_compressed.jpg` is the room photo at the worker-defined room
  maximum edge (default 720 px);
- `room_cleaned.png` is the room with existing furniture removed by the
  cleaning step;
- `room_corners.png` is the cleaned room with yellow architectural-corner
  dots painted by the corners image-edit step. The detected dot
  coordinates and classification are persisted to the job row; this scene
  has no separate `room_geometry.json` artifact in the current design.
  The annotated PNG is the source of truth for the corner positions
  because the lines step re-detects the dots from it;
- `room_dimensions.png` is the deterministic dimension-guide overlay
  drawn on top of the corners-annotated room (lines + Russian labels)
  and is the artifact exposed to the visitor between stages;
- `sofa_prepared.png` is the materialized prepared sofa asset for the
  selected sofa, fabric, and visual matrix column;
- `output.png` is the successful generated visualization in the scratch
  folder;
- `worker_error.txt` is the human-readable failure artifact persisted to
  the job's storage prefix on a non-retryable failure for operational
  review (the artifact path is also recorded on the job row);
- stale stage-2 artifacts must be cleared before a new placement attempt;
- a failed placement must not leave a stale `output.png`;
- a successful placement must not leave a `worker_error.txt`.

Persistent storage uses the regeneration-indexed output paths defined in
the Regeneration section. The scratch `output.png` file must not be used
as the persistent object path.

A regeneration may reuse `room_cleaned.png`, `room_corners.png`,
`room_dimensions.png`, the persisted geometry classification on the job
row, and `sofa_prepared.png` from the prior attempt. Stage 2 must use
`room_cleaned.png`, not `room_corners.png` or `room_dimensions.png`, as
the room image input to the placement model. It must clear `output.png`
and any pending `worker_error.txt` before the new placement attempt.

### Prompting

The in-home simulation pipeline uses two distinct prompt families:

- a **room preparation** prompt family covering the validation, cleaning,
  scene-classification, and corner-dot-placement prompts;
- a **sofa placement** prompt family covering the placement prompt and
  the placement-measurement prompt that powers the self-correcting loop.

Both families are versioned. The current pinned versions are:

- `room_prep_v003` for the corners step. Earlier sub-steps (validation,
  cleaning, scene classifier) carry their original v001/v002 strings on
  their providers; v003 is the version of the corners prompt where the
  FRAME-EDGE WARNING and SELF-CHECK blocks were added on 2026-04-30.
- `sofa_placement_v003` for the placement prompt. v003 is the version
  where the DOORS-DO-NOT-BLOCK block, EXACTLY language, ANTI-REGRESSION
  block, calibrated corner-position metres, and the `{{FEEDBACK_BLOCK}}`
  placeholder were added on 2026-04-30. The OpenAI placement provider,
  the Gemini fallback placement provider, and the mock placement
  provider must all carry the same `sofa_placement_v003` string when
  the OpenAI placement template is bumped.

Optional extra instructions may be appended as a prompt note, but they
must not replace a base prompt. Markdown copies of the live prompt
strings under `prompts/sofa_placement_v00x/` are documentation-only; the
TypeScript constants in the worker code are the source of truth.

The corners prompt must instruct the AI provider to:

- place exactly 4 yellow dots on the architectural corners of the back
  wall (back_wall mode) or exactly 6 yellow dots covering the inner
  vertical seam plus the four outer wall ends (corner mode);
- treat the photo edge as not the seam — never push back-wall dots all
  the way to X≈0 or X≈image-width;
- self-check vertical alignment of paired dots before returning;
- not draw any lines, text, or numbers; only the yellow dots.

The placement prompt must instruct the AI provider to:

- preserve the cleaned room, including walls, floor, ceiling, openings,
  fixtures, and visible architectural features;
- preserve the perspective and lighting of the cleaned room;
- not introduce furniture or decoration that is not in the cleaned room;
- preserve the prepared sofa identity, including silhouette, cushion
  arrangement, armrest profile, base style, and fabric appearance;
- place the sofa against the detected main wall or room corner at the
  EXACT supplied real-world dimensions, never regressing to a generic
  stock-sofa shape;
- render the sofa IN FRONT of any door, window, AC unit, socket, or
  other architectural feature when the chosen size and position would
  visually overlap them (the sofa occludes the feature; never shrink
  or shift to avoid it);
- not reproduce any reference scale guides, numeric labels, or
  annotation marks in the final output.

### Providers

The pipeline uses six logical provider roles, each pinned to a primary
model and selected at runtime by `IN_HOME_SIMULATION_PROVIDER_MODE`
(`mock` for local smoke testing or `live` for real provider calls):

- **Validation provider**: GPT-5 vision (Chat Completions, JSON object
  response format). Returns `{ok, confidence, failure_reason}` on the
  normalized photo. Mock returns ok=true.
- **Cleaning provider**: gpt-image-2 image-edit. Removes existing
  furniture from the compressed room photo while keeping geometry,
  openings, fixtures, and lighting identical. Mock is the identity
  transform.
- **Scene classifier provider**: GPT-5 vision (Chat Completions, JSON
  object response format). Returns `{mode, confidence, reason}` where
  `mode` is `back_wall`, `corner`, or `reshoot`. Mock returns a
  configurable mode (default `back_wall`) per
  `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE`.
- **Corners provider**: gpt-image-2 image-edit, wrapped in a 3-attempt
  retry loop with the geometric validator. Paints 4 or 6 yellow dots on
  the cleaned room. Mock paints deterministic placeholder dots.
- **Placement provider**: gpt-image-2 image-edit. The OpenAI primary is
  wrapped in the self-correcting feedback loop for back_wall mode. Mock
  returns empty bytes; the orchestrator stamps a placeholder rectangle.
- **Placement measurement provider**: GPT-5 vision (Chat Completions,
  JSON object response format). Returns `{sofa_width_pct,
  sofa_height_pct, position}` for back_wall mode placement outputs.
  Mock is not currently provided; tests inject a fake provider directly.

The room-geometry detection process is deliberately split into the scene
classifier (mode only, JSON), the corners image-edit step (dots painted
on the photo), and the local lines code (pixel detection + classification
+ overlay rendering). The image model is never asked to return numeric
point coordinates as JSON; that approach was tried and rejected because
gpt-image-2 is unreliable at structured numeric output. The image model
is also never responsible for rendering the final guide overlay.

#### Optional Gemini fallback for placement

When `IN_HOME_SIMULATION_FALLBACK_PROVIDER=gemini` is set in the worker
environment, the placement provider is wrapped in a
`FallbackPlacementProvider` that tries the OpenAI primary first and only
calls Gemini if the primary returns a failure result. Gemini reuses the
same `buildPlacementPrompt` output, so prompt-version bumps automatically
apply to both. By default the fallback is disabled and the worker runs
OpenAI-only.

If a provider does not return image data when image data is required,
the attempt must fail with a readable error.

### Output Normalization

The stage 2 generated scratch output must be saved as `output.png`.

The final output dimensions must match the cleaned room dimensions. If the
provider returns a different size or aspect ratio, the worker must
normalize the output by resizing it to the cleaned room dimensions.

### Retries

There are three distinct retry layers in the worker, each with its own
budget:

- **Stage-level retries** (`room_prep_attempt_count` and
  `placement_attempt_count`): a stage that fails with a transient error
  may be re-queued by the resilience flow and re-claimed by a worker.
  Default maximum per stage is three. These counters live on the job
  row and survive worker restarts.
- **Corners-step retry** (inside Stage 1, `MAX_CORNER_PLACEMENT_ATTEMPTS`,
  default 3): when the corners image-edit step returns dots that fail
  the geometric validator, the worker re-runs the same image-edit call
  inside the same stage attempt. This budget does not bump the stage
  attempt counter. After exhaustion the stage fails with a
  `corners_failed` reason.
- **Placement feedback retry** (inside Stage 2 back_wall mode,
  `MAX_PLACEMENT_ATTEMPTS`, default 3, tolerance
  `PLACEMENT_TOLERANCE_PCT`, default 5): when the placement output
  measures off-target, the worker re-runs the placement image-edit call
  with a corrective `FEEDBACK_BLOCK` injected into the prompt. This
  budget does not bump the placement attempt counter. After exhaustion
  the worker returns the closest-to-target candidate.

The worker may retry transient provider, network, timeout, or
rate-limit errors at any of the three layers until the relevant budget
is reached.

The worker must not retry errors caused by:

- a missing or unreadable input artifact;
- an unsupported image format;
- a validation failure that requires the visitor to upload a different
  photo;
- a missing required environment variable;
- a request that would exceed the SPEC-0004 regeneration limit;
- a job whose retention deadline has already passed.

The worker must track room preparation attempts and placement attempts
separately. `room_prep_attempt_count` increments when a worker successfully
claims stage 1. `placement_attempt_count` increments when a worker successfully
claims stage 2, including regeneration placement attempts.

After the final failed attempt of stage 1, the job status must become `failed`
and the last error message must remain available for the visitor and for
operational review.

After the final failed attempt of stage 2:

- if no generated output exists yet, the job status must become `failed`;
- if a previous generated output exists, the job must return to `succeeded`,
  keep the previous result available, and record the last regeneration error.

### Idempotency And Claiming

The system must prevent two workers from processing the same job at the
same time.

The job claim operation must be atomic per stage. A worker can begin stage
1 only after it successfully moves the job from `queued` to
`room_prep_processing`. A worker can begin stage 2 only after it
successfully moves the job from `placement_queued` to
`placement_processing`.

The stage claim operation must increment only the attempt counter for the stage
being claimed:

- claiming `queued` for stage 1 increments `room_prep_attempt_count`;
- claiming `placement_queued` for stage 2 increments `placement_attempt_count`.

A processing claim must set `claim_expires_at` so a crashed or timed-out worker
cannot leave a job stuck in a processing status forever. The default claim TTL
for each stage is 10 minutes and may be overridden by environment
configuration.

If a stage claim expires before the stage reaches a visitor-action state or
terminal state, the recovery process must inspect the job before retrying it. If
the retention deadline has passed, the job must not be retried. If attempts
remain, the job returns to the appropriate queued state for the stage:

- `room_prep_processing` returns to `queued`;
- `placement_processing` returns to `placement_queued`.

If no attempts remain, the job becomes `failed` and the last error message must
identify that the worker claim expired.

Before processing any queued message, the worker must reload the job from the
database and skip the message without image processing when the job is missing,
expired, canceled, failed, or already completed.

The system should avoid creating duplicate active simulation jobs for the
same selected sofa, fabric, visual matrix column, and customer room photo
within the visitor's session.

Each sub-step inside a stage must be skippable if its scratch folder
output already exists and is intact. Restarting a stage on the same job
must not reproduce already-produced sub-step artifacts unless they are
missing or corrupt.

### Storage

Persistent input and output artifacts belong in server-controlled storage.
Worker scratch folders are temporary local files and must not be treated
as the source of truth after stage completion.

The worker must download or materialize the required input artifacts into
its scratch folder, run a stage, then upload or persist the artifacts
produced by that stage through the approved storage path.

The customer room photo, all intermediate room artifacts, and all
generated outputs must remain private. They must never become part of a
public catalog asset.

The MVP uses job-prefix storage rather than per-artifact lifecycle tracking.
All private simulation files for one job must live under one storage prefix:

```text
simulations/{job_id}/
```

The prefix must include the visitor upload, normalized and compressed room
files, cleaned room, dimension-guide overlay, prepared sofa materialization,
generated outputs, and any worker error artifact that is persisted for
operational review.

Room upload objects that were written before a database job creation failure are
orphaned uploads, not simulation artifacts. The API must attempt immediate
deletion, and the cleanup process must delete orphaned uploads older than one
hour.

### Retention

The worker must respect the SPEC-0003 retention rule that customer room
photos and generated simulation outputs must not be retained for more than
24 hours in the MVP.

A job abandoned by the visitor in `awaiting_dimensions` must not be deleted
early by default. It remains recoverable through the visitor's short-lived
simulation access until its retention deadline, then becomes purgeable like any
other incomplete simulation job.

A purge process must, at or before the retention deadline of each job:

- delete the full private storage prefix associated with the job;
- transition the job to `expired` after its private image artifacts have been
  purged, regardless of whether the previous status was `succeeded`, `failed`,
  `canceled`, or incomplete;
- preserve only the operational metadata required by the SPEC-0003
  lightweight operational overview, with no reference to private image
  content.

The purge process must be idempotent. A missing object under the job prefix
counts as already deleted, and a repeated purge attempt for the same job must
not fail solely because some files were removed by an earlier attempt.

The purge process must delete every generated output under the job prefix,
including all regeneration outputs, not only the latest result shown to the
visitor.

The worker must refuse to start any stage on a job whose retention
deadline has already passed.

### Observability

The worker must record enough operational information to debug and monitor
in-home simulations:

- job id;
- status transitions including stage entry and exit;
- attempt count per stage;
- provider and provider model used per sub-step;
- prompt version per family;
- input artifact references;
- intermediate and output artifact references where applicable;
- failure message when failed;
- start and completion timestamps per stage.

The operational view must remain lightweight per SPEC-0003.

The operational view must not expose private image content beyond what is
strictly necessary for an operator to act on a failure.

The MVP operational overview should rely on database state written by the API
and worker rather than a separate operational events queue. A future events
stream may be added by a later spec if polling and lightweight database views no
longer satisfy operational needs.

## Environment Variables

The worker environment must include:

- `APP_ENV`: `dev`, `prod`, or `local`;
- `SUPABASE_URL`: Supabase project URL for the matching environment;
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service credential;
- `OPENAI_API_KEY`: required when `IN_HOME_SIMULATION_PROVIDER_MODE=live`;
  used by validation, cleaning, scene classifier, corners, placement,
  and placement-measurement providers;
- `GEMINI_API_KEY`: required when the optional Gemini placement
  fallback is enabled (see `IN_HOME_SIMULATION_FALLBACK_PROVIDER`).

Worker-specific configuration:

- `IN_HOME_SIMULATION_PROVIDER_MODE`: `mock` (local smoke testing) or
  `live` (real AI providers). Required to be `live` in any real
  deployment. Mock mode wires the deterministic stubs documented in
  Providers and lets the local smoke gate run without provider keys per
  SPEC-0008.
- `IN_HOME_SIMULATION_FALLBACK_PROVIDER`: optional. Setting it to
  `gemini` activates the `FallbackPlacementProvider` wrapper around the
  OpenAI placement primary. Disabled when unset.
- `IN_HOME_SIMULATION_MAX_ATTEMPTS`: optional override for the
  per-stage attempt budget;
- `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS`: optional override for the
  worker claim TTL per checkpoint, defaulting to 180 seconds locally;
- `IN_HOME_SIMULATION_MAX_ACTIVE_CHECKPOINTS`: optional global capacity
  limit for concurrently claimed in-home simulation checkpoints;
- `IN_HOME_SIMULATION_DISPATCH_BATCH_SIZE`: optional dispatch-backstop
  batch size for claimed outbox rows;
- `IN_HOME_SIMULATION_DISPATCH_LOCK_TTL_SECONDS`: optional lock TTL for
  dispatch-outbox claims;
- `IN_HOME_SIMULATION_WORKER_INVOCATION_TIMEOUT_MS`: optional timeout for
  internal checkpoint/dispatch worker self-invocations;
- `IN_HOME_SIMULATION_MAX_EDGE_PX`: optional override for the maximum
  longest-edge size used during the compression sub-step of stage 1.
  Default 720. Lowering this reduces input-token cost at gpt-image-2.
- `IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE`: optional, only relevant when
  `IN_HOME_SIMULATION_PROVIDER_MODE=mock`. Forces the mock scene
  classifier to return `back_wall` (default) or `corner`.
- `IN_HOME_SIMULATION_WORKER_ID_PREFIX`: optional prefix for the
  generated worker identifier; defaults to `edge`.
- `IN_HOME_SIMULATION_TMP_DIR`: optional local temporary directory
  root, defaulting to an Edge Function-compatible temporary directory
  when needed;
- `SIMULATION_RETENTION_HOURS`: optional override for the retention
  window, capped at the SPEC-0003 maximum of 24.

DEV and PROD values must remain isolated.

No service-role credential or AI provider key may be exposed to
`apps/web`.

## Acceptance Criteria

- The spec is traceable to `SPEC-0001`, `SPEC-0003`, and `SPEC-0004`.
- The spec is identified as a sibling of `SPEC-0006` and shares the Supabase
  Edge Functions, Supabase Queues, storage, and observability conventions.
- The worker job type is defined as `in_home_simulation`.
- The production runtime is Supabase Edge Functions written in TypeScript on the
  Deno runtime, with Supabase Queues providing durable job queueing.
- The two-stage processing model with an `awaiting_dimensions` checkpoint
  is defined.
- The selected sofa, fabric, and visual matrix column are required job
  inputs and the prepared sofa asset is resolved server-side from the
  catalog rather than uploaded by the visitor.
- The API creates and queues an in-home simulation job only after the visitor
  has a verified email simulation session.
- Room photo upload and simulation job creation are atomic from the visitor's
  perspective, with no public `upload_pending` status.
- Orphaned room uploads from database job creation failures are deleted
  immediately when possible and by cleanup after one hour otherwise.
- The prepared sofa asset reference is resolved when the simulation job is
  created and reused by stage 2.
- The customer room photo is the only image the visitor uploads.
- Worker room photo normalization applies EXIF orientation before downstream
  processing.
- Stage 1 logical sub-steps cover worker-side normalization, optional
  compression, validation (vision JSON), cleaning (image-edit), scene
  classification (vision JSON returning mode + confidence + reshoot),
  corner-dot placement (image-edit), pixel-based dot detection,
  classification, geometric validation with retry, and deterministic
  dimension-guide rendering on the corners-annotated room photo.
- The room-geometry detection process is split into mode classification
  (vision JSON), dot placement (image-edit), and pure-code detection;
  the image model is never asked to return numeric point coordinates as
  JSON.
- Stage 2 logical sub-steps cover supplied-dimensions validation,
  prepared sofa materialization, prompt construction with calibrated
  corner positions in metres, and composition. For `back_wall` mode
  with full sofa dimensions supplied, the composition runs inside a
  vision-measured self-correcting loop with a default 3-attempt budget
  and a default ±5 percentage-point tolerance; the closest candidate
  is returned when the loop is exhausted.
- For `corner` mode the placement prompt carries the same DOORS / EXACTLY
  / ANTI-REGRESSION reinforcement as `back_wall`, but the measurement
  loop is intentionally not active in the current MVP.
- The scratch folder contract names the artifacts each stage may produce.
- Job statuses include the wait state required by SPEC-0004 between
  dimension collection and placement.
- The required job statuses are defined.
- Retryable and non-retryable failure categories are defined.
- The MVP regeneration limit of three results per simulation attempt is
  enforced and traceable to SPEC-0004.
- Visitors may adjust wall dimensions before requesting a regeneration, and the
  regeneration remains part of the same job and retention window.
- Regeneration reuses the existing placement statuses by transitioning from
  `succeeded` to `placement_queued` and back to `succeeded` on success.
- A failed regeneration keeps the previous generated result available when one
  exists and records the regeneration error instead of making the whole job
  unavailable.
- Technical retries do not count as generated outputs; only successfully
  persisted outputs consume the three-result MVP limit.
- Generated results are stored under regeneration-indexed output paths and the
  job tracks the latest output index.
- Room preparation attempts and placement attempts are tracked separately.
- Verified email session and visitor-session anti-abuse limits are enforced by
  the API across initial simulation jobs and regeneration requests to prevent
  one visitor from producing too many generated images.
- Cross-job per-IP and per-session deduplication are API responsibilities, not
  worker responsibilities.
- Room geometry points are worker-determined only in the MVP.
- `back_wall` mode requires two visitor-supplied measurements: wall width and
  wall height.
- `corner` mode requires three visitor-supplied measurements: left wall width,
  right wall width, and room height.
- `room_depth` is an optional `supplied_dimensions` key collected through
  the green "Глубина" line in the dimension-guide overlay; it improves
  the placement model's perspective scaling when provided. When omitted,
  the placement prompt receives "unspecified".
- The dimension-guide overlay does not require a worker watermark in
  the MVP.
- The worker preserves three artifacts at end of stage 1:
  `room_cleaned.png` (no marks), `room_corners.png` (yellow dots only),
  and `room_dimensions.png` (lines + Russian labels). Stage 2 uses
  `room_cleaned.png` as its room image input.
- The current pinned prompt versions are `room_prep_v003` for the
  corners step and `sofa_placement_v003` for the placement step. v003
  introduced FRAME-EDGE WARNING and SELF-CHECK in the corners prompt,
  and DOORS-DO-NOT-BLOCK / EXACTLY / ANTI-REGRESSION / calibrated
  corner-position metres / `{{FEEDBACK_BLOCK}}` in the placement prompt.
- The MVP uses six configured providers (validation, cleaning, scene
  classifier, corners, placement, placement-measurement) selected by
  `IN_HOME_SIMULATION_PROVIDER_MODE`. Gemini is available as an
  optional placement-only fallback through
  `IN_HOME_SIMULATION_FALLBACK_PROVIDER=gemini` and is disabled by
  default.
- The 24-hour retention rule from SPEC-0003 is enforced by purging private
  image artifacts and transitioning the simulation job to `expired`.
- A visitor-abandoned job in `awaiting_dimensions` remains available until its
  retention deadline and is then purgeable.
- Worker processing claims have a default 10-minute TTL and expired claims are
  retried only while attempts remain and the retention deadline has not passed.
- The MVP storage cleanup model uses one private storage prefix per simulation
  job and idempotently deletes that prefix at purge time.
- The scratch output file is `output.png`, persistent generated results use
  regeneration-indexed storage paths, and output dimensions must match the
  cleaned room dimensions.
- Generated outputs remain private and never become public catalog assets.
- Required worker environment variables are listed.
- The existing local Python bench at `mebel/worker_test/` is identified as
  a reference implementation only, and Python is not the production runtime for
  this spec.
- The spec defers wizard UI, email verification code delivery, email consent
  storage, commercial contact consent storage, anti-abuse mechanism details,
  catalog data model, and database schema to dedicated specs.
- The spec explicitly defers final Supabase table names, relationships, storage
  bucket names, storage paths, and database constraints to a dedicated Supabase
  data model and storage specification.

## Known Limitations And Future Work

These items are intentionally out of scope for the current MVP and
represent followup work, not bugs:

- **Visitor UI** for collecting wall + sofa dimensions and the
  left/center/right position keyword does not exist yet. Today the
  dimensions arrive on the job through `submit_in_home_simulation_dimensions`
  RPC; a real consumer of that RPC from the public flow is a future
  task.
- **Corner-mode placement measurement loop** is not implemented. The
  measurement provider is contracted around back-wall geometry and
  L-shape silhouettes (chaise extensions, ottomans) inflate the
  measured width relative to the actual along-wall length. Adding a
  corner-aware measurement contract would let the loop run for corner
  mode too.
- **L-shape sofas in `back_wall` mode** are a known measurement edge
  case: the vision measurement reads the full silhouette including the
  extension, which can report inflated width percentages even when the
  visual placement is correct. The worker still returns the closest
  attempt and the visual quality is acceptable; addressing this
  requires either a shape-aware measurement or accepting the
  measurement noise.
- **Markdown copies** of `sofa_placement_v003` and `room_prep_v003`
  prompts under `prompts/<version>/` are documentation-only. The
  TypeScript constants in the worker code are the source of truth for
  the prompt strings actually sent to the provider; do not assume the
  markdown copies are kept in sync without explicit verification.

## Open Questions

- None.
