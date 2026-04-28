# SPEC-0006 Fabric Render Worker

Spec: SPEC-0006
Status: accepted
Layer: technical
Parent Spec: SPEC-0005
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005
Areas: api, supabase
Implementation Plans: none yet

## Traceability

This spec defines the first technical contract for Supabase-hosted image job
processing after the repository foundation.

It follows `SPEC-0001 Repo Foundation`, which created the monorepo worker
boundary. The first production implementation for this spec uses Supabase Edge
Functions rather than the initial `workers/image` Node service foundation.

It follows `SPEC-0003 Business Context - AI Sofa Visualization`, which defines
the product as an AI sofa visualization tool, requires complete public render
coverage for published sofa fabrics, allows both manual uploads and AI-generated
renders, and requires dedicated follow-up specs for worker jobs and AI
providers.

It follows `SPEC-0004 Public Customer Experience`, which defines the
customer-facing fabric selector, visual position selector, public-usable render
requirements, and in-home simulation entry point.

It follows `SPEC-0005 Admin Catalog and Fabric Management`, which defines the
admin-managed visual matrix, source photo preparation, fabric AI reference sofa
image requirements, manual render uploads, AI render generation entry points,
render coverage review, publication readiness checks, and the MVP decision that
publishing a sofa is the administrator's acceptance of the current visual
matrix.

The production implementation must use Supabase Edge Functions written in
TypeScript on the Deno runtime, with Supabase Queues as the durable job queue.
This spec does not copy code and does not approve any implementation change by
itself.

## Goal

Define the first fabric render worker contract for generating a sofa render in a
target fabric and for refining an existing generated render.

The worker must support an administrator-driven render preparation flow where a
missing sofa, fabric, and visual matrix column render can be generated in
`initial` mode from:

- one fabric AI reference sofa image for the target fabric;
- one target sofa image for the sofa visual matrix column;
- one fixed prompt version;
- one configured AI image provider.

The output is a generated sofa render that preserves the target sofa photo,
camera, composition, geometry, and image dimensions while changing only the
visible upholstery material.

The worker must also support a `refine` mode for follow-up editing of an
existing render. Refine mode uses only the selected current render output, an
administrator-provided refine prompt, and a short provider instruction that
identifies the image as the current output to edit. Refine mode does not use
the `v007` fabric transfer prompt, the fabric AI reference image, or the target
sofa image as provider inputs.

## Scope

This spec includes:

- the first fabric render generation job type;
- the logical input and output artifact contract;
- the required job statuses;
- the first AI provider and model decision for fabric renders;
- prompt versioning for the first fabric render generation flow;
- storage ownership rules for inputs, generated outputs, and worker scratch
  files;
- retry, failure, and idempotency expectations;
- the Supabase Edge Functions and Supabase Queues runtime decision;
- the minimum environment variables required by the worker.

The first job type is limited to public sofa render preparation for the admin
workflow. It generates a render for one sofa, one target fabric, and one sofa
visual matrix column at a time.

## Out Of Scope

This spec does not define:

- the public customer in-home room simulation worker;
- customer room photo processing;
- admin UI screens;
- public UI screens;
- exact API routes;
- exact Supabase table definitions or migrations;
- exact Supabase Storage bucket names;
- admin authentication;
- manual render upload implementation;
- admin render coverage UI implementation;
- ZIP export implementation;
- pricing, cart, checkout, orders, or Shopify synchronization;
- a provider cost dashboard;
- a Python production worker runtime.

Those details must be covered by dedicated follow-up specs or implementation
plans when their parent behavior is approved.

The public customer in-home room simulation worker must be defined in a
separate follow-up spec because it processes customer room photos, result email
delivery, retention behavior, and regeneration limits.

## Users And Permissions

### Administrator

An administrator can request fabric render generation for sofa render
preparation through the private back office once the related admin and API
contracts exist.

The administrator can review generated outputs as part of render coverage before
publishing a sofa. A generated render must not become visible to visitors
automatically.

### Visitor

A public visitor cannot create fabric render jobs, view worker scratch files, or
access private generated renders that are not part of a published public-usable
visual matrix.

