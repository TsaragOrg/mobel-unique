# SPEC-0010 API Contracts And Edge Functions

Spec: SPEC-0010
Status: accepted
Layer: technical
Parent Spec: SPEC-0003
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0008, SPEC-0009
Areas: web, api, supabase, image-worker, shared
Implementation Plans: none yet

## Traceability

This spec is a follow-up technical spec created from:

- `SPEC-0003 Business Context - AI Sofa Visualization`;
- `SPEC-0004 Public Customer Experience`;
- `SPEC-0005 Admin Catalog and Fabric Management`;
- `SPEC-0006 Fabric Render Worker`;
- `SPEC-0007 In-Home Simulation Worker`;
- `SPEC-0008 Local Supabase Worker Development`;
- `SPEC-0009 Data Model And Storage`.

`SPEC-0009` defines the Supabase schema, storage buckets, storage paths, public/private data boundaries, and worker job tables. This spec defines the MVP API contracts and Supabase Edge Function boundaries that must use that data model.

This spec also incorporates the accepted change requests that affect API behavior:

- `CR-SPEC-0003-SPEC-0004 Email Verification Before Simulation`;
- `CR-SPEC-0004 Regeneration Failure Keeps Latest Result`;
- `CR-SPEC-0004 Wall Dimension Guide Modes`;
- `CR-SPEC-0003 Visual Matrix And Render Publication Alignment`;
- `CR-SPEC-0004-SPEC-0005 MVP Catalog Metadata Scope`;
- `CR-SPEC-0009 Resolve Open Questions`.

## Goal

Define the MVP API contracts and Edge Function boundaries so that:

- public visitors can browse published catalog data without seeing private data;
- public visitors can verify an email address before creating in-home simulation jobs;
- public visitors can create, poll, dimension, regenerate, and view retained simulation results through opaque access tokens and signed private URLs;
- administrators can manage sofas, fabrics, tags, visual matrix columns, uploads, render coverage, publication, archives, fabric render jobs, candidates, and ZIP exports through server-side APIs;
- workers can be invoked by server-side infrastructure without exposing worker internals to browsers;
- cleanup and maintenance jobs can run through protected internal APIs;
- local, DEV, and PROD environments can use the same logical contracts while keeping credentials, queue names, buckets, and domains isolated.

## Scope

This spec includes:

- canonical logical API route contracts for public visitor flows;
- canonical logical API route contracts for administrator catalog and render workflows;
- upload initiation and completion contracts for admin and visitor image uploads;
- email verification and consent API contracts needed before simulation generation;
- fabric render job creation, retry, cancellation, candidate review, and current-render selection contracts;
- in-home simulation job creation, polling, dimension submission, regeneration, and signed result URL contracts;
- ZIP export request, status, and download contracts;
- internal cleanup and worker invocation boundaries;
- request and response envelope conventions;
- error code conventions;
- security and data exposure requirements for Edge Functions.

## Out Of Scope

This spec does not define:

- final admin authentication implementation details;
- final privacy wording, consent copy, retention legal basis, or deletion request workflow;
- exact anti-abuse thresholds, CAPTCHA provider, or rate-limit numbers;
- final environment variable names and deployment platform settings;
- exact frontend page layouts;
- exact email provider, email template HTML, or sender identity;
- exact AI prompts, provider parameters, or Gemini implementation details;
- Shopify synchronization, Shopify product import, pricing, cart, checkout, orders, payment, or stock management;
- public customer accounts or long-term customer galleries.

Those topics belong to later specs for privacy, retention, abuse protection, admin auth, operations, environment, deployment, and implementation plans.

## Contract Conventions

### Logical Route Prefixes

The MVP API contracts use these logical route prefixes:

- `/api/public/*` for unauthenticated visitor-safe reads and verified visitor simulation actions;
- `/api/admin/*` for administrator-only back-office actions;
- `/api/internal/*` for scheduler, cleanup, service-to-service, and worker-control actions.

Implementations may route these logical paths through one or more Supabase Edge Functions, or through a thin web proxy that calls Supabase Edge Functions, as long as the external contracts and security boundaries remain the same.

Browser-facing code must not depend on raw Supabase table names, private bucket paths, queue table names, service-role keys, provider keys, or worker-only Edge Function names.

### Response Envelope

Successful JSON responses should use a stable envelope:

```json
{
  "data": {},
  "meta": {}
}
```

Errors should use:

```json
{
  "error": {
    "code": "READABLE_ERROR_CODE",
    "message": "Readable message.",
    "details": {}
  }
}
```

The `message` value may be user-facing only when the endpoint is public and the message does not reveal private operational details. Internal provider errors, storage paths, SQL details, and stack traces must not be returned to browsers.

### HTTP Statuses

The API should use these status categories consistently:

- `200 OK` for successful reads and synchronous actions;
- `201 Created` for resource creation;
- `202 Accepted` for asynchronous jobs that were queued or started;
- `204 No Content` for successful actions with no response body;
- `400 Bad Request` for invalid shape or invalid field values;
- `401 Unauthorized` for missing or invalid authentication;
- `403 Forbidden` for authenticated users without required permission;
- `404 Not Found` for unknown public resources or hidden private resources;
- `409 Conflict` for state conflicts, duplicate active jobs, or stale updates;
- `410 Gone` for known public sofa slugs that are unavailable because the sofa was unpublished or archived;
- `413 Payload Too Large` for uploads over the accepted limit;
- `415 Unsupported Media Type` for unsupported upload formats;
- `422 Unprocessable Entity` for valid JSON that fails domain validation;
- `429 Too Many Requests` for rate limiting or abuse protection;
- `500 Internal Server Error` for unexpected failures without private details;
- `503 Service Unavailable` for temporary provider, worker, or queue unavailability when retry may be appropriate.

### Identifiers

Public visitor APIs may expose:

- public sofa slugs;
- public tag slugs;
- opaque public simulation job identifiers;
- opaque simulation access tokens;
- stable public asset URLs from `catalog-public-assets`.

Public visitor APIs must not expose:

- private storage bucket names or object paths;
- database table ids for private verification, consent, simulation session, worker, or storage metadata rows when that would weaken access control;
- Supabase Queue message ids;
- provider names, provider models, prompt versions, or raw failure messages;
- service-role credentials or provider keys.

Admin APIs may expose database ids needed by the admin UI, but must still avoid exposing service-role credentials, provider keys, raw signed URL secrets, and unrelated private visitor data.

### Pagination And Sorting

List endpoints should support:

- `limit`, capped server-side;
- `cursor` for forward pagination when the list can grow;
- deterministic sort rules defined per endpoint.

Offset pagination may be used only for small admin lists where implementation plans justify it.

### Idempotency

Mutation endpoints that create jobs, upload records, publication transactions, or ZIP export requests should support an optional `idempotency_key`.

The API must use server-side idempotency or domain uniqueness rules to prevent accidental duplicate active worker jobs and duplicate destructive operations.

## Users And Permissions

### Public Visitor

Public visitors are unauthenticated until they verify an email address for simulation generation.

Public visitors may:

- read published catalog data;
- read published sofa detail data by public slug;
- request and verify an email code before simulation;
- create in-home simulation jobs only through a verified simulation session;
- poll only their own simulation jobs through an opaque access token;
- submit dimensions only for their own `awaiting_dimensions` jobs;
- regenerate only within the MVP generation limit and verified session;
- receive short-lived signed URLs only for private simulation artifacts that belong to their verified session.

Public visitors must not:

- read draft or archived sofa data;
- create fabric render jobs;
- access admin APIs;
- access worker APIs;
- upload directly to private buckets unless the API has created a tightly scoped upload capability tied to a verified simulation job action;
- see another visitor's simulation job, room photo, guide, or result.

### Administrator

Administrators may use `/api/admin/*` after the admin auth model proves authorization.

Admin APIs must support the MVP's single administrator assumption from `SPEC-0003`, while not baking in a design that prevents future multiple-admin audit behavior.

Until a later admin auth spec defines claims and roles, implementation plans may use a conservative server-side admin gate, but browser code must not receive service-role credentials.

### API Service

The API service runs as Supabase Edge Functions or equivalent server-side code with server-side credentials.

It owns:

- public response assembly;
- admin catalog mutations;
- private upload orchestration;
- publication transactions;
- email verification and simulation sessions;
- worker job creation and queue message creation;
- signed URL generation for authorized private artifact reads;
- cleanup orchestration.

### Workers

Worker Edge Functions may claim and update durable job records. Worker functions are not public API surfaces.

Workers must not:

- be called directly by public browser code in DEV or PROD;
- return private bucket paths or signed URLs to browsers;
- make public catalog publication decisions;
- accept generated fabric render candidates as current render cells;
- create public catalog asset copies.

Local smoke tests may expose simplified worker invocation with `verify_jwt = false` only for local development. That exception must not define the production contract.

## Edge Function Boundary

The implementation should organize Edge Functions by security boundary:

- public read and public simulation functions may be callable by anonymous browsers but must enforce all public access rules internally;
- admin functions must require admin authorization;
- internal cleanup and worker-control functions must require scheduler or service authorization;
- worker functions must use service-side credentials and must not be invoked by public UI;
- fabric render worker functions should be invoked by service-side orchestration after explicit admin actions, not by scheduler-first pickup.

The final function names may differ from the logical route groups if an implementation plan documents the mapping. The logical contracts in this spec remain the product-facing contract.

## Public Catalog API

### `GET /api/public/catalog`

Returns a paginated list of published sofas.

Query parameters:

- `tag` repeated public tag slug filter; multiple tags use `AND` behavior;
- `limit` optional;
- `cursor` optional.

Sorting:

- first by `manual_public_order` when present;
- then by newest `created_at` among currently published sofas.

Response data:

```json
{
  "items": [
    {
      "id": "public-sofa-id",
      "public_slug": "sofa-slug",
      "public_name": "Sofa name",
      "public_description": "Optional description.",
      "dimensions": {
        "length_cm": 240,
        "depth_cm": 95,
        "height_cm": 80,
        "footprint_type": "rectangle",
        "footprint_measurements": {}
      },
      "tags": [
        {
          "slug": "convertible",
          "public_label": "Convertible"
        }
      ],
      "default_fabric_id": "fabric-id",
      "default_visual_position_id": "visual-position-id",
      "default_render_url": "https://public-catalog-asset-url",
      "shopify_order_url": "https://shopify.example/product"
    }
  ],
  "next_cursor": "opaque-cursor"
}
```

