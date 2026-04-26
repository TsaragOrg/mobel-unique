# SPEC-0007 In-Home Simulation Worker

Spec: SPEC-0007
Status: draft
Layer: technical
Parent Spec: SPEC-0004
Depends On: SPEC-0001, SPEC-0003, SPEC-0004
Areas: api, image-worker, supabase
Implementation Plans: none yet

## Traceability

This spec defines the second technical worker contract in the `image-worker`
area, alongside the fabric render worker.

It follows `SPEC-0001 Repo Foundation`, which created the monorepo worker
boundary and the initial `workers/image` service foundation.

It follows `SPEC-0003 Business Context - AI Sofa Visualization`, which defines
the in-home simulation as a product invariant, requires customer room photo and
generated simulation output retention to remain at most 24 hours in the MVP,
requires proportionate anti-abuse protection for public simulation requests,
and lists the in-home simulation flow as a required follow-up specification
area.

It follows `SPEC-0004 Public Customer Experience`, which defines the public
simulation launch wizard, the prepared room intermediate state with visual
dimension guides, the required dimension collection step, the simulation
result display, the result email delivery action, and the MVP regeneration
limit.

It is a sibling to `SPEC-0006 Fabric Render Worker`, which defines the
admin-driven fabric render generation job in the same image-worker service.
The two job types share the worker runtime, storage layout conventions, and
observability conventions, but they have distinct inputs, retention rules,
visibility rules, and failure handling.

A future domain-level `In-Home Simulation Flow` spec may emerge later to
consolidate wizard rules, validation rules, dimension semantics, regeneration
counting, and failure-state UX. This worker contract intentionally focuses on
the server-side processing contract and references SPEC-0004 for the public
wizard.

The existing local Python bench at `mebel/worker_test/` is treated as a
reference implementation for the in-home simulation pipeline. Its behavior
can be used to seed repository implementation after this spec is accepted and
an implementation plan exists. This draft spec does not copy code and does
not approve any implementation change by itself.

## Goal

Define the in-home simulation worker contract for generating a final
visualization of a selected catalog sofa placed in a customer's uploaded room
photo.

The worker must support the two-stage public simulation flow defined in
SPEC-0004 where:

- the customer first uploads a room photo and receives a prepared room with
  visual dimension guides;
- the customer then provides room dimensions and receives a final placement
  of the previously selected sofa, fabric, and visual position.

The output is a generated room photo with the selected sofa placed against
the room's back wall at a size that matches the supplied room dimensions.

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
- how the existing local Python bench at `mebel/worker_test/` maps to the
  future repository worker;
- the minimum environment variables required by the worker.

## Out Of Scope

This spec does not define:

- the public simulation wizard UI;
- result email delivery, the email request form, or consent storage;
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
- a final decision to keep the room preparation and sofa placement core in
  Python or to reimplement it inside the existing TypeScript worker runtime.

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
job.

### Image Worker

The image worker runs with private server-side credentials. It may read
private input artifacts, call the configured AI providers, write generated
outputs, and update operational job status.

Service-role credentials and AI provider keys must remain server-side only.

## User Flow

This worker supports the public simulation flow defined by SPEC-0004
§Simulation Launch. The mapping from public wizard steps to worker activity
is:

1. The visitor confirms the selected sofa, fabric, and visual position. No
   worker activity.
2. The visitor uploads a room photo. The API creates an in-home simulation
   job and queues stage 1.
3. The worker claims the job, runs stage 1 room preparation, and stores the
   prepared room and the dimension-guide overlay.
4. The job status becomes `awaiting_dimensions`. The API exposes the
   dimension-guide overlay to the visitor through the public flow.
5. The visitor provides the room dimensions through the wizard.
6. The API attaches the dimensions and the resolved prepared sofa asset to
   the job and queues stage 2.
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

The exact database schema and storage bucket names belong in dedicated data
model and storage specs. This spec defines the logical data the worker
contract requires.

### In-Home Simulation Job

An in-home simulation job represents one attempt to render the visitor's
selected sofa, fabric, and visual position into the visitor's uploaded room.

The logical job record must track:

- job id;
- selected sofa id;
- selected fabric id;
- selected visual matrix column id;
- prepared sofa asset reference resolved from the selected sofa, fabric,
  and visual position;
- customer room photo asset reference;
- normalized room asset reference;
- compressed room asset reference;
- cleaned room asset reference;
- back wall anchor coordinates as the four architectural corners in the
  cleaned room pixel space, ordered bottom-left, bottom-right, top-right,
  top-left;
- prepared dimension-guide overlay asset reference exposed to the visitor
  between stages;
- room dimensions in metres for width, height, and depth;
- generated output asset references for each generated result, ordered by
  regeneration index;
- status;
- regeneration count;
- attempt count for the current stage;
- maximum attempts per stage;
- last error message;
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

### Regeneration

A regeneration is a new placement attempt for the same job after a
`succeeded` state, requested by the visitor through the public flow per
SPEC-0004 §Simulation Launch.

A regeneration:

- reuses the previously stored cleaned room and back wall anchor;
- reuses the previously stored prepared sofa asset;
- may reuse or update the room dimensions if the visitor adjusted them;
- counts toward the SPEC-0004 MVP limit of three total generated results
  per simulation attempt, including the initial result;
- must not extend the SPEC-0003 24-hour retention deadline beyond the
  original job creation time.

The worker must reject a regeneration request that would exceed the MVP
limit. The API is responsible for keeping the visible regeneration
affordance consistent with that limit per SPEC-0004.

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

- creating an in-home simulation job from a confirmed sofa, fabric, and
  visual position selection plus an uploaded room photo;
- attaching room dimensions to the job and transitioning it from
  `awaiting_dimensions` to `placement_queued`;
- reading job status, stage-specific artifacts, and the latest generated
  result;
- requesting a regeneration within the SPEC-0004 MVP limit;
- requesting result email delivery, which is the responsibility of a
  separate result email delivery spec.

The API must:

- enforce the SPEC-0003 anti-abuse posture for public simulation requests
  before queueing work;
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

### Stage 1: Room Preparation

The worker must, in this logical order, idempotently:

1. Materialize the customer room photo into the scratch folder.
2. Normalize the photo: convert HEIC inputs to JPEG, apply EXIF
   orientation, validate that the short edge meets the worker minimum, and
   validate brightness is within the worker accept band.
3. Validate that the photo is a usable interior of a residential room with
   a visible back wall and adequate lighting. Validation must rely on a
   vision model and produce a readable failure code when it fails.
4. Compress the normalized photo to the worker-defined room maximum edge.
5. Generate a cleaned-room artifact in which the room's existing furniture
   has been removed while the room geometry, openings, fixtures, and
   lighting remain visually identical.
6. Determine the four architectural back-wall corners of the cleaned room
   in pixel space, ordered bottom-left, bottom-right, top-right, top-left.
   The worker must validate the resulting quadrilateral against geometric
   sanity rules and may retry the corner determination up to a
   worker-defined attempt limit before failing.
7. Render the dimension-guide overlay deterministically from the cleaned
   room and the back wall corners. The overlay must include three labelled
   lines for width, height, and depth, expressed as language-tagged words
   rather than numeric measurements at this stage. The overlay must use
   deterministic pixel rendering rather than image generation, so the
   underlying cleaned room is not modified.

The stage 1 success outputs are the cleaned room artifact, the back wall
corner anchor, and the dimension-guide overlay artifact. After stage 1
succeeds, the job becomes `awaiting_dimensions` and the API may expose the
overlay artifact to the visitor.

### Stage 2: Sofa Placement

The worker must, in this logical order, idempotently:

1. Validate the supplied room dimensions against the worker accept range
   and reject obviously inconsistent values such as a sofa wider than the
   supplied room width or a sofa taller than the supplied ceiling.
2. Materialize the prepared sofa asset that was resolved from the selected
   sofa, fabric, and visual matrix column.
3. Compose the cleaned room, the back wall anchor, the room dimensions, and
   the prepared sofa into a final visualization that places the sofa
   against the back wall at a size that matches the supplied room
   dimensions.

The stage 2 success output is the final generated visualization. The
worker must save it as `output.png` and mark the job `succeeded`.

### Generation Core File Contract

The first generation core must support the following scratch folder
contract:

```text
job-folder/
  room_original.{jpg,jpeg,png,heic,heif}
  room_normalized.jpg
  room_compressed.jpg
  room_cleaned.png
  back_wall.json
  room_guides.png
  sofa_prepared.png
  output.png
  error.txt
```

Rules:

- `room_original.*` is the visitor's uploaded room photo;
- `room_normalized.jpg` is the EXIF-corrected and HEIC-converted room photo;
- `room_compressed.jpg` is the room photo at worker-defined room maximum
  edge;
- `room_cleaned.png` is the room with existing furniture removed;
- `back_wall.json` records the four ordered corner coordinates that anchor
  the back wall;
- `room_guides.png` is the dimension-guide overlay exposed to the visitor
  between stages;
- `sofa_prepared.png` is the materialized prepared sofa asset for the
  selected sofa, fabric, and visual matrix column;
- `output.png` is the successful generated visualization;
- `error.txt` is the human-readable failure artifact;
- stale stage-2 artifacts must be cleared before a new placement attempt;
- a failed placement must not leave a stale `output.png`;
- a successful placement must not leave an `error.txt`.

A regeneration may reuse `room_cleaned.png`, `back_wall.json`,
`room_guides.png`, and `sofa_prepared.png` from the prior attempt. It must
clear `output.png` and `error.txt` before the new placement attempt.

### Prompting

The first in-home simulation pipeline uses two distinct prompt families:

- a room preparation prompt family covering the validation, cleaning, and
  back-wall guidance prompts;
- a sofa placement prompt family covering the final placement prompt.

Both families must be treated as fixed versioned prompt assets. Optional
extra instructions may be appended as a prompt note, but they must not
replace a base prompt.

The first pinned prompt versions are recorded in the worker configuration
and not in this spec. The implementation plan must record the first pinned
version per family and the rationale for any later bump.

The placement prompt must instruct the AI provider to:

- preserve the cleaned room, including walls, floor, ceiling, openings,
  fixtures, and visible architectural features;
- preserve the perspective and lighting of the cleaned room;
- not introduce furniture or decoration that is not in the cleaned room;
- preserve the prepared sofa identity, including silhouette, cushion
  arrangement, armrest profile, base style, and fabric appearance;
- place the sofa so its back rests against the back wall anchor at a size
  that matches the supplied room dimensions;
- not reproduce any reference scale guides, numeric labels, or annotation
  marks in the final output.

### Providers

The first approved providers and primary models per stage are not finalized
in this draft.

The implementation plan must select the first primary provider and primary
model per stage and record the decision. The choice may differ between
stages; for example, a vision-only provider may run validation while an
image-edit provider runs cleaning and placement.

If the primary provider is unavailable, the worker may fall back to a
configured secondary provider for the same stage. Provider transitions
during a single attempt must be recorded in the job's operational metadata.

If a provider does not return image data when image data is required, the
attempt must fail with a readable error.

### Output Normalization

The stage 2 generated output must be saved as `output.png`.

The final output dimensions must match the cleaned room dimensions. If the
provider returns a different size or aspect ratio, the worker must
normalize the output by resizing it to the cleaned room dimensions.

### Retries

The default maximum attempts per stage is three.

The worker may retry transient provider, network, timeout, or rate-limit
errors until the per-stage maximum is reached.

The worker must not retry errors caused by:

- a missing or unreadable input artifact;
- an unsupported image format;
- a validation failure that requires the visitor to upload a different
  photo;
- a missing required environment variable;
- a request that would exceed the SPEC-0004 regeneration limit;
- a job whose retention deadline has already passed.

After the final failed attempt of a stage, the job status must become
`failed` and the last error message must remain available for the visitor
and for operational review.

### Idempotency And Claiming

The system must prevent two workers from processing the same job at the
same time.

The job claim operation must be atomic per stage. A worker can begin stage
1 only after it successfully moves the job from `queued` to
`room_prep_processing`. A worker can begin stage 2 only after it
successfully moves the job from `placement_queued` to
`placement_processing`.

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

### Retention

The worker must respect the SPEC-0003 retention rule that customer room
photos and generated simulation outputs must not be retained for more than
24 hours in the MVP.