### API Service

The API service is expected to create and update render job records on behalf of
authorized admin users.

The browser must not call the worker directly.

### Image Worker

The image worker runs with private server-side credentials. It may read private
input artifacts, call the configured AI provider, write generated outputs, and
update operational job status.

Service-role credentials and AI provider keys must remain server-side only.

## User Flow

1. The administrator prepares a sofa, assigns fabrics, and defines the sofa's
   ordered visual matrix columns.
2. The system identifies a missing visual-column-and-fabric render that can be
   completed by AI generation.
3. The API creates a fabric render job for one sofa, one fabric, and one visual
   matrix column.
4. The worker claims the queued job.
5. For `initial` mode, the worker resolves the fabric AI reference sofa image
   and target sofa image.
6. For `refine` mode, the worker resolves the selected current output image and
   the administrator-provided refine prompt.
7. The worker runs the relevant generation or refinement pipeline.
8. On success, the worker stores a generated `output.png` artifact as a private
   generated render candidate and marks the job as `succeeded`.
9. The generated render candidate remains private until the admin workflow
   explicitly makes it the public-usable render for the related visual matrix
   cell and the sofa is published.
10. On failure, the worker stores a human-readable error message, marks the job
    as `failed` or returns it to `queued` for retry when the error is retryable.

## Data Model

The exact Supabase table names, relationships, storage bucket names, storage
paths, and database constraints belong in a dedicated Supabase data model and
storage specification. This spec defines the logical data that must exist for
the worker contract.

### Fabric Render Job

A fabric render job represents one attemptable unit of work for one sofa, one
target fabric, and one sofa visual matrix column.

The logical job record must track:

- job id;
- sofa id;
- fabric id;
- visual matrix column id;
- generation mode, either `initial` or `refine`;
- source target sofa artifact reference;
- source fabric AI reference sofa artifact reference;
- refinement source render artifact reference when generation mode is `refine`;
- optional prompt note appended to the fixed base prompt for `initial` mode;
- refine prompt text when generation mode is `refine`;
- generated render candidate artifact reference when successful;
- provider name;
- provider model;
- prompt version;
- status;
- attempt count;
- maximum attempts;
- queued timestamp;
- claimed by identifier when available;
- claim expiration timestamp when a worker is processing the job;
- last attempt started timestamp;
- last error message;
- created timestamp;
- claimed timestamp;
- completed timestamp.

### Job Status

The required status values are:

- `queued`: the job is waiting for a worker;
- `processing`: one worker has claimed the job;
- `succeeded`: output was generated and stored;
- `failed`: the job cannot continue without a new admin or system action;
- `canceled`: the job was intentionally stopped before completion.

The implementation may add internal transition metadata, but it must not expose
generated output publicly before the admin workflow makes the related render
cell public-usable and the sofa is published.

The `failed` job status is an operational worker status. It records that the
worker could not complete a generation attempt. It is not a render validation
state and does not create a persistent render-domain record for a failed output.

### Generated Render Candidate Artifact

A generated render candidate artifact is a private output produced by a
successful worker job. It is attached to the source sofa, fabric, visual matrix
column, and job, but it is not public-usable by itself.

A generated render candidate artifact must track:

- storage path or object key;
- content type;
- width;
- height;
- source type `ai_generated`;
- generation mode, either `initial` or `refine`;
- refinement source render artifact reference when generation mode is `refine`;
- provider name;
- provider model;
- prompt version;
- originating job id;
- sofa id;
- fabric id;
- visual matrix column id;
- whether the artifact is the current public-usable image for its render cell.

The worker must create only a private generated render candidate. A separate
admin workflow must decide whether that candidate becomes the current
public-usable image for the render cell.

The exact render publication model belongs in the render preparation and data
model specs.

## API

This spec does not approve final API route names.

Future API contracts must provide server-side admin-only behavior for:

- creating an initial fabric render job;
- creating a refine fabric render job from an existing render artifact for the
  same sofa, fabric, and visual matrix column;
- listing relevant render jobs for admin review;
- reading job status and failure messages;
- retrying a failed job when retry is allowed;
- canceling a queued or processing job when supported by the implementation.