The response must not expose internal names, private paths, draft data, archived sofa data, provider metadata, worker job state, or private render candidates.

### `GET /api/public/catalog/tags`

Returns public tags that are assigned to at least one published sofa.

Response data:

```json
{
  "items": [
    {
      "slug": "convertible",
      "public_label": "Convertible"
    }
  ]
}
```

The endpoint must not return tags that are unused by published sofas.

### `GET /api/public/sofas/{public_slug}`

Returns the public sofa detail state for a published sofa.

Response data:

```json
{
  "sofa": {
    "id": "public-sofa-id",
    "public_slug": "sofa-slug",
    "public_name": "Sofa name",
    "public_description": "Optional description.",
    "dimensions": {
      "length_cm": 240,
      "depth_cm": 95,
      "height_cm": 80,
      "footprint_type": "rectangle",
      "footprint_measurements": {}
    },
    "tags": [],
    "shopify_order_url": "https://shopify.example/product"
  },
  "fabrics": [
    {
      "id": "fabric-id",
      "public_name": "Fabric name",
      "is_premium": false,
      "public_order": 1,
      "swatch_url": "https://public-catalog-asset-url"
    }
  ],
  "visual_positions": [
    {
      "id": "visual-position-id",
      "sequence": 1,
      "public_label": "Front"
    }
  ],
  "renders": [
    {
      "fabric_id": "fabric-id",
      "visual_position_id": "visual-position-id",
      "render_url": "https://public-catalog-asset-url",
      "width_px": 1600,
      "height_px": 1200
    }
  ],
  "defaults": {
    "fabric_id": "fabric-id",
    "visual_position_id": "visual-position-id"
  }
}
```

Unavailable behavior:

- return `404` with `SOFA_NOT_FOUND` when the slug was never known or cannot be safely disclosed;
- return `410` with `SOFA_UNAVAILABLE` when the slug belongs to a known sofa that is no longer published and the API can disclose only that unavailable state without private details.

Public asset URLs must be stable public URLs from `catalog-public-assets`, not signed URLs generated per request.

## Public Email Verification API

The API must support email verification before simulation generation.

Exact retention durations, resend limits, verification attempt limits, email copy, consent wording, and abuse thresholds belong to the privacy, retention, and abuse protection spec. This API spec defines the contract shape required by the product flow.

### `POST /api/public/simulation/email-verifications`

Starts or resends an email verification attempt.

Request:

```json
{
  "email": "visitor@example.com",
  "required_email_consent": {
    "decision": "granted",
    "wording_version": "email-verification-v1",
    "locale": "fr-FR"
  },
  "optional_commercial_contact_consent": {
    "decision": "granted",
    "wording_version": "commercial-contact-v1",
    "locale": "fr-FR"
  }
}
```

Rules:

- required email-use consent must be granted before a verification code is sent;
- optional commercial contact consent must be stored separately from required email-use consent;
- the API must normalize and hash email addresses before storing lookup values;
- plaintext verification codes must never be stored;
- the response must not reveal whether an email has been used before;
- rejected optional commercial consent must not block simulation.

Response:

```json
{
  "verification_request_id": "opaque-verification-id",
  "status": "code_sent",
  "expires_at": "2026-04-28T12:00:00Z",
  "resend_available_at": "2026-04-28T11:55:00Z"
}
```

### `POST /api/public/simulation/email-verifications/{verification_request_id}/verify`

Verifies an email code and creates or refreshes a verified simulation session.

Request:

```json
{
  "code": "123456"
}
```

Response:

```json
{
  "simulation_access_token": "opaque-access-token",
  "expires_at": "2026-04-29T12:00:00Z"
}
```

Rules:

- the token returned to the browser must be opaque;
- only a hash of the access token may be stored;
- the token authorizes only simulation actions allowed by this spec;
- failed verification attempts must not expose plaintext code or email data.

## Public In-Home Simulation API

Public simulation APIs require a valid `simulation_access_token` issued by the email verification flow.

The access token may be passed through an `Authorization: Bearer <token>` header or another implementation-approved opaque session mechanism. The API must hash and compare the token server-side.

### `POST /api/public/simulations`

Creates an in-home simulation job atomically with the visitor's room photo upload.

Request type:

- `multipart/form-data`.

Required fields:

- `sofa_slug`;
- `fabric_id`;
- `visual_position_id`;
- `room_photo`;
- optional `idempotency_key`.

Rules:

- the selected sofa, fabric, and visual position must form a currently published public-usable triple at creation time;
- the selected render cell must have a current public render and a private source asset usable for simulation preparation;
- room photo formats may include JPEG, PNG, WebP, HEIC, and HEIF when worker normalization supports them;
- job creation plus room upload must be atomic from the visitor's perspective;
- if storage upload succeeds but DB creation fails, the API must either clean up immediately or leave the object under an orphan cleanup prefix;
- the API must set a retention deadline no later than 24 hours after job creation for the MVP.

