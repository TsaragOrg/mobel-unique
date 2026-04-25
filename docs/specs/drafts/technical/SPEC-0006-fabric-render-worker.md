# SPEC-0006 Fabric Render Worker

Spec: SPEC-0006
Status: draft
Layer: technical
Parent Spec: SPEC-0005
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005
Areas: api, image-worker, supabase
Implementation Plans: none yet

## Traceability

This spec defines the first technical contract for the image worker area after the
repository foundation.

It follows `SPEC-0001 Repo Foundation`, which created the monorepo worker
boundary and the initial `workers/image` service foundation.

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

The existing local Python worker at `C:\dev\worker` is treated as a reference
implementation for the first fabric render generation core. Its behavior can be
used to seed repository implementation after this spec is accepted and an
implementation plan exists. This draft spec does not copy code and does not
approve any implementation change by itself.

## Goal

Define the first fabric render worker contract for generating a sofa render in a
target fabric.

The worker must support an administrator-driven render preparation flow where a
missing sofa, fabric, and visual matrix column render can be generated from:

- one fabric AI reference sofa image for the target fabric;
- one target sofa image for the sofa visual matrix column;
- one fixed prompt version;
- one configured AI image provider.

The output is a generated sofa render that preserves the target sofa photo,
camera, composition, geometry, and image dimensions while changing only the
visible upholstery material.

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
- how the current local Python worker maps to the future repository worker;
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
- a final decision to rewrite the reference Python worker in TypeScript.

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
5. The worker resolves the fabric AI reference sofa image and target sofa image.
6. The worker runs the fabric transfer generation pipeline.
7. On success, the worker stores a generated `output.png` artifact and marks the
   job as `succeeded`.
8. The generated render remains private until it is part of a public-usable
   visual matrix on a published sofa.
9. On failure, the worker stores a human-readable error message, marks the job
   as `failed` or returns it to `queued` for retry when the error is retryable.

## Data Model

The exact database schema belongs in a dedicated data model and storage spec.
This spec defines the logical data that must exist for the worker contract.

### Fabric Render Job

A fabric render job represents one attemptable unit of work for one sofa, one
target fabric, and one sofa visual matrix column.

The logical job record must track:

- job id;
- sofa id;
- fabric id;
- visual matrix column id;
- source target sofa artifact reference;
- source fabric AI reference sofa artifact reference;
- generated output artifact reference when successful;
- provider name;
- provider model;
- prompt version;
- status;
- attempt count;
- maximum attempts;
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

### Generated Render Artifact

A generated render artifact must track:

- storage path or object key;
- content type;
- width;
- height;
- source type `ai_generated`;
- provider name;
- provider model;
- prompt version;
- whether the artifact is the current public-usable image for its render cell.

The exact render publication model belongs in the render preparation and data
model specs.

## API

This spec does not approve final API route names.

Future API contracts must provide server-side admin-only behavior for:

- creating a fabric render job;
- listing relevant render jobs for admin review;
- reading job status and failure messages;
- retrying a failed job when retry is allowed;
- canceling a queued or processing job when supported by the implementation.

The API must enforce admin authorization before job creation.

The API must be responsible for validating that a requested job belongs to a
valid sofa, target fabric, and sofa visual matrix column.

The API must not expose service-role credentials, AI provider keys, or private
storage write credentials to the browser.

## Worker Jobs

### Job Type

The first worker job type is `fabric_render_generation`.

It generates one sofa render for one target fabric and one sofa visual matrix
column.

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

### Generation Core File Contract

The first generation core must support the following scratch folder contract:

```text
job-folder/
  fabric_ref.jpg
  target_sofa.jpg
  output.png
  error.txt
```

Rules:

- `fabric_ref.jpg` is the materialized fabric AI reference sofa image input;
- `target_sofa.jpg` is the target sofa image input;
- `output.png` is the successful generated output;
- `error.txt` is the human-readable failure artifact;
- stale `output.png` and `error.txt` must be cleared before a new initial
  generation attempt;
- a failed initial generation must not leave a stale `output.png`;
- a successful generation must not leave an `error.txt`.

The current local Python worker also supports `.jpeg` input aliases and a
refine mode. The first repository integration may preserve those behaviors, but
the required production contract is the initial generation contract above.

### Prompting