The API must enforce admin authorization before job creation.

The API must be responsible for validating that a requested job belongs to a
valid sofa, target fabric, and sofa visual matrix column.

Before creating a job, the API must validate these preconditions:

- the sofa exists;
- the target fabric exists;
- the visual matrix column exists;
- the sofa, target fabric, and visual matrix column form a valid render cell
  for that sofa;
- in `initial` mode, the visual matrix column has a selected target sofa source
  image artifact;
- in `initial` mode, the target fabric has a fabric AI reference sofa image
  artifact;
- in `initial` mode, an optional prompt note may be appended to the fixed `v007`
  prompt;
- in `refine` mode, the refinement source render artifact belongs to the same
  sofa, fabric, and visual matrix column as the requested job;
- in `refine` mode, a non-empty refine prompt is required;
- in `refine` mode, prompt notes are not accepted because the refine prompt is
  the main edit instruction;
- no equivalent active job already exists for the same sofa, fabric, visual
  matrix column, source input set, provider, model, prompt version, generation
  mode, prompt note, and refine prompt unless the administrator explicitly
  requests a new generation.

Image readability and the 2048 px upload limit are upload-time invariants and
do not need to be repeated as separate job-creation checks in the MVP.

The API must not expose service-role credentials, AI provider keys, or private
storage write credentials to the browser.

## Worker Jobs

### Job Type

The first worker job type is `fabric_render_generation`.

It generates one sofa render for one target fabric and one sofa visual matrix
column. The job supports two generation modes:

- `initial`: creates a render from the target sofa image and the fabric AI
  reference sofa image;
- `refine`: creates a revised render from an existing render artifact selected
  by the administrator and a non-empty refine prompt.

### Runtime And Queue

The first production implementation must run as Supabase Edge Functions written
in TypeScript on the Deno runtime.

Supabase Queues must provide durable job queueing. Each fabric render generation
must be queued as an independent message so an admin batch can create many jobs
at once while each job remains retryable, observable, and claimable on its own.

The queue consumer function may process more than one queued message per
invocation, but it must respect a configurable concurrency limit based on the
active Gemini project rate limits and the operational needs of the MVP.

The production runtime must not depend on Python or a long-running external
worker process for this spec.

### Source Selection

For a visual-column-and-fabric cell that already has a public-usable manual
render, generated render, or original source render, the system should not
create a fabric render generation job for that cell unless the administrator
explicitly requests regeneration.

For a missing visual-column-and-fabric cell, the generation job must use:

- the visual matrix column's selected target sofa source image as the target
  sofa input;
- the target fabric's AI reference sofa image as the material input.

The target sofa source image is the geometry and composition authority.

The fabric AI reference sofa image is the material authority only.

For a refine job, the refinement source render is the only image sent to the
provider. It represents the current output the administrator wants to improve
in place. It must belong to the same sofa, fabric, and visual matrix column as
the requested job. The target sofa source image and fabric AI reference image
remain important job context, but they are not provider image inputs in refine
mode.

### Generation Core File Contract

The first generation core must support the following scratch folder contract for
`initial` mode:

```text
job-folder/
  fabric_ref.jpg
  target_sofa.jpg
  output.png
  error.txt
```

The first generation core must support the following scratch folder contract for
`refine` mode:

```text
job-folder/
  refine_source.png
  output.png
  error.txt
```

Rules:

- `fabric_ref.jpg` is the materialized fabric AI reference sofa image input for
  `initial` mode;
- `target_sofa.jpg` is the target sofa image input for `initial` mode;
- `refine_source.png` is required for `refine` mode and is the existing render
  artifact selected by the administrator for refinement;
- `output.png` is the successful generated output;
- `error.txt` is the human-readable failure artifact;
- stale `output.png` and `error.txt` must be cleared before a new initial
  generation or refine attempt;
- a failed generation or refine attempt must not leave a stale `output.png`;
- a successful generation must not leave an `error.txt`.

The first TypeScript implementation must include refine mode as a required MVP
behavior.

### Prompting

The first `initial` mode prompt version is `v007`.

