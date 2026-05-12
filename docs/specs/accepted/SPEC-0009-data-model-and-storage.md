# SPEC-0009 Data Model And Storage

Spec: SPEC-0009
Status: accepted
Layer: technical
Parent Spec: SPEC-0003
Depends On: SPEC-0001, SPEC-0003, SPEC-0004, SPEC-0005, SPEC-0006, SPEC-0007, SPEC-0008
Areas: web, api, image-worker, supabase, shared
Implementation Plans: none yet

## Traceability

This spec is a follow-up technical spec created from `SPEC-0003 Business Context - AI Sofa Visualization`.

It formalizes the Supabase database schema, storage buckets, storage path conventions, public/private data boundaries, and retention fields needed by:

- `SPEC-0004 Public Customer Experience`;
- `SPEC-0005 Admin Catalog and Fabric Management`;
- `SPEC-0006 Fabric Render Worker`;
- `SPEC-0007 In-Home Simulation Worker`;
- `SPEC-0008 Local Supabase Worker Development`.

This spec is expected to feed later specs and plans for:

- API contracts;
- privacy, retention, and abuse protection;
- admin authentication and operations;
- environment and deployment;
- Supabase migrations, RLS policies, and storage policies.

`CR-SPEC-0015-SPEC-0020-remove-simulation-email-retention` supersedes any
retained public-simulation email identity requirements in this spec. Public
simulation tables must not keep readable or encrypted email for lead/contact
use; they may keep only short-lived server-HMAC verification subjects required
for OTP request binding and 24-hour abuse prevention.

This spec also incorporates
`CR-SPEC-0007-SPEC-0009-SPEC-0010-SPEC-0012-SPEC-0015 In-Home Checkpoint Pump
And Realtime Progress`, which adds durable in-home simulation checkpoint state
and a public-safe Realtime progress surface.

Accepted specs already define the product behavior. This spec defines the storage shape needed to support that behavior without approving API route names, UI layouts, provider prompts, or final privacy wording.

## Goal

Define the MVP production data model and storage model for the Mobel Unique visualization tool so that:

- administrators can prepare sofas, fabrics, tags, visual matrix columns, render coverage, publication, archives, and ZIP exports;
- public visitors can browse only published visitor-safe catalog data;
- public visitors can run verified in-home simulations without public accounts;
- workers can process fabric render jobs and in-home simulation jobs through Supabase Queues;
- private customer room photos, intermediate artifacts, and generated simulation outputs remain private and are purged within the MVP retention limit;
- DEV, PROD, and local Supabase environments can use the same logical schema while keeping data, buckets, and queues isolated.

## Scope

This spec includes:

- final logical table names for the MVP Supabase schema;
- required enum values and lifecycle states;
- table ownership, primary relationships, required fields, uniqueness rules, and key indexes;
- storage bucket names and bucket visibility;
- storage path conventions for catalog, render, export, worker, and simulation artifacts;
- public read model requirements for catalog and sofa detail data;
- RLS and storage policy boundaries;
- server-side publication, archival, cleanup, and retention invariants;
- compatibility expectations for the local worker foundation created by `SPEC-0008`.

## Out Of Scope

This spec does not define:

- exact API endpoint names, request payloads, or response payloads;
- exact UI layouts or admin screen structure;
- exact email verification copy, consent banner wording, or legal retention wording;
- exact anti-abuse thresholds;
- final admin role model beyond the data structures needed to support it;
- AI provider implementation details;
- prompt file paths;
- Vercel or Supabase project settings;
- Shopify synchronization, Shopify import, pricing, cart, checkout, orders, or stock management;
- public customer accounts or long-term customer galleries.

Those details belong to dedicated follow-up specs or implementation plans.

## Users And Permissions

### Visitor

A visitor is an unauthenticated public user.

The data model must allow a visitor to read only visitor-safe public catalog data through public API responses or public read views.

A visitor must not be able to:

- read draft or archived sofas;
- read admin-only fields;
- read private storage paths;
- read source photos, fabric AI reference images, private render candidates, worker scratch artifacts, customer room photos, intermediate simulation artifacts, or private generated simulation outputs;
- read another visitor's simulation job or result;
- write directly to catalog, render, job, consent, or storage metadata tables.

### Administrator

An administrator is an authenticated back-office user.

The data model must support administrators preparing and reviewing catalog records, fabrics, render coverage, publication readiness, worker job status, and lightweight simulation operations.

Administrators must not bypass public/private storage boundaries from the browser. Admin uploads, render generation, publication, ZIP exports, and destructive operations must go through server-side Supabase Edge Functions or equivalent server-side API logic with admin authorization.

### API Service

The API service runs with server-side credentials. It owns:

- catalog mutations requested by authorized administrators;
- public read response assembly;
- email verification and verified simulation session creation;
- room photo upload plus atomic simulation job creation;
- signed URL generation for private artifacts that the current visitor may see;
- publication and archival transactions;
- cleanup orchestration where required by implementation plans.

### Image Worker

Image worker Edge Functions run with private server-side credentials. They may:

- claim and update worker jobs;
- read private input artifacts;
- write private generated artifacts;
- update job status and operational metadata;
- enqueue or delete Supabase Queue messages according to worker specs.

Workers must not expose service-role keys, provider keys, private bucket paths, or signed URLs to browsers.

## Data Model Overview

The MVP schema should use the Supabase `public` schema for application tables unless an implementation plan documents a stronger reason to separate schemas.

The following table groups are required:

- catalog tables for sofas, fabrics, tags, assignments, visual matrix columns, and source photos;
- storage metadata tables for managed catalog and render assets;
- render coverage tables for current render cells, generated candidates, and ZIP export requests;
- worker job tables for fabric render generation and in-home simulation;
- verification and consent tables for email verification and simulation access;
- operational event tables for lightweight job status history when simple timestamps are insufficient.

The schema may add implementation-only helper columns if they preserve the public/private and product behavior defined here.

## Required Enums

The first production migration must define these logical enum sets, either as Postgres enum types or constrained text fields:

- `sofa_lifecycle_state`: `draft`, `published`, `archived`.
- `fabric_lifecycle_state`: `active`, `archived`.
- `asset_visibility`: `public`, `private`.
- `asset_lifecycle_state`: `active`, `deleted`, `purged`.
- `render_source_type`: `source_photo`, `manual_upload`, `ai_generated`.
- `fabric_render_generation_mode`: `initial`, `refine`.
- `fabric_render_job_status`: `queued`, `processing`, `succeeded`, `failed`, `canceled`.
- `simulation_job_status`: `queued`, `room_prep_processing`, `awaiting_dimensions`, `placement_queued`, `placement_processing`, `succeeded`, `failed`, `canceled`, `expired`.
- `room_geometry_mode`: `back_wall`, `corner`.
- `simulation_checkpoint_key`: `room_validation`, `room_cleaning`,
  `room_corners`, `dimension_guide`, `awaiting_dimensions`,
  `placement_generation`, `placement_measurement`, `placement_finalize`,
  `completed`, `failed`, `expired`.