A purge process must, at or before the retention deadline of each job:

- delete all artifacts associated with the job from server-controlled
  storage and from worker scratch folders;
- transition the job to `expired` if it has not already reached
  `succeeded`, `failed`, or `canceled`;
- preserve only the operational metadata required by the SPEC-0003
  lightweight operational overview, with no reference to private image
  content.

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

## Environment Variables

The worker environment must include:

- `APP_ENV`: `dev`, `prod`, or `local`;
- `SUPABASE_URL`: Supabase project URL for the matching environment;
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service credential;
- `GEMINI_API_KEY`: server-only Gemini provider key;
- `OPENAI_API_KEY`: server-only OpenAI provider key for sub-steps that use
  OpenAI vision or image-edit models;
- `IMAGE_WORKER_POLL_INTERVAL_MS`: optional polling interval for queued
  jobs;
- `IMAGE_WORKER_MAX_ATTEMPTS`: optional override for maximum attempts per
  stage;
- `IMAGE_WORKER_SCRATCH_DIR`: optional local scratch directory root;
- `SIMULATION_RETENTION_HOURS`: optional override for the retention
  window, capped at the SPEC-0003 maximum of 24.

DEV and PROD values must remain isolated.

No service-role credential or AI provider key may be exposed to `apps/web`.

## Acceptance Criteria

- The spec is traceable to `SPEC-0001`, `SPEC-0003`, and `SPEC-0004`.
- The spec is identified as a sibling of `SPEC-0006` and shares the
  image-worker boundary.
- The worker job type is defined as `in_home_simulation`.
- The two-stage processing model with an `awaiting_dimensions` checkpoint
  is defined.
- The selected sofa, fabric, and visual matrix column are required job
  inputs and the prepared sofa asset is resolved server-side from the
  catalog rather than uploaded by the visitor.
- The customer room photo is the only image the visitor uploads.
- Stage 1 logical sub-steps cover normalization, validation, compression,
  cleaning, back-wall anchoring, and deterministic dimension-guide
  rendering.
- Stage 2 logical sub-steps cover dimension validation, prepared sofa
  materialization, and composition.
- The scratch folder contract names the artifacts each stage may produce.
- Job statuses include the wait state required by SPEC-0004 between
  dimension collection and placement.
- The required job statuses are defined.
- Retryable and non-retryable failure categories are defined.
- The MVP regeneration limit of three results per simulation attempt is
  enforced and traceable to SPEC-0004.
- The 24-hour retention rule from SPEC-0003 is enforced and tied to a
  defined purge behavior and the `expired` status.
- The output dimensions must match the cleaned room dimensions.
- Generated outputs remain private and never become public catalog assets.
- Required worker environment variables are listed.
- The existing local Python bench at `mebel/worker_test/` is identified as
  a reference implementation without copying code.
- The spec defers wizard UI, result email delivery, anti-abuse mechanism
  details, catalog data model, and database schema to dedicated specs.

## Open Questions

- Should the first repository implementation keep the room preparation and
  sofa placement core in Python, invoke it from the existing Node worker
  boundary, or replace the current worker runtime with a Python worker
  after a separate implementation plan?
- What are the final Supabase table names and storage bucket names for
  in-home simulation jobs and their artifacts?
- Should normalization happen at the API edge before queueing, or always
  inside the worker?
- What is the first pinned prompt version per prompt family?
- What is the first primary provider and primary model per stage, and what
  is the documented fallback policy?
- Should regeneration count be capped per visitor session or per job?
  SPEC-0004 specifies per simulation attempt; should the worker enforce per
  job or rely on the API for that enforcement?
- Should the dimension-guide overlay carry a worker watermark to deter
  screenshot reuse outside the simulation flow?
- Should the back-wall anchor be an admin-overridable field for failure
  recovery, or strictly worker-determined?
- Should the worker enforce a per-IP or per-session deduplication window
  before creating duplicate active jobs, or is that the API's
  responsibility?
- Should the worker emit operational events to a queue or rely on database
  polling for the lightweight operational overview?
- Should the visitor be allowed to adjust dimensions on regeneration, or
  must regeneration reuse the original dimensions to keep the size
  contract stable?