The worker must treat `v007` as a fixed versioned prompt asset. The base system
prompt is not editable by administrators or operators in the MVP.

An administrator may add optional extra instructions as a prompt note for a
specific `initial` generation request. The prompt note must be appended to the
fixed base prompt and must not replace, weaken, or override the base prompt.

The `initial` mode prompt must instruct the AI provider to:

- preserve the target sofa geometry;
- preserve the target camera view and composition;
- preserve the target sofa folds, seams, cushions, armrests, legs, and shape;
- use the fabric AI reference sofa image only for material, texture, color,
  weave, pattern, scale, and finish;
- avoid copying physical shape, shadows, folds, buttons, or room context from
  the fabric AI reference sofa image.

For `refine` mode, the worker must not assemble or send the fixed `v007`
fabric transfer prompt. The administrator-provided refine prompt is the main
edit instruction. The worker must send a short provider role label or
equivalent instruction that identifies the image as the current output to edit.
The implementation may record a refine prompt version or wrapper version for
traceability, but `v007` must not be treated as the active prompt content for
refine provider calls.

### Provider

The first approved provider for fabric render generation is Gemini.

The first approved model is:

```text
gemini-3-pro-image-preview
```

For `initial` mode, the worker must send inputs in this order:

1. fabric AI reference sofa image;
2. target sofa image;
3. assembled `v007` prompt.

The worker must provide role labels or equivalent provider instructions so the
provider understands that the first image is the material source and the second
image is the locked target photo.

For `refine` mode, the worker must send inputs in this order:

1. current output image selected for refinement;
2. administrator-provided refine prompt text with a short current-output role
   label or equivalent provider instruction.

Refine mode must not send the fabric AI reference image or target sofa image to
the provider.

If the provider does not return image data, the job must fail with a readable
error.

### Image Size Limits

Fabric render source artifacts must have passed upload-time validation before
they can be used for a job.

The first production `initial` flow accepts target sofa input images up to 2048
px on the longest edge.

If the target sofa input image is smaller than or equal to 2048 px on the
longest edge after EXIF orientation is applied, the worker must use the target
sofa input image's original dimensions as the final normalized output
dimensions for `initial` mode.

If the worker encounters a target sofa input image larger than 2048 px on the
longest edge, the job must fail as a non-retryable upload-invariant violation
with a readable error. The first production worker must not downscale oversized
target sofa input images as part of the generation job.

The fabric AI reference sofa image must also be accepted up to 2048 px on the
longest edge for `initial` mode. If the worker encounters a larger fabric AI
reference sofa image, the job must fail as a non-retryable upload-invariant
violation with a readable error.

For `refine` mode, the refinement source image is the final normalized output
dimension authority. If the worker encounters an unreadable or unsupported
refinement source image, the job must fail as a non-retryable input invariant
violation with a readable error.

### Output Normalization

The generated output must be saved as `output.png`.

Before calling the provider in `initial` mode, the worker must read the exact
target sofa input dimensions after EXIF orientation is applied. The target sofa
image is the authority for the final normalized output dimensions.

Before calling the provider in `refine` mode, the worker must read the exact
refinement source image dimensions after EXIF orientation is applied. The
selected current output image is the authority for the final normalized output
dimensions.

For the Gemini provider, the worker must calculate the authority image aspect
ratio and choose the closest aspect ratio supported by the active Gemini image
model. The worker must send that closest supported aspect ratio in the provider
request by using `generationConfig.imageConfig.aspectRatio` for REST requests or
the SDK-equivalent field for SDK requests.

The worker must not put exact pixel dimension instructions, such as
`1478x2048`, in the `initial` fabric transfer prompt or the `refine` prompt
wrapper. Pixel-perfect final dimensions are enforced by output normalization,
not by prompt text.

After a successful provider response, the worker must normalize the returned
image to the authority dimensions for the generation mode:

- `initial` output must be normalized to the target sofa dimensions;
- `refine` output must be normalized to the selected current output image
  dimensions.

If the provider output already has the exact authority dimensions, the worker
may keep the image without crop or resize other than format canonicalization.