The first prompt version is `v007`.

The worker must treat `v007` as a fixed versioned prompt asset. Optional extra
instructions may be appended as a prompt note, but they must not replace the
base prompt.

The prompt must instruct the AI provider to:

- preserve the target sofa geometry;
- preserve the target camera view and composition;
- preserve the target sofa folds, seams, cushions, armrests, legs, and shape;
- use the fabric AI reference sofa image only for material, texture, color,
  weave, pattern, scale, and finish;
- avoid copying physical shape, shadows, folds, buttons, or room context from
  the fabric AI reference sofa image.

### Provider

The first approved provider for fabric render generation is Gemini.

The first approved model is:

```text
gemini-3-pro-image-preview
```

The worker must send inputs in this order:

1. fabric AI reference sofa image;
2. target sofa image;
3. assembled prompt.

The worker must provide role labels or equivalent provider instructions so the
provider understands that the first image is the material source and the second
image is the locked target photo.

If the provider does not return image data, the job must fail with a readable
error.

### Output Normalization

The generated output must be saved as `output.png`.

The final output dimensions must match the target sofa input dimensions after
EXIF orientation is applied.

If the provider returns a different size or aspect ratio, the worker must
normalize the output by center-cropping when necessary and resizing to the exact
target sofa dimensions.

### Retries

The default maximum attempts for one fabric render job is three total attempts.

The worker may retry transient provider, network, timeout, or rate-limit errors
until the maximum attempt count is reached.

The worker must not retry errors caused by missing input artifacts, invalid job
metadata, unsupported image files, or missing required environment variables.

After the final failed attempt, the job status must become `failed` and the last
error message must remain available for admin review.

This failure record is operational. It helps administrators and operators
understand why generation did not complete, but it must not be treated as a
public render state or as a public-usable render cell.

### Idempotency And Claiming

The system must prevent two workers from processing the same job at the same
time.

The job claim operation must be atomic. A worker can process a job only after it
successfully moves the job from `queued` to `processing` or refreshes a claim
through a defined recovery rule.

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

Generated outputs must remain private until the admin workflow makes the related
render cell public-usable and the sofa is published.

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
- `IMAGE_WORKER_POLL_INTERVAL_MS`: optional polling interval for queued jobs;
- `IMAGE_WORKER_MAX_ATTEMPTS`: optional override for maximum attempts;
- `IMAGE_WORKER_SCRATCH_DIR`: optional local scratch directory root.

DEV and PROD values must remain isolated.

No service-role credential or AI provider key may be exposed to `apps/web`.

## Acceptance Criteria

- The spec is traceable to `SPEC-0001`, `SPEC-0003`, `SPEC-0004`, and
  `SPEC-0005`.
- The first worker job type is defined as `fabric_render_generation`.
- The worker contract covers one sofa, one fabric, and one visual matrix column
  per job.
- The source selection rule distinguishes target sofa authority from fabric
  material authority.
- The source selection rule uses the target fabric's fabric AI reference sofa
  image, not the public fabric swatch image.
- The scratch folder contract defines `fabric_ref.jpg`, `target_sofa.jpg`,
  `output.png`, and `error.txt`.
- The first prompt version is fixed as `v007`.
- The first provider is Gemini with model `gemini-3-pro-image-preview`.
- The required job statuses are defined.
- Retryable and non-retryable failure categories are defined.
- The generated output must match target sofa dimensions.
- Generated renders remain private until they become public-usable through the
  admin workflow and the related sofa publication rules.
- Required worker environment variables are listed.
- The existing local Python worker is identified as a reference implementation
  without copying code in this spec.
- The spec does not define public customer in-home simulation behavior.
- The spec explicitly defers public customer in-home room simulation worker
  behavior to a separate follow-up spec.

## Open Questions

- Should the first repository implementation keep the generation core in Python,
  invoke it from the existing Node worker boundary, or replace the current
  worker runtime with a Python worker after a separate implementation plan?
- What are the final Supabase table names and storage bucket names?
- What maximum image dimensions and file sizes should the first production
  worker accept?
- Should prompt notes be admin-editable in MVP, or limited to internal operator
  use?
- Should refine mode from the local Python worker be included in the first
  repository implementation or deferred until generated render review needs it?
- What provider timeout should be used for Railway worker execution?