- `simulation_checkpoint_status`: `queued`, `processing`, `succeeded`,
  `retrying`, `failed`, `canceled`, `expired`.
- `consent_type`: `email_verification_required`, `commercial_contact_optional`, `analytics_optional`.
- `consent_decision`: `granted`, `rejected`, `revoked`.
- `worker_job_type`: `fabric_render_generation`, `in_home_simulation`.

Implementations may use lowercase text values externally. Public APIs must not expose internal enum names that are not relevant to visitors.

## Catalog Tables

### `sofas`

`sofas` stores the administrator-managed sofa catalog.

Fields:

- `id` uuid primary key;
- `lifecycle_state` with values from `sofa_lifecycle_state`;
- `internal_name` text, required;
- `public_name` text, required before publication;
- `public_slug` text, generated automatically and unique when present;
- `shopify_order_url` text, required before publication;
- `public_description` text;
- `length_cm` numeric;
- `depth_cm` numeric;
- `height_cm` numeric;
- `footprint_type` text for simple rectangle, corner, angled, triangular, or other practical footprint categories;
- `footprint_measurements` jsonb for additional footprint dimensions needed by non-rectangular sofas;
- `manual_public_order` integer, nullable;
- `first_published_at` timestamp;
- `published_at` timestamp;
- `archived_at` timestamp;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique index on `public_slug` when not null;
- index on `lifecycle_state`;
- index supporting public catalog order by `lifecycle_state`, `manual_public_order`, and `created_at`;
- check constraints requiring positive numeric dimensions when present;
- trigger or equivalent server-side guard preventing `public_slug` changes after `first_published_at` is set;
- publication transaction must reject publication unless required public fields and render readiness pass.

`first_published_at` is set once on first successful publication and is the slug-freeze marker. `published_at` represents the current or most recent publication timestamp used for operational display; it may change on later publish/unpublish workflows while `first_published_at` remains stable.

Public catalog fallback order must use `created_at` among currently published sofas, not `published_at`. This preserves the `SPEC-0004` rule that the default catalog order is newest created published sofas first unless the administrator defines a manual order.

Unpublishing a sofa returns it to `draft` while preserving `public_slug` and `first_published_at` if it has ever been published. Archiving changes `lifecycle_state` to `archived` and keeps the historical slug unavailable rather than redirecting it.

Sofas cannot be deleted from the back office and can only be archived through supported admin behavior. The public visualization link is derived from `public_slug` and the deployment domain; it does not require a separate persisted URL field.

In the MVP, sofa dimensions stored on a published sofa are public dimensions. The schema must not add a per-sofa dimension visibility flag until a later accepted spec or change request defines a real need for private or admin-only dimensions.

The MVP schema must not include free-form admin note fields on sofas. If administrators later need internal notes or richer admin-only metadata, that should be added through a later accepted spec or change request so the admin UI does not gain low-value fields by default.

The MVP schema must not include per-row `created_by` or `updated_by` actor fields for sofas because `SPEC-0003` approves a single administrator role for MVP. If a later admin-auth or operations spec adds multiple administrators, actor attribution should be added as part of that explicit audit or activity-log design.

### `public_tags`

`public_tags` stores reusable public catalog filter labels.

Fields:

- `id` uuid primary key;
- `public_label` text, required;
- `slug` text, generated for stable internal filtering;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique index on `slug`;
- unique case-insensitive index on `public_label` if practical for the selected collation.

Rules:

- public labels may be French customer-facing content;
- tags can be deleted only when unused;
- no tag hierarchy, categories, semantic search, or manual public tag order is required for MVP.

### `sofa_tags`

`sofa_tags` assigns public tags to sofas.

Fields:

- `sofa_id` uuid reference to `sofas`;
- `tag_id` uuid reference to `public_tags`;
- `created_at` timestamp.

Required constraints and indexes:

- primary key or unique index on `(sofa_id, tag_id)`;
- index on `tag_id`;
- delete protection that prevents deleting a tag while any assignment exists.

### `fabrics`

`fabrics` stores reusable administrator-managed fabric records.

Fields:

- `id` uuid primary key;
- `lifecycle_state` with values from `fabric_lifecycle_state`;
- `internal_name` text, required;
- `public_name` text, required;
- `swatch_asset_id` uuid reference to `storage_assets`, required;
- `ai_reference_asset_id` uuid reference to `storage_assets`, required;
- `is_premium` boolean, required;
- `archived_at` timestamp;
- `created_at` timestamp;
- `updated_at` timestamp.

Rules:

- fabrics are created only when required information is valid and complete;
- fabrics cannot be deleted from the back office;
- archived fabrics are hidden from new assignments but retained for historical references;
- the public swatch image may be copied or promoted to public storage only when it is needed by a public sofa experience;
- the fabric AI reference sofa image remains private.
- the MVP schema must not include free-form admin note fields on fabrics unless a later accepted spec or change request defines a clear admin workflow for them.

### `sofa_fabrics`

`sofa_fabrics` assigns fabrics to sofas and controls public fabric ordering.

Fields:

- `sofa_id` uuid reference to `sofas`;
- `fabric_id` uuid reference to `fabrics`;
- `public_order` integer, nullable;
- `assigned_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- primary key or unique index on `(sofa_id, fabric_id)`;
- unique partial index on `(sofa_id, public_order)` where `public_order` is not null;
- indexes on `fabric_id` and `sofa_id`.

Rules:

- assignment alone does not expose a fabric publicly;
- a non-null `public_order` means the administrator intends the fabric to be publicly selectable for that sofa;
- publication and public read logic must still require the fabric to be active and complete public-usable render coverage across all active visual matrix columns;
- the lowest `public_order` among eligible fabrics is the default public fabric.

### `visual_matrix_columns`

`visual_matrix_columns` stores the administrator-defined visual positions for each sofa.

Fields:

- `id` uuid primary key;
- `request_id` uuid identifying the explicit admin action that created one or
  more fabric render jobs;
- `sofa_id` uuid reference to `sofas`;
- `sequence` integer, required;
- `admin_label` text;
- `public_label` text, nullable;
- `current_source_photo_id` uuid, nullable reference to `sofa_source_photos`;
- `deleted_at` timestamp, nullable;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique partial index on `(sofa_id, sequence)` where `deleted_at` is null;
- index on `sofa_id`;
- server-side guard that `current_source_photo_id`, when present, belongs to the same sofa and column.

Rules:

- active columns are rows with `deleted_at` null;
- the lowest sequence is the default public visual position;
- the public UI must expose these as visual positions, not as visual matrix columns;
- deleting a column is a column-level destructive action and removes that column from public readiness for all fabrics after administrator confirmation.

### `sofa_source_photos`

`sofa_source_photos` stores source photos uploaded by administrators for render preparation.

Fields:

- `id` uuid primary key;
- `sofa_id` uuid reference to `sofas`;
- `visual_matrix_column_id` uuid reference to `visual_matrix_columns`;
- `original_fabric_id` uuid reference to `fabrics`;
- `asset_id` uuid reference to `storage_assets`;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique index on `(sofa_id, visual_matrix_column_id, original_fabric_id)`;
- index on `visual_matrix_column_id`;
- server-side validation that `original_fabric_id` is assigned to the sofa;
- server-side validation that the source photo, column, and sofa all match.

Rules:

- a source photo can serve as the canonical render for its own sofa, visual column, and original fabric combination;
- completing a source photo upload must create or update the matching `sofa_render_cells` row for the same sofa, visual matrix column, and original fabric;
- the matching render cell must set `current_private_asset_id` to the source photo asset, `source_photo_id` to the source photo row, `source_type` to `source_photo`, and `accepted_fabric_render_candidate_id` to null;
- source photo completion must not update `current_public_asset_id`; publication logic owns public asset copy creation and refresh;
- a visual matrix column has one current source image for generation purposes through `visual_matrix_columns.current_source_photo_id`;
- replacing the current source image does not automatically regenerate existing AI-derived render cells for other fabrics.

## Storage Asset Tables

### `storage_assets`

`storage_assets` is the metadata table for catalog, render, export, and selected worker artifacts that need database references.

Fields:

- `id` uuid primary key;
- `bucket_id` text, required;
- `object_path` text, required;
- `visibility` with values from `asset_visibility`;
- `lifecycle_state` with values from `asset_lifecycle_state`;
- `asset_kind` text, required;
- `content_type` text, required;
- `byte_size` bigint;
- `width_px` integer;
- `height_px` integer;
- `checksum_sha256` text, nullable;
- `created_at` timestamp;
- `deleted_at` timestamp;
- `purged_at` timestamp.

Required constraints and indexes:

- unique index on `(bucket_id, object_path)`;
- index on `asset_kind`;
- check constraints requiring positive dimensions and byte size when present.

Rules:

- `storage_assets` must not be used as per-artifact lifecycle tracking for private in-home simulation job prefixes. `SPEC-0007` requires job-prefix storage for those artifacts.
- private asset paths must not be returned to browsers directly;
- public assets must be visitor-safe and must not contain draft-only or private customer content.
- the MVP schema must not include per-asset actor attribution fields. If a later admin-auth or operations spec needs upload attribution, it should add that through a dedicated audit or activity-log model.

## Render Coverage Tables

### `sofa_render_cells`

`sofa_render_cells` stores the current render coverage state for one sofa, one assigned fabric, and one visual matrix column.

Fields:

- `id` uuid primary key;
- `sofa_id` uuid reference to `sofas`;
- `fabric_id` uuid reference to `fabrics`;
- `visual_matrix_column_id` uuid reference to `visual_matrix_columns`;
- `current_private_asset_id` uuid reference to `storage_assets`;
- `current_public_asset_id` uuid nullable reference to `storage_assets`;
- `source_type` with values from `render_source_type`;
- `source_photo_id` uuid nullable reference to `sofa_source_photos`;
- `accepted_fabric_render_candidate_id` uuid nullable reference to `fabric_render_candidates`;
- `updated_at` timestamp.

Required constraints and indexes:

- unique index on `(sofa_id, fabric_id, visual_matrix_column_id)`;
- index on `current_public_asset_id`;
- server-side validation that the fabric is assigned to the sofa;
- server-side validation that the visual matrix column belongs to the sofa;
- server-side validation that referenced assets match the cell.

Rules:

- a cell is render-complete when `current_private_asset_id` is present and the referenced asset is active;
- a cell is public-readable only when the sofa is published, the fabric is active and public-ordered for the sofa, the column is active, and `current_public_asset_id` points to an active public asset;
- manual uploads, source photos, and accepted AI generated candidates can all satisfy render coverage;
- a `source_photo` render cell is valid only for the source photo's original fabric, sofa, and visual matrix column;
- if a source photo is completed after its render cell already exists, the existing cell must be synchronized to the source photo state instead of leaving stale `ai_generated` or manual state for that exact source fabric cell;
- public publication must create or refresh public asset copies for every public-readable render cell;
- unpublish or archive must remove, purge, or otherwise deactivate public asset copies so direct public bucket URLs for unavailable sofa renders do not remain intentionally served by the application.

### `fabric_render_jobs`

`fabric_render_jobs` stores operational jobs for `SPEC-0006`.

Fields:

- `id` uuid primary key;
- `sofa_id` uuid reference to `sofas`;
- `fabric_id` uuid reference to `fabrics`;
- `visual_matrix_column_id` uuid reference to `visual_matrix_columns`;
- `render_cell_id` uuid reference to `sofa_render_cells`;
- `generation_mode` with values from `fabric_render_generation_mode`;
- `target_sofa_asset_id` uuid reference to `storage_assets`;
- `fabric_ai_reference_asset_id` uuid reference to `storage_assets`;
- `refinement_source_asset_id` uuid nullable reference to `storage_assets`;
- `prompt_note` text nullable;
- `provider_name` text;
- `provider_model` text;
- `prompt_version` text, required for queued jobs;
- `status` with values from `fabric_render_job_status`;
- `attempt_count` integer;
- `max_attempts` integer retained as operational metadata when present, but not
  used for automatic background retry in the MVP manual workflow;
- `queued_at` timestamp;
- `claimed_by` text;
- `claimed_at` timestamp;
- `claim_expires_at` timestamp;
- `last_attempt_started_at` timestamp;
- `last_error_message` text;
- `completed_at` timestamp;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- index on `(status, queued_at)`;
- index on `(request_id, status, queued_at)` or an equivalent helper index for
  pump-mode job claiming;
- index on `(sofa_id, fabric_id, visual_matrix_column_id)`;
- index on `claim_expires_at` for processing jobs;
- check constraints preventing negative attempt counts;
- partial uniqueness or server-side idempotency guard to avoid duplicate active jobs for the same sofa, fabric, visual column, source input set, provider, model, prompt version, generation mode, and prompt note unless the administrator explicitly requests a new generation.

Rules:

- only server-side admin-authorized logic may create jobs;
- jobs created by one admin action must share one `request_id`;
- the worker pump uses `request_id` to keep at most the configured number of
  one-job workers active for the request and to stop when no queued jobs remain;
- the queue message or internal worker invocation must reference either one job
  row by id or the request id according to the implementation plan;
- successful jobs create a private `fabric_render_candidates` row;
- failed jobs are operational records, not public render validation states.

### `fabric_render_candidates`

`fabric_render_candidates` stores private AI-generated output candidates from successful fabric render jobs.

Fields:

- `id` uuid primary key;
- `job_id` uuid reference to `fabric_render_jobs`;
- `render_cell_id` uuid reference to `sofa_render_cells`;
- `asset_id` uuid reference to `storage_assets`;
- `generation_mode` with values from `fabric_render_generation_mode`;
- `refinement_source_asset_id` uuid nullable reference to `storage_assets`;
- `provider_name` text;
- `provider_model` text;
- `prompt_version` text;
- `sofa_id` uuid reference to `sofas`;
- `fabric_id` uuid reference to `fabrics`;
- `visual_matrix_column_id` uuid reference to `visual_matrix_columns`;
- `accepted_at` timestamp nullable;
- `created_at` timestamp.

Rules:

- candidates are private by default;
- a candidate becomes the current render for a cell only after an explicit admin workflow accepts it or uses it during regeneration;
- accepting a candidate updates `sofa_render_cells.current_private_asset_id` and `accepted_fabric_render_candidate_id`;
- accepting a candidate does not by itself make the cell public-readable unless publication rules also pass.

### `sofa_render_exports`

`sofa_render_exports` stores ZIP export requests and generated ZIP artifact
metadata for administrator download of sofa render sets.

Fields:

- `id` uuid primary key;
- `sofa_id` uuid reference to `sofas`;
- `status` text, required;
- `created_at` timestamp;

Optional or conditional fields:

- `asset_id` uuid nullable reference to `storage_assets`;
- `included_render_count` integer;
- `last_error_message` text;
- `expires_at` timestamp;
- `completed_at` timestamp.

Rules:

- administrators can request a ZIP export for a sofa whenever render assets
  exist for that sofa, whether the sofa is draft or published;
- the export uses the sofa render assets available at request time and does not
  control whether the sofa is publicly available;
- ZIP export artifacts must remain private;
- `expires_at`, when present, applies only to the generated ZIP artifact cache,
  not to the administrator's ability to request a new export later;
- expired generated ZIP artifacts may be purged by cleanup;
- the MVP schema must not include per-export actor attribution fields. If a
  later admin-auth or operations spec needs export attribution, it should add
  that through a dedicated audit or activity-log model.

## Verification And Consent Tables

### `email_verification_requests`

`email_verification_requests` stores short-lived email verification attempts for public simulation generation.

Fields:

- `id` uuid primary key;
- `auth_user_id` uuid nullable reference to `auth.users` when Supabase Auth
  backs the OTP verification provider;
- `email_address_encrypted` text or bytea, nullable only if the privacy implementation uses an equivalent secure delivery mechanism;
- `email_normalized_hash` text, required;
- `verification_code_hash` text, nullable only when Supabase Auth owns OTP
  generation, storage, expiry, and verification; required for any
  application-managed OTP provider;
- `status` text, required;
- `send_count` integer;
- `failed_attempt_count` integer;
- `expires_at` timestamp;
- `verified_at` timestamp;
- `last_sent_at` timestamp;
- `email_purged_at` timestamp nullable;
- `request_ip_hash` text nullable;
- `user_agent_hash` text nullable;
- `created_at` timestamp;
- `updated_at` timestamp.

Rules:

- plaintext verification codes must never be stored;
- when Supabase Auth backs email OTP, application tables must not duplicate the
  provider's OTP hash or expose Auth tokens to public clients;
- unhashed normalized email addresses must not be stored in plain text;
- exact expiry, resend limits, attempt limits, and deletion behavior belong to the privacy, retention, abuse protection, and API contracts specs;
- the table must support abuse checks without exposing personal data to analytics or public clients.
- transient Supabase Auth users created only for public simulation verification
  must be eligible for scheduled cleanup after the operational retention window
  unless a later accepted customer-account spec promotes the identity.

### `consent_records`

`consent_records` stores required email-use consent, optional commercial contact consent, and optionally analytics consent if the privacy spec decides to persist analytics decisions server-side.

Fields:

- `id` uuid primary key;
- `email_verification_request_id` uuid nullable reference to
  `email_verification_requests`;
- `consent_type` with values from `consent_type`;
- `decision` with values from `consent_decision`;
- `email_normalized_hash` text nullable;
- `simulation_session_id` uuid nullable reference to `simulation_sessions`;
- `wording_version` text, required;
- `locale` text, required;
- `source` text, required;
- `decided_at` timestamp;
- `revoked_at` timestamp nullable;
- `created_at` timestamp.

Rules:

- required email-use consent must be captured before an OTP is sent and may be
  linked to the verification request that captured it;
- required email verification consent and optional commercial contact consent must be separate records;
- rejecting analytics consent must not block browsing, email verification, simulation, result viewing, or Shopify redirect;
- final wording and retention policy belong to the privacy spec.

### `simulation_sessions`

`simulation_sessions` stores verified public simulation access state.

Fields:

- `id` uuid primary key;
- `email_verification_request_id` uuid reference to `email_verification_requests`;
- `auth_user_id` uuid nullable reference to `auth.users` when the verified
  identity came from Supabase Auth OTP;
- `email_normalized_hash` text, required;
- `required_email_consent_record_id` uuid reference to `consent_records`;
- `optional_commercial_consent_record_id` uuid nullable reference to `consent_records`;
- `access_token_hash` text, required;
- `status` text, required;
- `initial_job_count` integer;
- `successful_generated_output_count` integer;
- `expires_at` timestamp;
- `created_at` timestamp;
- `updated_at` timestamp.

Rules:

- browsers receive only opaque simulation access identifiers or tokens, never direct table ids when that would weaken access control;
- Supabase Auth user ids may be retained only as server-side provenance for the
  verified OTP event and must not replace the application-owned access-token
  hash authorization model;
- API logic uses this table to enforce verified-session requirements and visitor-session anti-abuse limits before creating jobs or accepting regenerations;
- the session `access_token_hash` is the public access capability for simulation job creation, polling, dimension submission, regeneration, and signed result access within that verified session;
- exact session lifetime and cross-job throttles belong to privacy, abuse, and API contracts specs.

## In-Home Simulation Tables

### `in_home_simulation_jobs`

`in_home_simulation_jobs` stores the server-side job state for `SPEC-0007`.

Fields:

- `id` uuid primary key;
- `simulation_session_id` uuid reference to `simulation_sessions`;
- `selected_sofa_id` uuid reference to `sofas`;
- `selected_fabric_id` uuid reference to `fabrics`;
- `selected_visual_matrix_column_id` uuid reference to `visual_matrix_columns`;
- `prepared_render_cell_id` uuid reference to `sofa_render_cells`;
- `prepared_sofa_asset_id` uuid reference to `storage_assets`;
- `storage_prefix` text, required;
- `customer_room_photo_hash` text nullable;
- `customer_room_original_path` text;
- `room_normalized_path` text;
- `room_compressed_path` text;
- `room_cleaned_path` text;
- `prepared_sofa_path` text;
- `dimension_guide_overlay_path` text;
- `room_geometry_mode` with values from `room_geometry_mode`;
- `room_geometry_confidence` numeric;
- `room_geometry_failure_reason` text;
- `room_geometry_points` jsonb;
- `supplied_dimensions` jsonb;
- `latest_generated_output_index` integer;
- `generated_output_count` integer;
- `regeneration_count` integer;
- `reserved_generation_index` integer;
- `status` with values from `simulation_job_status`;
- `room_prep_attempt_count` integer;
- `placement_attempt_count` integer;
- `max_attempts_per_stage` integer;
- `claimed_by` text;
- `claimed_at` timestamp;
- `claim_expires_at` timestamp;
- current checkpoint key;
- current checkpoint status;
- current progress step key;
- progress step ordinal;
- progress total steps;
- progress updated timestamp;
- `last_error_code` text;
- `last_error_message` text;
- `last_regeneration_error_message` text;
- `worker_error_path` text;
- `retention_deadline` timestamp, required;
- `queued_at` timestamp;
- `room_prep_started_at` timestamp;
- `awaiting_dimensions_at` timestamp;
- `dimensions_submitted_at` timestamp;
- `placement_started_at` timestamp;
- `completed_at` timestamp;
- `expired_at` timestamp;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- index on `(status, queued_at)`;
- index on `retention_deadline`;
- index on `simulation_session_id`;
- index on selected sofa, fabric, and visual column for operational overview;
- check constraints preventing negative attempt counts, generated output counts, and regeneration counts;
- check or server-side guard ensuring `retention_deadline` is no more than 24 hours after `created_at` for the MVP;
- server-side validation that the selected sofa, fabric, visual column, and prepared render cell formed a published public-usable triple at job creation time.

Rules:

- job creation plus room photo upload must be atomic from the visitor's perspective;
- no public `upload_pending` status is allowed;
- all private simulation files for a job must live under `storage_prefix`;
- generated outputs remain private and never become catalog assets;
- public access to this job is authorized through the linked `simulation_sessions.access_token_hash` plus the API's opaque simulation job identifier;
- `customer_room_photo_hash` may be used by the API to avoid duplicate active simulation jobs for the same selected sofa, fabric, visual matrix column, and room photo within the visitor's session;
- `room_geometry_points` must store four ordered main-wall points for `back_wall` mode or six named room-corner points for `corner` mode, matching `SPEC-0007`;
- `supplied_dimensions` must store metre values only: `wall_width` and `wall_height` for `back_wall`, or `left_wall_width`, `right_wall_width`, and `room_height` for `corner`;
- `simulation_generated_outputs` is the source of truth for generated output paths and output metadata; `in_home_simulation_jobs` keeps only counters, latest index, and reserved index state;
- `regeneration_count` counts successful regenerations only and should equal `max(generated_output_count - 1, 0)`;
- when a job expires, private artifact paths must be cleared, redacted, or made operationally useless after purge so retained metadata does not reference private image content;
- abandoned `awaiting_dimensions` jobs remain recoverable until `retention_deadline`;
- only successfully persisted outputs increment `generated_output_count`.

### `in_home_simulation_checkpoints`

`in_home_simulation_checkpoints` stores durable checkpoint attempts for the
database-dispatched checkpoint worker defined by `SPEC-0007`.

Fields:

- `id` uuid primary key;
- `in_home_simulation_job_id` uuid reference to `in_home_simulation_jobs`;
- `checkpoint_key` with values from `simulation_checkpoint_key`;
- `status` with values from `simulation_checkpoint_status`;
- `attempt_number` integer;
- `max_attempts` integer;
- `generation_index` integer nullable for placement checkpoints;
- `claimed_by` text nullable;
- `claimed_at` timestamp nullable;
- `claim_expires_at` timestamp nullable;
- `started_at` timestamp nullable;
- `completed_at` timestamp nullable;
- `retryable` boolean nullable;
- `safe_error_code` text nullable;
- `safe_error_message` text nullable;
- `metadata` jsonb;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique or server-side guard ensuring only one active row for the same job,
  checkpoint key, and generation index when the checkpoint is not terminal;
- index on `(status, created_at)` for claimable checkpoint pickup;
- partial index on `claim_expires_at` where `status = 'processing'`;
- index on `in_home_simulation_job_id`;
- check constraints preventing non-positive attempt counts and invalid
  generation indexes.

Rules:

- checkpoint rows are operational and must not be directly readable by public
  visitors;
- the durable job row remains the source of truth for public status and
  retention;
- queue messages may reference checkpoint work, but losing a queue message must
  not make a claimable checkpoint undiscoverable;
- every worker-claimable checkpoint must have one durable dispatch outbox
  intent that can be drained by API-woken worker dispatch or operator recovery;
- expired checkpoint claims must be recoverable by dispatch or operator recovery
  logic;
- retryable checkpoint failures may create or update a later attempt row until
  attempts are exhausted;
- non-retryable terminal checkpoint failure must update the owning simulation
  job according to `SPEC-0007` failure and regeneration rules.

### `in_home_simulation_checkpoint_dispatch_outbox`

`in_home_simulation_checkpoint_dispatch_outbox` stores the transactional handoff
from durable checkpoint state to worker invocation. It is operational state and
must be service-role-only.

Fields:

- `id` uuid primary key;
- `checkpoint_id` uuid unique reference to `in_home_simulation_checkpoints`;
- `in_home_simulation_job_id` uuid reference to `in_home_simulation_jobs`;
- `checkpoint_key` with values from `simulation_checkpoint_key`;
- `status` with values `pending`, `dispatching`, `dispatched`, `retrying`, and
  `failed`;
- `attempt_count` integer;
- `max_attempts` integer;
- `next_attempt_at` timestamp;
- `last_attempt_at` timestamp nullable;
- `dispatch_started_at` timestamp nullable;
- `dispatched_at` timestamp nullable;
- `locked_by` text nullable;
- `lock_expires_at` timestamp nullable;
- `last_error_code` text nullable;
- `last_error_message` text nullable;
- `reason` text;
- `created_at` timestamp;
- `updated_at` timestamp.

Required constraints and indexes:

- unique index on `checkpoint_id` so there is one dispatch intent per
  checkpoint;
- due-work index on `next_attempt_at`, `created_at`, and `id` for pending and
  retrying rows;
- stale-lock index on `lock_expires_at` for `dispatching` rows;
- index on `in_home_simulation_job_id`;
- check constraints for valid status, positive max attempts, non-negative
  attempt count, non-blank reason, and required lock fields while dispatching.

Rules:

- the same transaction that makes a worker checkpoint claimable must insert or
  upsert the dispatch outbox row;
- `awaiting_dimensions`, `completed`, `failed`, and `expired` checkpoints must
  not create worker dispatch intents;
- dispatcher locks must be short-lived and reclaimable by dispatch recovery;
- duplicate public API retries and duplicate dispatcher wake-ups must not create
  more than one outbox row for the same checkpoint;
- public visitors must never read dispatch outbox rows or receive dispatch ids.

### `simulation_public_progress`

`simulation_public_progress` is the public-safe Realtime projection for one
visitor's simulation progress. It may be a table maintained by API and worker
transactions, or an equivalent Realtime-safe projection if the implementation
documents the same privacy guarantees.

Fields:

- `simulation_job_id` uuid primary key or unique reference to
  `in_home_simulation_jobs`;
- `simulation_session_id` uuid reference to `simulation_sessions`;
- `status` with values from `simulation_job_status`;
- `progress_step_key` text;
- `progress_step_ordinal` integer;
- `progress_total_steps` integer;
- `visitor_action_required` boolean;
- `guide_available` boolean;
- `latest_result_available` boolean;
- `regeneration_available` boolean;
- `retention_deadline` timestamp;
- `updated_at` timestamp.

Rules:

- public visitors may subscribe only to rows authorized by their verified
  simulation session capability;
- the row must not contain private storage paths, signed URLs, provider
  metadata, prompt versions, raw worker errors, queue ids, service identifiers,
  or another visitor's state;
- signed guide and result URLs remain available only through authorized API
  status responses;
- when a simulation expires, the projection must stop indicating that guide or
  result artifacts are available.

### `simulation_generated_outputs`

`simulation_generated_outputs` stores metadata for successful in-home simulation outputs while preserving the job-prefix storage model from `SPEC-0007`.

This table is for public visitor in-home simulation outputs only. Admin-side
fabric render generation outputs are tracked separately by
`fabric_render_candidates`.

Fields:

- `id` uuid primary key;
- `in_home_simulation_job_id` uuid reference to `in_home_simulation_jobs`;
- `generation_index` integer, required;
- `object_path` text, required while the output has not been purged;
- `content_type` text, required;
- `width_px` integer;
- `height_px` integer;
- `source_type` text, required with value `ai_generated_in_home_simulation`;
- `provider_name` text;
- `provider_model` text;
- `prompt_version` text;
- `created_at` timestamp;
- `purged_at` timestamp nullable.

Required constraints and indexes:

- unique index on `(in_home_simulation_job_id, generation_index)`;
- check constraint limiting `generation_index` to `0`, `1`, or `2` for the MVP;
- check constraints requiring positive dimensions when present.

Rules:

- this table tracks successful output metadata, not a separate public gallery;
- rows must not grant direct public read access to private storage;
- purge must delete the referenced object and clear or redact `object_path` before retaining the row as purged.

### `worker_job_events`

`worker_job_events` stores lightweight status transition and operational events when job table timestamps are not enough for debugging.

Fields:

- `id` uuid primary key;
- `job_type` with values from `worker_job_type`;
- `fabric_render_job_id` uuid nullable reference to `fabric_render_jobs`;
- `in_home_simulation_job_id` uuid nullable reference to `in_home_simulation_jobs`;
- `from_status` text nullable;
- `to_status` text nullable;
- `event_type` text, required;
- `message` text nullable;
- `metadata` jsonb;
- `created_at` timestamp.

Rules:

- exactly one job id must be present;
- events are operational and must not expose provider secrets, private signed URLs, private storage credentials, plaintext emails, or customer room image content;
- public visitors never read this table.

## Storage Model

### Buckets

The MVP production storage model must define these buckets:

- `catalog-public-assets`: public bucket for visitor-safe catalog assets that may be rendered on public pages.
- `catalog-private-assets`: private bucket for admin uploads, source photos, fabric AI references, render candidates, private accepted render masters, and generated ZIP artifacts.
- `simulation-private-artifacts`: private bucket for customer room uploads, normalized and compressed room files, cleaned rooms, guide overlays, prepared sofa materializations, generated simulation outputs, persisted worker errors, and orphan room uploads.

The local foundation buckets from `SPEC-0008` may remain as compatibility aliases during migration, but production code must use the final bucket names above once this spec is implemented unless an implementation plan documents a controlled transition.

### Bucket Visibility Rules

`catalog-public-assets`:

- public read is allowed for active visitor-safe objects;
- browser writes are not allowed;
- service-side publication logic owns writes, replacements, and deletes;
- draft-only content, private render candidates, source photos, AI references, ZIP exports, and customer simulation artifacts must never be stored here.

`catalog-private-assets`:

- public read is denied;
- browser writes are denied unless the API creates a tightly scoped signed upload flow for an authorized admin action;
- service-side admin logic and workers may read or write according to their role;
- signed read URLs may be generated for authorized admin review only;
- sofa source photos and fabric AI reference images must pass upload-time image validation before they can be used by `SPEC-0006` jobs;
- the first production implementation must reject sofa source photos and fabric AI reference images over 2048 px on the longest edge for render generation inputs.

`simulation-private-artifacts`:

- public read is denied;
- browser writes are denied unless the API creates a tightly scoped upload flow that remains atomic with simulation job creation;
- visitor access to guide overlays or generated results must use short-lived signed URLs generated by the API for the current simulation access capability;
- all job-owned prefixes must be purged no later than the job retention deadline;
- room uploads may accept JPEG, PNG, WebP, HEIC, and HEIF inputs when the worker can normalize them according to `SPEC-0007`.

### Catalog Private Paths

Catalog private paths should be deterministic enough for cleanup and debugging while avoiding direct exposure to visitors:

```text
sofas/{sofa_id}/source-photos/{source_photo_id}/{asset_id}.{ext}
fabrics/{fabric_id}/swatches/{asset_id}.{ext}
fabrics/{fabric_id}/ai-references/{asset_id}.{ext}
renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/manual/{asset_id}.png
renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{fabric_render_job_id}/output.png
exports/{sofa_id}/{export_id}/renders.zip
```

The implementation may add content-hash or version components to these paths if that improves cache safety and cleanup.

### Catalog Public Paths

Public catalog paths must point only to active public copies:

```text
sofas/{sofa_id}/renders/{render_cell_id}/{asset_id}.png
fabrics/{fabric_id}/swatches/{asset_id}.{ext}
```

Rules:

- public paths should include an immutable asset id or version component so browser and CDN caches do not show stale images after replacement;
- public read APIs must resolve public URLs from database state, not by guessing paths on the client;
- unpublishing or archiving a sofa must deactivate or delete the public render copies tied to that sofa;
- public swatch copies may remain public while still used by at least one published sofa; cleanup may remove unused public swatch copies when no published sofa references them.

### Simulation Private Paths

Simulation paths must use one private prefix per job:

```text
simulations/{job_id}/uploads/room_original.{jpg,jpeg,png,heic,heif}
simulations/{job_id}/room_normalized.jpg
simulations/{job_id}/room_compressed.jpg
simulations/{job_id}/room_cleaned.png
simulations/{job_id}/room_geometry.json
simulations/{job_id}/room_guides.png
simulations/{job_id}/sofa_prepared.png
simulations/{job_id}/outputs/output-0.png
simulations/{job_id}/outputs/output-1.png
simulations/{job_id}/outputs/output-2.png
simulations/{job_id}/error.txt
```

Orphaned uploads created before database job creation succeeds must use a cleanup-friendly prefix:

```text
orphan-room-uploads/{upload_id}/room_original.{ext}
```

Rules:

- orphan room uploads older than one hour must be deleted;
- simulation job prefixes must be deleted at or before `retention_deadline`;
- missing objects during purge count as already deleted.

## Public Read Model

The implementation must expose public catalog data through API responses or database views that enforce the same filtering rules.

The public read model must support:

- `/catalog` listing published sofas only;
- dynamic public tag filters based only on tags assigned to published sofas;
- catalog filter `AND` behavior for multiple selected tags;
- default catalog order by manual public order when present, otherwise newest created published sofas first;
- sofa detail lookup by stable public slug;
- public fabrics that are active, assigned to the sofa, public-ordered, and complete across all active visual positions;
- public visual positions from active visual matrix columns;
- current public render URL for every public sofa, public fabric, and public visual position combination;
- Shopify order URL for the published sofa;
- public tags assigned to the published sofa;
- public description when present;
- sofa dimensions when present on a published sofa.

The public read model must not expose:

- admin notes;
- internal names;
- draft or archived sofa data;
- archived fabric options unless still needed only for historical operational metadata;
- private storage bucket names or object paths;
- fabric AI reference images;
- source photos;
- private render candidates;
- worker job internals;
- email, consent, verification, or simulation job rows;
- provider names, provider models, prompt versions, or raw failure messages.

## Publication And Readiness

Publication must be a server-side transaction. It must not rely on browser-only checks.

Before a sofa can enter `published`, the transaction must verify:

- `public_name` is present;
- `public_slug` exists or can be generated uniquely;
- `shopify_order_url` is present and has valid URL shape;
- at least one active visual matrix column exists;
- at least one active fabric is assigned with non-null `public_order`;
- every public-ordered active fabric has an active render cell for every active visual matrix column;
- every public-ordered active fabric has an active public swatch asset or can create one during publication;
- every render cell selected for public coverage has an active private source asset that can be copied or promoted to public storage;
- required public metadata is present;
- the publication does not mutate a frozen slug.

Publication must create or refresh `catalog-public-assets` copies for all public render cells and required public fabric swatches.

Invalid edits to an already published sofa must be rejected without changing the current public read model.

Adding a new visual matrix column to a published sofa must make public readiness fail until all public fabrics have complete render coverage for that new column. The implementation may either reject the edit while published or accept it only through a transaction that keeps the previous public state intact until the new state is complete.

## RLS And Storage Policies

The first production implementation must enable RLS on all application tables that contain catalog, admin, job, consent, verification, or operational data.

Minimum policy requirements:

- anonymous users may read only public read views or table rows explicitly filtered to published visitor-safe data;
- anonymous users may not insert, update, or delete application rows directly;
- authenticated non-admin users, if any exist later, receive no back-office privileges by default;
- administrators may read and mutate back-office data only when admin authorization is proven by the admin auth model;
- service-role Edge Functions and workers may perform server-side operations required by API and worker specs;
- private job, verification, consent, and storage metadata tables are not directly readable by anonymous visitors;
- private simulation access is mediated by API-issued opaque access tokens and short-lived signed URLs, not by direct table policies.

Storage policies must match the bucket rules in this spec.

## Worker Queue Integration

Supabase Queues provide durable queue messages. Queue tables are owned by Supabase Queues and are not application domain tables.

The application schema must store durable job state in:

- `fabric_render_jobs`;
- `in_home_simulation_jobs`.

Queue messages must contain the minimum information needed to find the durable job row and intended stage. The durable job row remains the source of truth for status, attempts, claims, and retention.

Queue names must come from environment variables so local, DEV, and PROD stay isolated.

## Retention And Cleanup

The MVP retention maximum for customer room photos and generated in-home simulation outputs is 24 hours.

The data model must support these cleanup processes:

- orphan room upload cleanup after one hour;
- simulation prefix purge at or before `in_home_simulation_jobs.retention_deadline`;
- transition of purged simulation jobs to `expired`;
- purging or redacting `simulation_generated_outputs.object_path` values after their storage objects are deleted;
- removal or expiration of generated ZIP artifact cache files when an expiry is set;
- optional cleanup of unused public swatch copies;
- deactivation or deletion of public render copies when a sofa is unpublished or archived.

After simulation purge, the system may retain lightweight operational metadata:

- job id;
- selected sofa id;
- selected fabric id;
- selected visual position id;
- status history;
- timestamps;
- attempt counts;
- failure category or readable operational message;
- generated output count;
- retention and purge timestamps.

After simulation purge, the system must not retain usable private image paths, signed URLs, room photo content, generated simulation image content, or intermediate image content.

## API Impact

This spec does not define exact API routes.

The later API contracts spec must use this data model to define:

- public catalog and sofa detail reads;
- admin catalog mutations;
- admin uploads;
- publication and archival operations;
- render coverage reads;
- fabric render job creation, retry, cancellation, and status reads;
- ZIP export requests and downloads;
- email verification request and validation;
- verified simulation session state;
- atomic room photo upload and in-home simulation job creation;
- simulation status polling;
- dimension submission;
- simulation regeneration;
- signed URL generation for private artifacts.

## Worker Job Impact

`SPEC-0006` workers must use `fabric_render_jobs`, `fabric_render_candidates`, `sofa_render_cells`, and `storage_assets`.

`SPEC-0007` workers must use `in_home_simulation_jobs`, `simulation_generated_outputs`, and the `simulation-private-artifacts` job prefix model.

Workers must not make public catalog publication decisions. Fabric render workers create private candidates. Simulation workers create private visitor-specific outputs. Server-side admin publication logic owns public catalog asset creation.

## Environment Variables

This spec does not finalize environment variable names beyond inherited requirements from accepted specs.

The environment and deployment spec must ensure each environment defines isolated values for:

- Supabase project URL and keys;
- queue names;
- bucket names when configurable;
- signed URL TTLs;
- simulation retention cap;
- generated ZIP artifact cache expiry when ZIP artifacts are cached;
- cleanup schedules;
- admin auth configuration.

## Migration Requirements

The implementation plan for this spec must create Supabase migrations that:

- create required enum types or constrained text fields;
- create all required tables and indexes;
- enable RLS on application tables;
- define storage buckets and storage policies;
- provide publication, slug-freeze, and cleanup helper functions where direct constraints are insufficient;
- migrate or replace the local smoke-test-only worker foundation without breaking `SPEC-0008` local development;
- include rollback notes or forward-fix strategy for production-safe Supabase migrations.

The implementation plan must add tests or smoke checks for:

- publication readiness constraints;
- public read filtering;
- slug freeze behavior;
- public/private storage policy boundaries;
- render cell uniqueness;
- queue job claim indexes;
- simulation retention deadline cap;
- orphan upload cleanup selection;
- RLS denial for anonymous private reads.

## Acceptance Criteria

- The spec is traceable to `SPEC-0001` through `SPEC-0008`.
- Catalog tables support sofas, lifecycle state, public slugs, Shopify order URL, public metadata, dimensions, tags, fabrics, fabric assignment, visual matrix columns, source photos, render coverage, and manual public ordering.
- Fabric tables support active and archived fabrics, swatch assets, AI reference assets, premium flag, and historical references.
- Public tags are dynamic and not hard-coded in the frontend.
- Public sofa slugs are unique, generated automatically, and frozen after first publication.
- Public reads expose only published visitor-safe data.
- Draft and archived sofas are not publicly listed.
- Archived or unpublished sofa URLs can be resolved to unavailable behavior without exposing private details.
- Render cells model one sofa, one fabric, and one visual matrix column.
- Manual uploads, source photos, and accepted AI candidates can satisfy render coverage.
- Generated fabric render candidates remain private until explicitly accepted by admin workflow and published by server-side publication logic.
- Public catalog assets are separated from private admin, worker, and simulation artifacts.
- Fabric render worker job state supports the statuses, attempts, claims, provider metadata, prompt version, and output candidate references required by `SPEC-0006`.
- In-home simulation job state supports the statuses, stage attempts, geometry, dimensions, regeneration indices, output count, latest output index, and retention deadline required by `SPEC-0007`.
- In-home simulation output metadata tracks generation index, provider, model, prompt version, dimensions, and private output path while retained.
- Public in-home simulation access uses the verified `simulation_sessions.access_token_hash` plus opaque job identifiers for job creation, polling, dimension submission, regeneration, and signed result access.
- Supabase Auth-backed OTP verification can link verification requests and
  simulation sessions to transient Auth user ids without exposing Auth sessions
  or retaining raw email beyond the operational retention window.
- Simulation storage uses one private prefix per job under `simulation-private-artifacts`.
- Customer room photos, intermediate artifacts, and generated simulation outputs are private and purged within the 24-hour MVP retention maximum.
- Email verification tables do not store plaintext verification codes.
- Required email-use consent and optional commercial contact consent are stored separately.
- RLS and storage policies preserve visitor, admin, API service, and worker boundaries.
- Queue messages are not the source of truth for durable job state.
- The local Supabase worker foundation remains compatible or is migrated through an implementation plan.

## Review Checklist For Next Pass

During the next review pass, check this draft against each accepted spec section by section:

- `SPEC-0003`: confirm every business concept has a durable data owner or is intentionally out of scope.
- `SPEC-0004`: confirm public catalog, detail, selection, simulation launch, result access, SEO, analytics, and unavailable states have enough data support.
- `SPEC-0005`: confirm every admin catalog operation maps to a table, constraint, or server-side transaction.
- `SPEC-0006`: confirm every fabric render worker logical field maps to a durable field or explicit storage path.
- `SPEC-0007`: confirm every in-home simulation worker logical field maps to a durable field or explicit job-prefix path.
- `SPEC-0008`: confirm local queue and bucket foundations can evolve into the production schema without mixing local, DEV, and PROD resources.

## Review Decisions

- Public catalog images use public copies in `catalog-public-assets` for the
  MVP because public pages are expected to be indexable. Signed URLs remain
  reserved for private assets unless a later accepted spec or change request
  changes the public image strategy.
- Future structured public sofa attributes beyond tags, description, and
  dimensions should start as explicit typed fields when a concrete need exists.
  A generic attributes table should be introduced only if future public
  attributes become numerous or administrator-defined.
- Future private or admin-only sofa dimensions should use a separate private
  measurement model rather than visibility flags on MVP public dimensions.
- Future internal notes on sofas or fabrics require a concrete admin workflow.
  Simple single-note needs may use simple fields. Richer notes, comments, or
  history should use a dedicated table or activity-log model.
- Future multiple-admin actor attribution should start with an audit or
  activity log. Direct `created_by` and `updated_by` columns should be added
  only when a concrete UI or reporting need requires them.
- MVP ZIP export generation may be implemented as a server-side action. It may
  move to an async job if file count, runtime, or platform limits make
  synchronous generation unreliable.
- Analytics consent remains client-side only for MVP unless the privacy,
  retention, and abuse protection spec requires server-side auditability.

## Open Questions

- None.