Response:

```json
{
  "simulation_job_id": "opaque-job-id",
  "status": "queued",
  "created_at": "2026-04-28T12:00:00Z",
  "retention_deadline": "2026-04-29T12:00:00Z"
}
```

The API must enqueue the durable simulation job for worker processing. The queue message must contain only the minimum information required to find the durable job row and intended stage.

### `GET /api/public/simulations/{simulation_job_id}`

Returns current simulation status for the verified visitor session.

Possible response states:

- `queued`;
- `room_prep_processing`;
- `awaiting_dimensions`;
- `placement_queued`;
- `placement_processing`;
- `succeeded`;
- `failed`;
- `canceled`;
- `expired`.

Response example:

```json
{
  "simulation_job_id": "opaque-job-id",
  "status": "awaiting_dimensions",
  "geometry_mode": "back_wall",
  "dimension_guide": {
    "signed_url": "https://short-lived-signed-url",
    "expires_at": "2026-04-28T12:05:00Z"
  },
  "required_dimensions": [
    {
      "key": "wall_width",
      "unit": "m"
    },
    {
      "key": "wall_height",
      "unit": "m"
    }
  ],
  "latest_result": null,
  "regeneration_available": false,
  "retention_deadline": "2026-04-29T12:00:00Z"
}
```

For `corner` mode, required dimensions are:

- `left_wall_width`;
- `right_wall_width`;
- `room_height`.

For `back_wall` mode, required dimensions are:

- `wall_width`;
- `wall_height`.

The API must return short-lived signed URLs for private simulation guide and result artifacts only when the verified session matches the job. It must never return private object paths.

If a regeneration fails after at least one successful output exists, the response must keep the latest successful result available while retained and may include a readable regeneration error.

### `POST /api/public/simulations/{simulation_job_id}/dimensions`

Submits dimensions for a job in `awaiting_dimensions`.

Request for `back_wall`:

```json
{
  "geometry_mode": "back_wall",
  "dimensions": {
    "wall_width": 4.2,
    "wall_height": 2.6
  }
}
```

Request for `corner`:

```json
{
  "geometry_mode": "corner",
  "dimensions": {
    "left_wall_width": 3.8,
    "right_wall_width": 4.1,
    "room_height": 2.6
  }
}
```

Rules:

- dimensions must be metre values;
- the submitted geometry mode must match the job's detected mode;
- all required dimensions for the mode must be present and positive;
- extra dimension fields must be rejected for MVP unless a later spec adds them;
- successful submission must transition the job toward placement processing and enqueue the placement stage.

Response:

```json
{
  "simulation_job_id": "opaque-job-id",
  "status": "placement_queued"
}
```

### `POST /api/public/simulations/{simulation_job_id}/regenerations`

Requests another generated output for a completed simulation job.

Rules:

- the job must belong to the verified simulation session;
- the latest successful result must remain available while retained;
- the total successful output count must not exceed three for the MVP;
- failed regeneration must not increment successful output count;
- regeneration must not require re-uploading the room photo or re-entering dimensions while retained.

Response:

```json
{
  "simulation_job_id": "opaque-job-id",
  "status": "placement_queued",
  "reserved_generation_index": 1
}
```

## Admin Catalog API

All `/api/admin/*` endpoints require admin authorization.

The API must not include generic admin notes, created-by fields, updated-by fields, or dimension visibility flags in MVP request or response contracts unless a later accepted spec adds them.

### Sofa Endpoints

Required logical endpoints:

- `GET /api/admin/sofas`;
- `POST /api/admin/sofas`;
- `GET /api/admin/sofas/{sofa_id}`;
- `PATCH /api/admin/sofas/{sofa_id}`;
- `POST /api/admin/sofas/{sofa_id}/archive`;
- `POST /api/admin/sofas/{sofa_id}/unpublish`;
- `GET /api/admin/sofas/{sofa_id}/publication-readiness`;
- `POST /api/admin/sofas/{sofa_id}/publish`.

Sofa create/update payload fields:

- `internal_name`;
- `public_name`;
- `shopify_order_url`;
- `public_description`;
- `length_cm`;
- `depth_cm`;
- `height_cm`;
- `footprint_type`;
- `footprint_measurements`;
- `manual_public_order`;
- public tag assignments.

Rules:

- `internal_name` is admin-only;
- public dimensions on a published sofa are public;
- `public_slug` is generated automatically and frozen after first publication;
- publish must be a server-side transaction;
- invalid edits to a published sofa must not mutate the current public read model;
- archive must keep historical slug unavailable instead of deleting the sofa.

Publication readiness response:

```json
{
  "ready": false,
  "errors": [
    {
      "code": "MISSING_PUBLIC_FABRIC",
      "message": "At least one active public fabric is required."
    }
  ]
}
```

### Tag Endpoints

Required logical endpoints:

- `GET /api/admin/tags`;
- `POST /api/admin/tags`;
- `PATCH /api/admin/tags/{tag_id}`;
- `DELETE /api/admin/tags/{tag_id}`.

Rules:

- tags are public customer-facing labels;
- tag slugs are generated for filtering;
- deletion is allowed only when unused;
- no hierarchy, categories, semantic search, or manual public tag order is required for MVP.

### Fabric Endpoints

Required logical endpoints:

- `GET /api/admin/fabrics`;
- `POST /api/admin/fabrics`;
- `GET /api/admin/fabrics/{fabric_id}`;
- `PATCH /api/admin/fabrics/{fabric_id}`;
- `POST /api/admin/fabrics/{fabric_id}/archive`.

Fabric create/update fields:

- `internal_name`;
- `public_name`;
- `swatch_asset_id`;
- `ai_reference_asset_id`;
- `is_premium`.

Rules:

- fabrics cannot be deleted from the back office;
- archived fabrics are hidden from new assignments but retained for historical references;
- fabric AI reference images remain private;
- public swatch copies are created or refreshed only when needed by public sofa behavior.

### Sofa Fabric Assignment Endpoints

Required logical endpoints:

- `GET /api/admin/sofas/{sofa_id}/fabrics`;
- `PUT /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `PATCH /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`;
- `DELETE /api/admin/sofas/{sofa_id}/fabrics/{fabric_id}`.

Rules:

- assignment alone does not expose a fabric publicly;
- non-null `public_order` means the admin intends the fabric to be publicly selectable;
- publication still requires render coverage across all active visual positions.

### Visual Matrix Column Endpoints

Required logical endpoints:

- `GET /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `POST /api/admin/sofas/{sofa_id}/visual-matrix-columns`;
- `PATCH /api/admin/visual-matrix-columns/{column_id}`;
- `DELETE /api/admin/visual-matrix-columns/{column_id}`.

Rules:

- admin APIs may use the internal term `visual_matrix_column`;
- public APIs must use `visual_position`;
- sequence values are unique among active columns for a sofa;
- deleting a column is a soft delete that sets `deleted_at`; the API must not hard-delete visual matrix column rows;
- soft-deleting a column is a destructive admin action and must require explicit admin confirmation in the UI;
- adding a column to a published sofa must not break the current public read model.

## Admin Upload API

Admin uploads must go through server-side authorization.

Supported upload purposes:

- `fabric_swatch`;
- `fabric_ai_reference`;
- `sofa_source_photo`;
- `manual_render`.

### `POST /api/admin/uploads`

Creates a tightly scoped upload request.

Request:

```json
{
  "purpose": "sofa_source_photo",
  "content_type": "image/png",
  "byte_size": 1200000,
  "sofa_id": "sofa-id",
  "fabric_id": "fabric-id",
  "visual_matrix_column_id": "column-id"
}
```

Response:

```json
{
  "upload_id": "opaque-upload-id",
  "method": "signed_upload",
  "signed_upload_url": "https://short-lived-upload-url",
  "expires_at": "2026-04-28T12:05:00Z"
}
```

Rules:

- browser writes to private buckets are allowed only through tightly scoped signed upload capabilities created by the API;
- the API must choose the storage bucket and object path;
- private object paths must not be reusable or guessable by the browser outside the signed upload action;
- upload limits and image validation must be enforced server-side before the asset can be used.

### `POST /api/admin/uploads/{upload_id}/complete`

Completes a signed upload and creates or attaches a `storage_assets` row after validation.

Response:

```json
{
  "asset": {
    "id": "asset-id",
    "asset_kind": "sofa_source_photo",
    "content_type": "image/png",
    "byte_size": 1200000,
    "width_px": 1600,
    "height_px": 1200
  }
}
```

Rules:

- sofa source photos and fabric AI reference images must be rejected if over 2048 px on the longest edge for render generation inputs;
- unsupported content types must be rejected;
- incomplete uploads must not become usable assets;
- completing a `sofa_source_photo` upload must atomically attach the source photo to the visual matrix column and synchronize the matching source fabric render cell as `source_type = 'source_photo'`;
- source photo completion must not create or refresh public asset copies;
- public catalog assets are created by publication logic, not by arbitrary browser upload completion.

## Admin Render Coverage API

### `GET /api/admin/sofas/{sofa_id}/render-coverage`

Returns the admin render matrix for one sofa.

Response data must include:

- active visual matrix columns;
- assigned fabrics;
- current render cell state for each sofa, fabric, and column combination;
- source type for current render;
- whether private render coverage exists;
- whether a cell is complete from a source photo for the original fabric;
- whether public asset copy exists for currently published state;
- relevant pending, processing, failed, and succeeded fabric render jobs;
- private candidate ids and signed review URLs only for authorized admin review.

The endpoint must not expose private storage paths directly. Admin review URLs for private assets must be short-lived signed URLs.

The endpoint must not advertise initial generation as available for a render cell whose current private render is the matching source photo for that cell's original fabric.

### `POST /api/admin/render-cells/{render_cell_id}/manual-render`

Sets a manually uploaded private render asset as the current private render for a cell.

Rules:

- the asset must belong to the same sofa, fabric, and visual matrix column context or be explicitly attached through the endpoint;
- setting a manual render does not publish it;
- publication logic owns public asset copy creation.

### `POST /api/admin/fabric-render-jobs`