If the provider output aspect ratio differs from the authority aspect ratio, the
worker must use a centered crop of the full image canvas. This is a simple
canvas crop. The worker must not detect the sofa, compute a sofa bounding box,
segment the foreground, or perform any other smart crop.

After the optional centered crop, the worker must resize the image to the exact
authority width and height.

The normalized artifact must be saved as `output.png`. Stored output metadata
must describe the normalized `output.png`, including the final normalized width,
height, byte size, and content type. The worker may record raw provider output
dimensions for diagnostics if a later plan adds a place to store them, but raw
dimensions are not the authoritative generated candidate dimensions.

### Retries

The default maximum attempts for one fabric render job is three total attempts.

The worker may retry transient provider, network, timeout, or rate-limit errors
until the maximum attempt count is reached.

The worker must not retry errors caused by missing input artifacts, invalid job
metadata, unsupported image files, upload-invariant violations such as an
oversized source artifact, or missing required environment variables.

For each processing attempt, the worker must increment `attempt_count` when it
successfully claims the job and starts the attempt.

If an error is retryable and attempts remain, the job must return to `queued`
with the last error message preserved for operational review.

If an error is non-retryable, or if no attempts remain after a retryable error,
the job must become `failed`.

After the final failed attempt, the job status must become `failed` and the last
error message must remain available for admin review.

This failure record is operational. It helps administrators and operators
understand why generation did not complete, but it must not be treated as a
public render state or as a public-usable render cell.

### Timeout

The fabric render queue consumer Edge Function must be deployed with the maximum
execution timeout allowed by the active Supabase plan and environment.

The first production implementation must not introduce a shorter
application-level provider timeout for Gemini image generation. The generation
request may use the full Edge Function execution budget because each invocation
is processing queued jobs rather than serving an interactive browser request.

If the Supabase platform timeout interrupts an invocation before the job can be
marked `succeeded` or `failed`, the job claim recovery and retry rules must make
the job eligible for another attempt without exposing a stale generated output.

### Idempotency And Claiming

The system must prevent two workers from processing the same job at the same
time.

The job claim operation must be atomic. A worker can process a job only after it
successfully moves the job from `queued` to `processing` or recovers an expired
claim through the recovery rule below.

When a worker claims a job, the claim operation must:

- move the job from `queued` to `processing`;
- increment `attempt_count`;
- set `claimed_at`;
- set `claimed_by` when a worker identifier is available;
- set `last_attempt_started_at`;
- set `claim_expires_at` to the current time plus
  `FABRIC_RENDER_CLAIM_TTL_SECONDS`.

The default fabric render claim TTL is 5 minutes.

If a job is in `processing` and `claim_expires_at` has passed before the job
reaches `succeeded`, `failed`, or `canceled`, the recovery process must inspect
the job before retrying it:

- if attempts remain, the job returns to `queued`;
- if no attempts remain, the job becomes `failed` and the last error message
  must identify that the worker claim expired.

If a persistent generated output exists for a job whose status is not
`succeeded`, the recovery process must not make that output public-usable. The
MVP recovery rule is conservative: only a job that has been explicitly marked
`succeeded` can expose its generated render candidate to the admin review flow.

The system should avoid creating duplicate active jobs for the same sofa,
fabric, visual matrix column, source input set, provider, model, and prompt
version.

### Storage

Persistent input and output artifacts belong in server-controlled storage.

Worker scratch folders are temporary local files and must not be treated as the
source of truth after job completion.

The worker must download or materialize the required input artifacts into its
scratch folder, run generation, then upload or persist the generated output
artifact through the approved storage path.

Generated outputs are private generated render candidates. They must remain
private until the admin workflow explicitly makes the related render cell
public-usable and the sofa is published.

### Observability

The worker must record enough operational information to debug and monitor
generation:

- job id;
- status transitions;
- attempt count;
- provider;
- provider model;
- prompt version;
- input artifact references;
- output artifact reference when successful;
- failure message when failed;
- start and completion timestamps.

The operational view should remain lightweight for MVP.

## Environment Variables

The worker environment must include:

- `APP_ENV`: `dev`, `prod`, or `local`;
- `SUPABASE_URL`: Supabase project URL for the matching environment;
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service credential;
- `GEMINI_API_KEY`: server-only Gemini provider key;
- `FABRIC_RENDER_QUEUE_NAME`: Supabase Queue name for fabric render jobs;
- `FABRIC_RENDER_MAX_ATTEMPTS`: optional override for maximum attempts;
- `FABRIC_RENDER_MAX_CONCURRENT_JOBS`: optional concurrency limit for one queue
  consumer invocation;
- `FABRIC_RENDER_CLAIM_TTL_SECONDS`: optional override for the worker claim TTL,
  defaulting to 300 seconds;
- `FABRIC_RENDER_TMP_DIR`: optional local temporary directory root, defaulting
  to an Edge Function-compatible temporary directory when needed.

DEV and PROD values must remain isolated.

No service-role credential or AI provider key may be exposed to `apps/web`.

## Acceptance Criteria

- The spec is traceable to `SPEC-0001`, `SPEC-0003`, `SPEC-0004`, and
  `SPEC-0005`.
- The first worker job type is defined as `fabric_render_generation`.
- The worker contract covers one sofa, one fabric, and one visual matrix column
  per job.
- The worker contract supports both `initial` and `refine` generation modes in
  the first implementation.
- The source selection rule distinguishes target sofa authority from fabric
  material authority.
- The source selection rule uses the target fabric's fabric AI reference sofa
  image, not the public fabric swatch image, for `initial` mode.
- `refine` mode uses the selected current output image and a required refine
  prompt, without sending `fabric_ref.jpg`, `target_sofa.jpg`, or the fixed
  `v007` prompt to the provider.
- The scratch folder contract defines `fabric_ref.jpg`, `target_sofa.jpg`,
  `output.png`, and `error.txt` for `initial` mode.
- The scratch folder contract defines `refine_source.png`, `output.png`, and
  `error.txt` for `refine` mode.
- The production runtime is Supabase Edge Functions written in TypeScript on the
  Deno runtime, with Supabase Queues providing durable job queueing.
- The first `initial` mode prompt version is fixed as `v007`.
- The base system prompt is not editable, and admin-supplied prompt notes may
  only be appended as additional instructions for `initial` mode.
- Admin-supplied refine prompt text is the main edit instruction for `refine`
  mode and is not treated as an appended prompt note.
- The first provider is Gemini with model `gemini-3-pro-image-preview`.
- The required job statuses are defined.
- Retryable and non-retryable failure categories are defined.
- Worker processing claims have a default 5-minute TTL and expired claims are
  retried only while attempts remain.
- API job-creation preconditions are defined without duplicating upload-time
  image readability and 2048 px limit checks.
- The fabric render queue consumer Edge Function uses the maximum execution
  timeout allowed by the active Supabase plan and environment.
- The first production worker accepts target sofa and fabric AI reference images
  for `initial` mode up to 2048 px on the longest edge and uses the original
  target sofa dimensions as the final normalized output dimensions when they
  are below that maximum.
- The worker must calculate the authority image aspect ratio and send the
  closest Gemini-supported aspect ratio through provider configuration for
  `initial` and `refine` modes.
- The worker must not put exact pixel dimension instructions in the `initial`
  fabric transfer prompt or the `refine` prompt wrapper.
- The worker must normalize successful provider image data with simple centered
  crop and resize so `initial` outputs match the target sofa dimensions and
  `refine` outputs match the selected current output image dimensions.
- Output normalization must not use smart crop, sofa detection, foreground
  segmentation, or sofa bounding boxes.
- Generated output metadata must describe the normalized `output.png`, not the
  raw provider output dimensions.
- Generated renders are private generated render candidates until they become
  public-usable through the admin workflow and the related sofa publication
  rules.
- Required worker environment variables are listed.
- Python is not the production runtime for this spec.
- The spec does not define public customer in-home simulation behavior.
- The spec explicitly defers public customer in-home room simulation worker
  behavior to a separate follow-up spec.
- The spec explicitly defers final Supabase table names, relationships, storage
  bucket names, storage paths, and database constraints to a dedicated Supabase
  data model and storage specification.

## Open Questions

None.