Creates a fabric render generation job.

Request:

```json
{
  "sofa_id": "sofa-id",
  "fabric_id": "fabric-id",
  "visual_matrix_column_id": "column-id",
  "generation_mode": "initial",
  "refinement_source_asset_id": null,
  "prompt_note": "Optional initial generation note.",
  "refine_prompt": null,
  "idempotency_key": "optional-key"
}
```

Rules:

- the API must validate that the sofa, fabric, and visual matrix column form a valid render cell;
- initial mode requires the visual matrix column to have a current source image usable as the target sofa input;
- initial mode requires the fabric to have a private AI reference image;
- initial mode must reject the source photo's own original fabric cell when that source photo already satisfies the current private render for the cell;
- initial mode may accept `prompt_note` and must not accept `refine_prompt`;
- refine mode requires a refinement source asset for the same sofa, fabric, and visual matrix column;
- refine mode requires a non-empty `refine_prompt` and must not accept `prompt_note`;
- refine mode sends only the selected current output image and the refine prompt to the provider, not the fixed `v007` prompt, fabric AI reference image, or target sofa image;
- no equivalent active job may exist unless the admin explicitly requests a new generation;
- the API creates the durable `fabric_render_jobs` row with a `request_id` for this explicit admin action and starts service-side worker processing by invoking the internal fabric render Edge Function pump after the database write succeeds;
- if worker start fails before the worker owns the job, the API must avoid creating a durable job or persist the created job as `failed` with a safe error message;
- fabric render job creation must not depend on cron pickup or automatic background retry as the normal product path.

The worker pump may start one-job worker invocations for queued jobs that share
the `request_id`, up to `FABRIC_RENDER_MAX_CONCURRENT_JOBS`. Implementation
plans must define claim order, concurrency, timeout behavior, and how admin
actions such as 15 or 50 generated renders are drained without cron.

When rejecting an ineligible source-photo-satisfied cell, the API should use a stable validation error such as `FABRIC_RENDER_JOB_CONFLICT` with a readable message explaining that the source photo already satisfies the original fabric render cell.

Response:

```json
{
  "job_id": "fabric-render-job-id",
  "request_id": "admin-action-request-id",
  "status": "queued"
}
```

The response status reflects the durable job status at response time. A
successful response does not mean image generation has completed.

### `POST /api/admin/sofas/{sofa_id}/fabric-render-jobs/generate-all`

Creates initial fabric render generation jobs for all eligible missing render
cells on one sofa.

Rules:

- the endpoint is an explicit administrator action;
- the API must validate the sofa and all eligible render cells using the same
  initial mode rules as single-job creation;
- the API must create one durable `fabric_render_jobs` row per eligible cell;
- all jobs created by the request must share one generated `request_id`;
- the API must invoke the internal fabric render Edge Function pump once after
  the database write succeeds;
- if no cells are eligible, the endpoint must return a safe no-op response and
  must not invoke the worker;
- if worker start fails before any worker owns the jobs, the API must avoid
  creating durable jobs or persist the created jobs as `failed` with a safe
  error message according to the implementation plan.

Response:

```json
{
  "request_id": "admin-action-request-id",
  "job_ids": ["fabric-render-job-id"],
  "status": "queued",
  "total_jobs": 15
}
```

### `GET /api/admin/fabric-render-jobs/{job_id}`

Returns job status, attempt metadata, readable failure messages, and candidate references for admin review.

The response must not include provider secrets, service credentials, or raw private object paths.

### `POST /api/admin/fabric-render-jobs/{job_id}/retry`

Retries a failed fabric render job when retry is allowed.

Rules:

- retry is a manual administrator action;
- retry must create a new queue message or new durable job with a new `request_id` and invoke the internal fabric render Edge Function pump according to the implementation plan;
- retry must not make any previous output public-usable;
- retry must preserve enough audit context for admin troubleshooting.

### `POST /api/admin/fabric-render-jobs/resume`

Manually resumes queued fabric render jobs that are not currently being
processed.

Rules:

- resume is an explicit administrator action;
- the request must be scoped by `request_id`, `sofa_id`, or another
  implementation-plan-approved admin-safe scope;
- resume must invoke the internal fabric render Edge Function pump;
- resume must not restart `processing`, `succeeded`, `failed`, or `canceled`
  jobs;
- resume must not depend on cron or automatic background pickup.

### `POST /api/admin/fabric-render-jobs/{job_id}/cancel`

Cancels a queued or processing fabric render job when supported.

Rules:

- cancellation of already succeeded jobs must be rejected;
- cancellation must not delete private candidates already produced by previous successful jobs.

### `GET /api/admin/render-cells/{render_cell_id}/candidates`

Lists private generated render candidates for a render cell.

Response data includes:

- candidate id;
- created time;
- generation mode;
- provider display metadata when safe for admin operations;
- prompt version;
- signed private review URL;
- whether the candidate is currently selected as the cell's private render.

### `POST /api/admin/render-candidates/{candidate_id}/use-as-current`

Explicitly selects a private generated render candidate as the current private render for its render cell.

Rules:

- this is an administrator action;
- the worker must not perform this action automatically;
- the selected candidate remains private until publication logic creates or refreshes public copies;
- the endpoint updates `sofa_render_cells.current_private_asset_id` and `accepted_fabric_render_candidate_id`;
- no separate persistent approve/reject status is required for MVP.

This endpoint preserves the `SPEC-0006` and `SPEC-0009` rule that workers create private candidates and administrators decide whether a candidate becomes current render coverage.

## Admin Publication API

### `POST /api/admin/sofas/{sofa_id}/publish`

Publishes a sofa through a server-side transaction.

The transaction must:

- validate required public metadata;
- validate slug creation or frozen slug behavior;
- validate Shopify URL shape;
- validate active visual matrix columns;
- validate active public-ordered fabrics;
- validate render coverage for every public-ordered active fabric across every active visual position;
- validate public swatch availability or create public swatch copies;
- create or refresh public render copies in `catalog-public-assets`;
- reject without mutating the current public read model when validation fails.

Response:

```json
{
  "sofa_id": "sofa-id",
  "lifecycle_state": "published",
  "public_slug": "sofa-slug",
  "published_at": "2026-04-28T12:00:00Z"
}
```

### `POST /api/admin/sofas/{sofa_id}/unpublish`

Returns a sofa to draft while preserving historical slug state.

Rules:

- public render copies must be removed, purged, or deactivated so unavailable sofa renders are not intentionally served by the application;
- direct public URLs may remain cached by infrastructure for a short time, but the API must not continue to reference them.

### `POST /api/admin/sofas/{sofa_id}/archive`

Archives a sofa.

Rules:

- archived sofas are not public;
- archived public slug behavior must produce unavailable behavior, not redirect to a different sofa;
- archived sofas cannot be deleted through the back office.

## Admin ZIP Export API

### `POST /api/admin/sofas/{sofa_id}/render-exports`

Creates a ZIP export request for all render assets currently available for a sofa.

Rules:

- admins can request ZIP export for draft or published sofas whenever render assets exist;
- ZIP artifacts are private;
- export availability must not depend on public catalog publication;
- `expires_at`, when used, applies only to the generated ZIP artifact cache, not to the admin's ability to request a new export later.

Response:

```json
{
  "export_id": "export-id",
  "status": "queued"
}
```

### `GET /api/admin/render-exports/{export_id}`

Returns export status, included render count, errors, and a signed private download URL when complete.

The signed URL must be short-lived and admin-only.

## Internal Worker And Cleanup APIs

### Worker Invocation

Worker Edge Functions are internal surfaces.

The API may invoke:

- fabric render worker processing;
- in-home simulation room preparation processing;
- in-home simulation placement processing.

Rules:

- worker functions must require service-side authorization in DEV and PROD;
- local smoke tests may use unauthenticated local function invocation only when documented by local development plans;
- fabric render worker invocation must be triggered by an explicit admin request and must not rely on cron as the normal product path;
- worker functions must claim jobs atomically from durable job tables;
- workers must record status transitions and safe operational errors;
- workers must not return private paths to browser callers.

### Fabric Render Worker Contract

The fabric render worker must:

- read `fabric_render_jobs`;
- in pump mode, keep up to the configured number of job workers active for a `request_id`;
- in job mode, claim one eligible job atomically from durable database state and process only that job;
- read private input assets;
- write private generated output assets;
- create `fabric_render_candidates`;
- mark jobs `succeeded` or `failed`;
- leave candidate selection to admin APIs.

The worker must not:

- update `sofa_render_cells.current_private_asset_id` as part of job success;
- set `accepted_fabric_render_candidate_id` as part of job success;
- create public catalog asset copies;
- publish or unpublish sofas.

### In-Home Simulation Worker Contract

The in-home simulation worker must:

- read `in_home_simulation_jobs`;
- use the job prefix model under `simulation-private-artifacts`;
- move jobs through room preparation, awaiting dimensions, placement, succeeded, failed, canceled, or expired states;
- write `simulation_generated_outputs` only for successful generated outputs;
- keep generated outputs private;
- preserve the latest successful output when a later regeneration fails;
- never create catalog assets from visitor simulation outputs.

### Cleanup Endpoints

Required internal cleanup contracts:

- `POST /api/internal/cleanup/orphan-room-uploads`;
- `POST /api/internal/cleanup/expired-simulations`;
- `POST /api/internal/cleanup/expired-zip-exports`;
- `POST /api/internal/cleanup/unavailable-public-assets`.

Rules:

- cleanup endpoints require scheduler or service authorization;
- cleanup must be idempotent;
- cleanup must not delete current public assets for published sofas;
- simulation purge must delete private image content and clear or redact usable private paths;
- cleanup responses may include counts but must not include private customer image paths.

## Admin Auth Dependency

This spec requires an admin authorization boundary but does not define the final admin auth mechanism.

Before DEV or PROD admin endpoints are exposed, a later admin auth and operations spec must define:

- how the single MVP administrator authenticates;
- how admin claims are represented to Edge Functions;
- how local admin smoke tests authenticate;
- how service-role credentials remain server-side only;
- whether activity logs are needed before multiple administrators exist.

Until then, implementation plans may create local-only admin smoke paths, but those paths must be clearly marked as local and must not become production defaults.

## Privacy, Retention, And Abuse Dependency

This spec defines the API shape needed for email verification, consent capture, simulation access, signed URLs, and cleanup.

A later privacy, retention, and abuse protection spec must define:

- final consent wording and wording version policy;
- email verification code length, expiry, resend limits, and attempt limits;
- email retention and deletion behavior;
- IP and user-agent hashing policy;
- rate limits for verification, simulation creation, polling, dimensions, regeneration, and signed URL generation;
- abuse escalation behavior;
- analytics consent persistence if required.

Implementation plans must not treat unspecified thresholds in this spec as approval to skip abuse protection.

## Environment And Deployment Dependency

A later environment and deployment spec must define final names and values for:

- public API base URLs;
- Supabase project URLs and keys per environment;
- service-role key storage;
- admin auth secrets;
- queue names per environment;
- bucket names when configurable;
- signed URL TTLs;
- email provider configuration;
- cleanup schedules;
- CORS origins;
- function verification settings;
- DEV and PROD deployment checks.

Queue names and bucket references must not be hard-coded to local names in DEV or PROD behavior.

## Security Requirements

The API must enforce these cross-cutting requirements:

- service-role credentials never reach browser-facing code;
- provider keys never reach browser-facing code;
- private bucket paths are never returned to public visitors;
- signed URLs are short-lived and scoped to the authorized user action;
- public catalog image URLs are stable public URLs, not signed URLs generated at read time;
- public endpoints do not reveal whether an email has existing history;
- admin endpoints do not expose unrelated visitor personal data;
- worker endpoints are not browser-callable in DEV or PROD;
- CORS allows only approved origins per environment;
- all state-changing endpoints validate content type and request size;
- all file upload completion endpoints validate content type, byte size, and image dimensions before assets become usable.

## API Testing Requirements

Implementation plans for this spec must add tests for:

- public catalog returns only published sofas;
- public tags include only tags assigned to published sofas;
- public sofa detail returns `410` unavailable behavior for known unavailable slugs when safe;
- public catalog responses never include private paths or internal names;
- admin sofa publication readiness rejects incomplete sofas;
- admin publication creates public asset copies and preserves slug freeze;
- admin unpublish/archive removes or deactivates public asset references;
- admin upload completion rejects invalid image type and oversized render inputs;
- fabric render job creation rejects invalid sofa, fabric, or visual matrix combinations;
- fabric render job creation enforces `prompt_note` only for initial mode and
  `refine_prompt` only for refine mode;
- fabric render worker success creates private candidates without auto-selecting them as current render;
- admin candidate selection updates the current render cell only through the admin endpoint;
- ZIP export can be requested for draft and published sofas;
- email verification stores required and optional consent separately;
- simulation job creation requires verified access;
- dimension submission validates `back_wall` and `corner` payloads exactly;
- failed regeneration keeps the latest successful output available;
- signed URL generation rejects access to another visitor's job;
- anonymous users cannot call admin or internal endpoints;
- local smoke exceptions do not apply to DEV or PROD defaults.

## Acceptance Criteria

- The spec traces to `SPEC-0003` through `SPEC-0009`.
- Public catalog APIs expose only published visitor-safe data.
- Public catalog asset URLs are public stable URLs and not per-request signed URLs.
- Public sofa detail supports unavailable behavior for unpublished or archived known slugs.
- Public simulation APIs require verified email access before job creation.
- Required email-use consent and optional commercial contact consent are separate in API contracts.
- Simulation job creation is atomic with room photo upload from the visitor's perspective.
- Dimension submission supports only `back_wall` and `corner` MVP payloads.
- Regeneration contracts preserve the latest successful output after failed regeneration.
- Admin APIs cover sofa, tag, fabric, assignment, visual matrix, upload, render coverage, publication, archive, and ZIP export workflows.
- Admin upload APIs keep browser writes tightly scoped and server-authorized.
- Fabric render APIs create worker jobs without exposing worker internals to public visitors.
- Fabric render worker success creates private candidates only; admin candidate selection is a separate API action.
- ZIP exports remain private and can be requested regardless of draft or published sofa state.
- Worker and cleanup APIs are internal and require service-side authorization outside local smoke tests.
- The spec explicitly defers final admin auth, privacy thresholds, and environment deployment details to later specs.

## Review Checklist For Next Pass

- Compare all public catalog fields against `SPEC-0004` and the public read model in `SPEC-0009`.
- Confirm admin catalog endpoints cover every operation in `SPEC-0005` without adding admin notes or actor fields.
- Confirm fabric render job and candidate endpoints preserve `SPEC-0006` worker boundaries.
- Confirm simulation endpoints cover every public flow and worker status from `SPEC-0007`.
- Confirm local smoke exceptions from `SPEC-0008` do not leak into DEV or PROD defaults.
- Confirm all API responses avoid private paths and provider details prohibited by `SPEC-0009`.
- Confirm the future privacy, admin auth, and environment specs have clear ownership of deferred decisions.

## Open Questions

- None. Deferred decisions are explicitly assigned to later privacy, admin auth, operations, environment, or deployment specs.
