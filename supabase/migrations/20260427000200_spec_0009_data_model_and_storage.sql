-- SPEC-0009 Data Model And Storage
--
-- Forward-fix strategy: this migration creates production-shaped schema,
-- buckets, policies, and helper functions. After deployment, destructive
-- rollback is not expected to be safe because catalog and job data may exist.
-- Use follow-up forward migrations to add, relax, or repair constraints.

create extension if not exists pgcrypto;
create extension if not exists pgmq;
create extension if not exists unaccent with schema extensions;

do $$
begin
  create type public.sofa_lifecycle_state as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fabric_lifecycle_state as enum ('active', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_visibility as enum ('public', 'private');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_lifecycle_state as enum ('active', 'deleted', 'purged');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.render_source_type as enum ('source_photo', 'manual_upload', 'ai_generated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fabric_render_generation_mode as enum ('initial', 'refine');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fabric_render_job_status as enum ('queued', 'processing', 'succeeded', 'failed', 'canceled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.simulation_job_status as enum (
    'queued',
    'room_prep_processing',
    'awaiting_dimensions',
    'placement_queued',
    'placement_processing',
    'succeeded',
    'failed',
    'canceled',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.room_geometry_mode as enum ('back_wall', 'corner');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.consent_type as enum (
    'email_verification_required',
    'commercial_contact_optional',
    'analytics_optional'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.consent_decision as enum ('granted', 'rejected', 'revoked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.worker_job_type as enum ('fabric_render_generation', 'in_home_simulation');
exception
  when duplicate_object then null;
end $$;

create table public.storage_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  visibility public.asset_visibility not null,
  lifecycle_state public.asset_lifecycle_state not null default 'active',
  asset_kind text not null,
  content_type text not null,
  byte_size bigint,
  width_px integer,
  height_px integer,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  purged_at timestamptz,
  constraint storage_assets_object_path_not_blank check (length(btrim(object_path)) > 0),
  constraint storage_assets_asset_kind_not_blank check (length(btrim(asset_kind)) > 0),
  constraint storage_assets_content_type_not_blank check (length(btrim(content_type)) > 0),
  constraint storage_assets_positive_byte_size check (byte_size is null or byte_size > 0),
  constraint storage_assets_positive_width check (width_px is null or width_px > 0),
  constraint storage_assets_positive_height check (height_px is null or height_px > 0),
  constraint storage_assets_purged_requires_deleted check (purged_at is null or deleted_at is not null)
);

create unique index storage_assets_bucket_object_unique_idx
  on public.storage_assets (bucket_id, object_path);

create index storage_assets_asset_kind_idx
  on public.storage_assets (asset_kind);

create table public.sofas (
  id uuid primary key default gen_random_uuid(),
  lifecycle_state public.sofa_lifecycle_state not null default 'draft',
  internal_name text not null,
  public_name text,
  public_slug text,
  shopify_order_url text,
  public_description text,
  length_cm numeric,
  depth_cm numeric,
  height_cm numeric,
  footprint_type text,
  footprint_measurements jsonb,
  manual_public_order integer,
  first_published_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sofas_internal_name_not_blank check (length(btrim(internal_name)) > 0),
  constraint sofas_public_name_not_blank check (public_name is null or length(btrim(public_name)) > 0),
  constraint sofas_public_slug_not_blank check (public_slug is null or length(btrim(public_slug)) > 0),
  constraint sofas_positive_length check (length_cm is null or length_cm > 0),
  constraint sofas_positive_depth check (depth_cm is null or depth_cm > 0),
  constraint sofas_positive_height check (height_cm is null or height_cm > 0),
  constraint sofas_manual_public_order_non_negative check (
    manual_public_order is null or manual_public_order >= 0
  ),
  constraint sofas_archived_timestamp check (
    lifecycle_state <> 'archived' or archived_at is not null
  )
);

create unique index sofas_public_slug_unique_idx
  on public.sofas (public_slug)
  where public_slug is not null;

create index sofas_lifecycle_state_idx
  on public.sofas (lifecycle_state);

create index sofas_public_catalog_order_idx
  on public.sofas (lifecycle_state, manual_public_order, created_at desc);

create table public.public_tags (
  id uuid primary key default gen_random_uuid(),
  public_label text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_tags_public_label_not_blank check (length(btrim(public_label)) > 0),
  constraint public_tags_slug_not_blank check (length(btrim(slug)) > 0)
);

create unique index public_tags_slug_unique_idx
  on public.public_tags (slug);

create unique index public_tags_label_lower_unique_idx
  on public.public_tags (lower(public_label));

create table public.sofa_tags (
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  tag_id uuid not null references public.public_tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (sofa_id, tag_id)
);

create index sofa_tags_tag_id_idx
  on public.sofa_tags (tag_id);

create table public.fabrics (
  id uuid primary key default gen_random_uuid(),
  lifecycle_state public.fabric_lifecycle_state not null default 'active',
  internal_name text not null,
  public_name text not null,
  swatch_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  ai_reference_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  is_premium boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fabrics_internal_name_not_blank check (length(btrim(internal_name)) > 0),
  constraint fabrics_public_name_not_blank check (length(btrim(public_name)) > 0),
  constraint fabrics_archived_timestamp check (
    lifecycle_state <> 'archived' or archived_at is not null
  )
);

create index fabrics_lifecycle_state_idx
  on public.fabrics (lifecycle_state);

create table public.sofa_fabrics (
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  fabric_id uuid not null references public.fabrics (id) on delete restrict,
  public_order integer,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sofa_id, fabric_id),
  constraint sofa_fabrics_public_order_non_negative check (
    public_order is null or public_order >= 0
  )
);

create unique index sofa_fabrics_public_order_unique_idx
  on public.sofa_fabrics (sofa_id, public_order)
  where public_order is not null;

create index sofa_fabrics_fabric_id_idx
  on public.sofa_fabrics (fabric_id);

create index sofa_fabrics_sofa_id_idx
  on public.sofa_fabrics (sofa_id);

create table public.visual_matrix_columns (
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  sequence integer not null,
  admin_label text,
  public_label text,
  current_source_photo_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visual_matrix_columns_positive_sequence check (sequence > 0),
  constraint visual_matrix_columns_admin_label_not_blank check (
    admin_label is null or length(btrim(admin_label)) > 0
  ),
  constraint visual_matrix_columns_public_label_not_blank check (
    public_label is null or length(btrim(public_label)) > 0
  )
);

create unique index visual_matrix_columns_sequence_unique_idx
  on public.visual_matrix_columns (sofa_id, sequence)
  where deleted_at is null;

create index visual_matrix_columns_sofa_id_idx
  on public.visual_matrix_columns (sofa_id);

create table public.sofa_source_photos (
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  original_fabric_id uuid not null references public.fabrics (id) on delete restrict,
  asset_id uuid not null references public.storage_assets (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sofa_source_photos_unique_idx
  on public.sofa_source_photos (sofa_id, visual_matrix_column_id, original_fabric_id);

create index sofa_source_photos_visual_matrix_column_id_idx
  on public.sofa_source_photos (visual_matrix_column_id);

alter table public.visual_matrix_columns
  add constraint visual_matrix_columns_current_source_photo_fk
  foreign key (current_source_photo_id)
  references public.sofa_source_photos (id)
  on delete set null;

create table public.sofa_render_cells (
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  fabric_id uuid not null references public.fabrics (id) on delete restrict,
  visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  current_private_asset_id uuid references public.storage_assets (id) on delete restrict,
  current_public_asset_id uuid references public.storage_assets (id) on delete restrict,
  source_type public.render_source_type not null,
  source_photo_id uuid references public.sofa_source_photos (id) on delete restrict,
  accepted_fabric_render_candidate_id uuid,
  updated_at timestamptz not null default now()
);

create unique index sofa_render_cells_unique_idx
  on public.sofa_render_cells (sofa_id, fabric_id, visual_matrix_column_id);

create index sofa_render_cells_current_public_asset_id_idx
  on public.sofa_render_cells (current_public_asset_id);

create table public.fabric_render_jobs (
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  fabric_id uuid not null references public.fabrics (id) on delete restrict,
  visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  render_cell_id uuid not null references public.sofa_render_cells (id) on delete restrict,
  generation_mode public.fabric_render_generation_mode not null,
  target_sofa_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  fabric_ai_reference_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  refinement_source_asset_id uuid references public.storage_assets (id) on delete restrict,
  prompt_note text,
  provider_name text,
  provider_model text,
  prompt_version text not null,
  status public.fabric_render_job_status not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  queued_at timestamptz,
  claimed_by text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_attempt_started_at timestamptz,
  last_error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fabric_render_jobs_prompt_version_not_blank check (length(btrim(prompt_version)) > 0),
  constraint fabric_render_jobs_attempt_count_non_negative check (attempt_count >= 0),
  constraint fabric_render_jobs_max_attempts_positive check (max_attempts > 0)
);

create index fabric_render_jobs_status_queued_idx
  on public.fabric_render_jobs (status, queued_at);

create index fabric_render_jobs_lookup_idx
  on public.fabric_render_jobs (sofa_id, fabric_id, visual_matrix_column_id);

create index fabric_render_jobs_claim_expires_idx
  on public.fabric_render_jobs (claim_expires_at)
  where status = 'processing';

create unique index fabric_render_jobs_active_idempotency_idx
  on public.fabric_render_jobs (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    target_sofa_asset_id,
    fabric_ai_reference_asset_id,
    coalesce(refinement_source_asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(provider_name, ''),
    coalesce(provider_model, ''),
    prompt_version,
    generation_mode,
    coalesce(prompt_note, '')
  )
  where status in ('queued', 'processing');

create table public.fabric_render_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.fabric_render_jobs (id) on delete restrict,
  render_cell_id uuid not null references public.sofa_render_cells (id) on delete restrict,
  asset_id uuid not null references public.storage_assets (id) on delete restrict,
  generation_mode public.fabric_render_generation_mode not null,
  refinement_source_asset_id uuid references public.storage_assets (id) on delete restrict,
  provider_name text,
  provider_model text,
  prompt_version text not null,
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  fabric_id uuid not null references public.fabrics (id) on delete restrict,
  visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fabric_render_candidates_prompt_version_not_blank check (length(btrim(prompt_version)) > 0)
);

create index fabric_render_candidates_render_cell_id_idx
  on public.fabric_render_candidates (render_cell_id);

create index fabric_render_candidates_job_id_idx
  on public.fabric_render_candidates (job_id);

alter table public.sofa_render_cells
  add constraint sofa_render_cells_accepted_candidate_fk
  foreign key (accepted_fabric_render_candidate_id)
  references public.fabric_render_candidates (id)
  on delete set null;

create table public.sofa_render_exports (
  id uuid primary key default gen_random_uuid(),
  sofa_id uuid not null references public.sofas (id) on delete cascade,
  status text not null,
  asset_id uuid references public.storage_assets (id) on delete restrict,
  included_render_count integer,
  last_error_message text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sofa_render_exports_status_not_blank check (length(btrim(status)) > 0),
  constraint sofa_render_exports_included_render_count_non_negative check (
    included_render_count is null or included_render_count >= 0
  )
);

create index sofa_render_exports_sofa_id_idx
  on public.sofa_render_exports (sofa_id);

create index sofa_render_exports_expires_at_idx
  on public.sofa_render_exports (expires_at)
  where expires_at is not null;

create table public.email_verification_requests (
  id uuid primary key default gen_random_uuid(),
  email_address_encrypted text,
  email_normalized_hash text not null,
  verification_code_hash text not null,
  status text not null,
  send_count integer not null default 0,
  failed_attempt_count integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  last_sent_at timestamptz,
  request_ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_verification_requests_email_hash_not_blank check (
    length(btrim(email_normalized_hash)) > 0
  ),
  constraint email_verification_requests_code_hash_not_blank check (
    length(btrim(verification_code_hash)) > 0
  ),
  constraint email_verification_requests_status_not_blank check (length(btrim(status)) > 0),
  constraint email_verification_requests_send_count_non_negative check (send_count >= 0),
  constraint email_verification_requests_failed_attempt_count_non_negative check (
    failed_attempt_count >= 0
  )
);

create index email_verification_requests_email_hash_idx
  on public.email_verification_requests (email_normalized_hash);

create index email_verification_requests_expires_at_idx
  on public.email_verification_requests (expires_at);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  consent_type public.consent_type not null,
  decision public.consent_decision not null,
  email_normalized_hash text,
  simulation_session_id uuid,
  wording_version text not null,
  locale text not null,
  source text not null,
  decided_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consent_records_wording_version_not_blank check (length(btrim(wording_version)) > 0),
  constraint consent_records_locale_not_blank check (length(btrim(locale)) > 0),
  constraint consent_records_source_not_blank check (length(btrim(source)) > 0),
  constraint consent_records_revoked_decision_timestamp check (
    decision <> 'revoked' or revoked_at is not null
  )
);

create index consent_records_email_hash_idx
  on public.consent_records (email_normalized_hash);

create index consent_records_simulation_session_id_idx
  on public.consent_records (simulation_session_id);

create table public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  email_verification_request_id uuid not null references public.email_verification_requests (id) on delete restrict,
  email_normalized_hash text not null,
  required_email_consent_record_id uuid not null references public.consent_records (id) on delete restrict,
  optional_commercial_consent_record_id uuid references public.consent_records (id) on delete restrict,
  access_token_hash text not null,
  status text not null,
  initial_job_count integer not null default 0,
  successful_generated_output_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_sessions_email_hash_not_blank check (length(btrim(email_normalized_hash)) > 0),
  constraint simulation_sessions_access_token_hash_not_blank check (length(btrim(access_token_hash)) > 0),
  constraint simulation_sessions_status_not_blank check (length(btrim(status)) > 0),
  constraint simulation_sessions_initial_job_count_non_negative check (initial_job_count >= 0),
  constraint simulation_sessions_successful_generated_output_count_non_negative check (
    successful_generated_output_count >= 0
  )
);

create unique index simulation_sessions_access_token_hash_unique_idx
  on public.simulation_sessions (access_token_hash);

create index simulation_sessions_email_hash_idx
  on public.simulation_sessions (email_normalized_hash);

alter table public.consent_records
  add constraint consent_records_simulation_session_fk
  foreign key (simulation_session_id)
  references public.simulation_sessions (id)
  on delete set null;

create table public.in_home_simulation_jobs (
  id uuid primary key default gen_random_uuid(),
  simulation_session_id uuid not null references public.simulation_sessions (id) on delete restrict,
  selected_sofa_id uuid not null references public.sofas (id) on delete restrict,
  selected_fabric_id uuid not null references public.fabrics (id) on delete restrict,
  selected_visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  prepared_render_cell_id uuid not null references public.sofa_render_cells (id) on delete restrict,
  prepared_sofa_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  storage_prefix text not null,
  customer_room_photo_hash text,
  customer_room_original_path text,
  room_normalized_path text,
  room_compressed_path text,
  room_cleaned_path text,
  prepared_sofa_path text,
  dimension_guide_overlay_path text,
  room_geometry_mode public.room_geometry_mode,
  room_geometry_confidence numeric,
  room_geometry_failure_reason text,
  room_geometry_points jsonb,
  supplied_dimensions jsonb,
  latest_generated_output_index integer,
  generated_output_count integer not null default 0,
  regeneration_count integer not null default 0,
  reserved_generation_index integer,
  status public.simulation_job_status not null default 'queued',
  room_prep_attempt_count integer not null default 0,
  placement_attempt_count integer not null default 0,
  max_attempts_per_stage integer not null default 3,
  claimed_by text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  last_regeneration_error_message text,
  worker_error_path text,
  retention_deadline timestamptz not null,
  queued_at timestamptz,
  room_prep_started_at timestamptz,
  awaiting_dimensions_at timestamptz,
  dimensions_submitted_at timestamptz,
  placement_started_at timestamptz,
  completed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint in_home_simulation_jobs_storage_prefix_not_blank check (length(btrim(storage_prefix)) > 0),
  constraint in_home_simulation_jobs_room_geometry_confidence_range check (
    room_geometry_confidence is null or (
      room_geometry_confidence >= 0 and room_geometry_confidence <= 1
    )
  ),
  constraint in_home_simulation_jobs_latest_generated_output_index_range check (
    latest_generated_output_index is null or latest_generated_output_index in (0, 1, 2)
  ),
  constraint in_home_simulation_jobs_reserved_generation_index_range check (
    reserved_generation_index is null or reserved_generation_index in (0, 1, 2)
  ),
  constraint in_home_simulation_jobs_generated_output_count_range check (
    generated_output_count >= 0 and generated_output_count <= 3
  ),
  constraint in_home_simulation_jobs_regeneration_count_range check (
    regeneration_count >= 0 and regeneration_count <= 2
  ),
  constraint in_home_simulation_jobs_attempt_counts_non_negative check (
    room_prep_attempt_count >= 0 and placement_attempt_count >= 0
  ),
  constraint in_home_simulation_jobs_max_attempts_per_stage_positive check (
    max_attempts_per_stage > 0
  ),
  constraint in_home_simulation_jobs_retention_deadline_cap check (
    retention_deadline <= created_at + interval '24 hours'
  ),
  constraint in_home_simulation_jobs_regeneration_count_matches_outputs check (
    regeneration_count = greatest(generated_output_count - 1, 0)
  )
);

create index in_home_simulation_jobs_status_queued_idx
  on public.in_home_simulation_jobs (status, queued_at);

create index in_home_simulation_jobs_retention_deadline_idx
  on public.in_home_simulation_jobs (retention_deadline);

create index in_home_simulation_jobs_simulation_session_id_idx
  on public.in_home_simulation_jobs (simulation_session_id);

create index in_home_simulation_jobs_selected_lookup_idx
  on public.in_home_simulation_jobs (
    selected_sofa_id,
    selected_fabric_id,
    selected_visual_matrix_column_id
  );

create index in_home_simulation_jobs_claim_expires_idx
  on public.in_home_simulation_jobs (claim_expires_at)
  where status in ('room_prep_processing', 'placement_processing');

create table public.simulation_generated_outputs (
  id uuid primary key default gen_random_uuid(),
  in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs (id) on delete cascade,
  generation_index integer not null,
  object_path text,
  content_type text not null,
  width_px integer,
  height_px integer,
  source_type text not null default 'ai_generated_in_home_simulation',
  provider_name text,
  provider_model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  purged_at timestamptz,
  constraint simulation_generated_outputs_generation_index_range check (
    generation_index in (0, 1, 2)
  ),
  constraint simulation_generated_outputs_object_path_required_until_purged check (
    purged_at is not null or (object_path is not null and length(btrim(object_path)) > 0)
  ),
  constraint simulation_generated_outputs_content_type_not_blank check (length(btrim(content_type)) > 0),
  constraint simulation_generated_outputs_positive_width check (width_px is null or width_px > 0),
  constraint simulation_generated_outputs_positive_height check (height_px is null or height_px > 0),
  constraint simulation_generated_outputs_source_type_fixed check (
    source_type = 'ai_generated_in_home_simulation'
  )
);

create unique index simulation_generated_outputs_job_index_unique_idx
  on public.simulation_generated_outputs (in_home_simulation_job_id, generation_index);

create table public.worker_job_events (
  id uuid primary key default gen_random_uuid(),
  job_type public.worker_job_type not null,
  fabric_render_job_id uuid references public.fabric_render_jobs (id) on delete cascade,
  in_home_simulation_job_id uuid references public.in_home_simulation_jobs (id) on delete cascade,
  from_status text,
  to_status text,
  event_type text not null,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint worker_job_events_exactly_one_job check (
    num_nonnulls(fabric_render_job_id, in_home_simulation_job_id) = 1
  ),
  constraint worker_job_events_event_type_not_blank check (length(btrim(event_type)) > 0)
);

create index worker_job_events_fabric_render_job_id_idx
  on public.worker_job_events (fabric_render_job_id);

create index worker_job_events_in_home_simulation_job_id_idx
  on public.worker_job_events (in_home_simulation_job_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify_text(value text)
returns text
language plpgsql
stable
as $$
declare
  normalized text;
begin
  normalized := lower(extensions.unaccent(coalesce(value, '')));
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '-', 'g');
  normalized := trim(both '-' from normalized);

  if normalized = '' then
    return 'sofa';
  end if;

  return normalized;
end;
$$;

create or replace function public.generate_unique_sofa_slug(value text, sofa_id uuid default null)
returns text
language plpgsql
stable
as $$
declare
  base_slug text := public.slugify_text(value);
  candidate_slug text := base_slug;
  suffix integer := 2;
begin
  while exists (
    select 1
    from public.sofas
    where public_slug = candidate_slug
      and (sofa_id is null or id <> sofa_id)
  ) loop
    candidate_slug := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  return candidate_slug;
end;
$$;

create or replace function public.sofas_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and old.first_published_at is not null
    and new.public_slug is distinct from old.public_slug
  then
    raise exception 'public_slug cannot change after first publication'
      using errcode = '23514';
  end if;

  if new.public_slug is null and new.public_name is not null then
    new.public_slug := public.generate_unique_sofa_slug(new.public_name, new.id);
  elsif new.public_slug is not null then
    new.public_slug := public.generate_unique_sofa_slug(new.public_slug, new.id);
  end if;

  if new.lifecycle_state = 'published' then
    new.first_published_at := coalesce(new.first_published_at, now());
    if tg_op = 'INSERT' or old.lifecycle_state is distinct from 'published' then
      new.published_at := now();
    else
      new.published_at := coalesce(new.published_at, old.published_at, now());
    end if;
  end if;

  if new.lifecycle_state = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
  end if;

  return new;
end;
$$;

create trigger sofas_before_write_trigger
before insert or update on public.sofas
for each row
execute function public.sofas_before_write();

create trigger sofas_set_updated_at_trigger
before update on public.sofas
for each row
execute function public.set_updated_at();

create trigger public_tags_set_updated_at_trigger
before update on public.public_tags
for each row
execute function public.set_updated_at();

create trigger fabrics_set_updated_at_trigger
before update on public.fabrics
for each row
execute function public.set_updated_at();

create trigger sofa_fabrics_set_updated_at_trigger
before update on public.sofa_fabrics
for each row
execute function public.set_updated_at();

create trigger visual_matrix_columns_set_updated_at_trigger
before update on public.visual_matrix_columns
for each row
execute function public.set_updated_at();

create trigger sofa_source_photos_set_updated_at_trigger
before update on public.sofa_source_photos
for each row
execute function public.set_updated_at();

create trigger fabric_render_jobs_set_updated_at_trigger
before update on public.fabric_render_jobs
for each row
execute function public.set_updated_at();

create trigger email_verification_requests_set_updated_at_trigger
before update on public.email_verification_requests
for each row
execute function public.set_updated_at();

create trigger simulation_sessions_set_updated_at_trigger
before update on public.simulation_sessions
for each row
execute function public.set_updated_at();

create trigger in_home_simulation_jobs_set_updated_at_trigger
before update on public.in_home_simulation_jobs
for each row
execute function public.set_updated_at();

create or replace function public.validate_visual_matrix_column_source_photo()
returns trigger
language plpgsql
as $$
declare
  source_photo record;
begin
  if new.current_source_photo_id is null then
    return new;
  end if;

  select sofa_id, visual_matrix_column_id
  into source_photo
  from public.sofa_source_photos
  where id = new.current_source_photo_id;

  if source_photo.sofa_id is null
    or source_photo.sofa_id <> new.sofa_id
    or source_photo.visual_matrix_column_id <> new.id
  then
    raise exception 'current_source_photo_id must belong to the same sofa and visual matrix column'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger visual_matrix_columns_validate_source_photo_trigger
before insert or update on public.visual_matrix_columns
for each row
execute function public.validate_visual_matrix_column_source_photo();

create or replace function public.validate_sofa_source_photo()
returns trigger
language plpgsql
as $$
declare
  column_sofa_id uuid;
  source_asset record;
begin
  select sofa_id
  into column_sofa_id
  from public.visual_matrix_columns
  where id = new.visual_matrix_column_id;

  if column_sofa_id is null or column_sofa_id <> new.sofa_id then
    raise exception 'source photo visual matrix column must belong to the same sofa'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.sofa_fabrics
    where sofa_id = new.sofa_id
      and fabric_id = new.original_fabric_id
  ) then
    raise exception 'source photo original fabric must be assigned to the sofa'
      using errcode = '23514';
  end if;

  select visibility, lifecycle_state
  into source_asset
  from public.storage_assets
  where id = new.asset_id;

  if source_asset.visibility <> 'private' or source_asset.lifecycle_state <> 'active' then
    raise exception 'source photo asset must be an active private asset'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger sofa_source_photos_validate_trigger
before insert or update on public.sofa_source_photos
for each row
execute function public.validate_sofa_source_photo();

create or replace function public.validate_sofa_render_cell()
returns trigger
language plpgsql
as $$
declare
  private_asset record;
  public_asset record;
  source_photo record;
  candidate record;
begin
  if not exists (
    select 1
    from public.sofa_fabrics
    where sofa_id = new.sofa_id
      and fabric_id = new.fabric_id
  ) then
    raise exception 'render cell fabric must be assigned to the sofa'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.visual_matrix_columns
    where id = new.visual_matrix_column_id
      and sofa_id = new.sofa_id
  ) then
    raise exception 'render cell visual matrix column must belong to the sofa'
      using errcode = '23514';
  end if;

  if new.current_private_asset_id is not null then
    select visibility, lifecycle_state
    into private_asset
    from public.storage_assets
    where id = new.current_private_asset_id;

    if private_asset.visibility <> 'private' or private_asset.lifecycle_state <> 'active' then
      raise exception 'render cell private asset must be active and private'
        using errcode = '23514';
    end if;
  end if;

  if new.current_public_asset_id is not null then
    select visibility, lifecycle_state, bucket_id
    into public_asset
    from public.storage_assets
    where id = new.current_public_asset_id;

    if public_asset.visibility <> 'public'
      or public_asset.lifecycle_state <> 'active'
      or public_asset.bucket_id <> 'catalog-public-assets'
    then
      raise exception 'render cell public asset must be active and public'
        using errcode = '23514';
    end if;
  end if;

  if new.source_photo_id is not null then
    select sofa_id, visual_matrix_column_id, original_fabric_id
    into source_photo
    from public.sofa_source_photos
    where id = new.source_photo_id;

    if source_photo.sofa_id <> new.sofa_id
      or source_photo.visual_matrix_column_id <> new.visual_matrix_column_id
    then
      raise exception 'render cell source photo must match sofa and visual matrix column'
        using errcode = '23514';
    end if;

    if new.source_type = 'source_photo' and source_photo.original_fabric_id <> new.fabric_id then
      raise exception 'source-photo render cells must use the source photo original fabric'
        using errcode = '23514';
    end if;
  end if;

  if new.accepted_fabric_render_candidate_id is not null then
    select render_cell_id, asset_id, accepted_at
    into candidate
    from public.fabric_render_candidates
    where id = new.accepted_fabric_render_candidate_id;

    if candidate.render_cell_id <> new.id or candidate.asset_id <> new.current_private_asset_id then
      raise exception 'accepted candidate must match render cell and current private asset'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger sofa_render_cells_validate_trigger
before insert or update on public.sofa_render_cells
for each row
execute function public.validate_sofa_render_cell();

create or replace function public.validate_fabric_render_candidate()
returns trigger
language plpgsql
as $$
declare
  cell record;
  job record;
  candidate_asset record;
begin
  select sofa_id, fabric_id, visual_matrix_column_id
  into cell
  from public.sofa_render_cells
  where id = new.render_cell_id;

  if cell.sofa_id <> new.sofa_id
    or cell.fabric_id <> new.fabric_id
    or cell.visual_matrix_column_id <> new.visual_matrix_column_id
  then
    raise exception 'fabric render candidate must match its render cell triple'
      using errcode = '23514';
  end if;

  select render_cell_id, generation_mode, prompt_version
  into job
  from public.fabric_render_jobs
  where id = new.job_id;

  if job.render_cell_id <> new.render_cell_id
    or job.generation_mode <> new.generation_mode
    or job.prompt_version <> new.prompt_version
  then
    raise exception 'fabric render candidate must match its job'
      using errcode = '23514';
  end if;

  select visibility, lifecycle_state
  into candidate_asset
  from public.storage_assets
  where id = new.asset_id;

  if candidate_asset.visibility <> 'private' or candidate_asset.lifecycle_state <> 'active' then
    raise exception 'fabric render candidate asset must be active and private'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger fabric_render_candidates_validate_trigger
before insert or update on public.fabric_render_candidates
for each row
execute function public.validate_fabric_render_candidate();

create or replace function public.validate_in_home_simulation_job()
returns trigger
language plpgsql
as $$
begin
  if new.retention_deadline > new.created_at + interval '24 hours' then
    raise exception 'simulation retention deadline must be no more than 24 hours after creation'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.sofas s
    join public.sofa_fabrics sf
      on sf.sofa_id = s.id
      and sf.fabric_id = new.selected_fabric_id
      and sf.public_order is not null
    join public.fabrics f
      on f.id = sf.fabric_id
      and f.lifecycle_state = 'active'
    join public.visual_matrix_columns vm
      on vm.id = new.selected_visual_matrix_column_id
      and vm.sofa_id = s.id
      and vm.deleted_at is null
    join public.sofa_render_cells rc
      on rc.id = new.prepared_render_cell_id
      and rc.sofa_id = s.id
      and rc.fabric_id = f.id
      and rc.visual_matrix_column_id = vm.id
    join public.storage_assets prepared_asset
      on prepared_asset.id = new.prepared_sofa_asset_id
      and prepared_asset.lifecycle_state = 'active'
      and prepared_asset.visibility = 'private'
    join public.storage_assets public_asset
      on public_asset.id = rc.current_public_asset_id
      and public_asset.lifecycle_state = 'active'
      and public_asset.visibility = 'public'
      and public_asset.bucket_id = 'catalog-public-assets'
    where s.id = new.selected_sofa_id
      and s.lifecycle_state = 'published'
  ) then
    raise exception 'simulation job must reference a published public-usable sofa, fabric, visual position, and render cell'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger in_home_simulation_jobs_validate_trigger
before insert or update on public.in_home_simulation_jobs
for each row
execute function public.validate_in_home_simulation_job();

create or replace function public.sofa_publication_readiness_errors(p_sofa_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  sofa record;
  errors text[] := array[]::text[];
  active_column_count integer;
  public_fabric_count integer;
  missing_render_count integer;
  missing_swatch_count integer;
begin
  select *
  into sofa
  from public.sofas
  where id = p_sofa_id;

  if sofa.id is null then
    return array['sofa_not_found'];
  end if;

  if sofa.public_name is null or length(btrim(sofa.public_name)) = 0 then
    errors := array_append(errors, 'missing_public_name');
  end if;

  if sofa.shopify_order_url is null
    or sofa.shopify_order_url !~* '^https?://'
  then
    errors := array_append(errors, 'missing_or_invalid_shopify_order_url');
  end if;

  if sofa.first_published_at is not null and sofa.public_slug is null then
    errors := array_append(errors, 'missing_frozen_public_slug');
  end if;

  select count(*)
  into active_column_count
  from public.visual_matrix_columns
  where sofa_id = p_sofa_id
    and deleted_at is null;

  if active_column_count = 0 then
    errors := array_append(errors, 'missing_active_visual_position');
  end if;

  select count(*)
  into public_fabric_count
  from public.sofa_fabrics sf
  join public.fabrics f on f.id = sf.fabric_id
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and f.lifecycle_state = 'active';

  if public_fabric_count = 0 then
    errors := array_append(errors, 'missing_public_fabric');
  end if;

  select count(*)
  into missing_render_count
  from public.sofa_fabrics sf
  join public.fabrics f
    on f.id = sf.fabric_id
    and f.lifecycle_state = 'active'
  cross join public.visual_matrix_columns vm
  left join public.sofa_render_cells rc
    on rc.sofa_id = sf.sofa_id
    and rc.fabric_id = sf.fabric_id
    and rc.visual_matrix_column_id = vm.id
  left join public.storage_assets private_asset
    on private_asset.id = rc.current_private_asset_id
    and private_asset.lifecycle_state = 'active'
    and private_asset.visibility = 'private'
  left join public.storage_assets public_asset
    on public_asset.id = rc.current_public_asset_id
    and public_asset.lifecycle_state = 'active'
    and public_asset.visibility = 'public'
    and public_asset.bucket_id = 'catalog-public-assets'
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and vm.sofa_id = p_sofa_id
    and vm.deleted_at is null
    and (rc.id is null or private_asset.id is null or public_asset.id is null);

  if missing_render_count > 0 then
    errors := array_append(errors, 'incomplete_public_render_coverage');
  end if;

  select count(*)
  into missing_swatch_count
  from public.sofa_fabrics sf
  join public.fabrics f
    on f.id = sf.fabric_id
    and f.lifecycle_state = 'active'
  left join public.storage_assets swatch_asset
    on swatch_asset.id = f.swatch_asset_id
    and swatch_asset.lifecycle_state = 'active'
    and swatch_asset.visibility = 'public'
    and swatch_asset.bucket_id = 'catalog-public-assets'
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and swatch_asset.id is null;

  if missing_swatch_count > 0 then
    errors := array_append(errors, 'missing_public_swatch_asset');
  end if;

  return errors;
end;
$$;

create or replace function public.spec_0009_expired_simulation_jobs(p_now timestamptz default now())
returns table (
  id uuid,
  storage_prefix text,
  retention_deadline timestamptz
)
language sql
stable
as $$
  select j.id, j.storage_prefix, j.retention_deadline
  from public.in_home_simulation_jobs j
  where j.retention_deadline <= p_now
    and j.status <> 'expired';
$$;

create or replace function public.spec_0009_orphan_room_upload_objects(p_now timestamptz default now())
returns table (
  bucket_id text,
  object_name text,
  created_at timestamptz
)
language sql
stable
as $$
  select o.bucket_id, o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'simulation-private-artifacts'
    and o.name like 'orphan-room-uploads/%'
    and o.created_at <= p_now - interval '1 hour';
$$;

create or replace function public.spec_0009_mark_simulation_job_purged(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.simulation_generated_outputs
  set
    object_path = null,
    purged_at = coalesce(purged_at, now())
  where in_home_simulation_job_id = p_job_id
    and purged_at is null;

  update public.in_home_simulation_jobs
  set
    customer_room_original_path = null,
    room_normalized_path = null,
    room_compressed_path = null,
    room_cleaned_path = null,
    prepared_sofa_path = null,
    dimension_guide_overlay_path = null,
    worker_error_path = null,
    status = 'expired',
    expired_at = coalesce(expired_at, now()),
    updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.spec_0009_expired_zip_exports(p_now timestamptz default now())
returns table (
  id uuid,
  sofa_id uuid,
  asset_id uuid,
  expires_at timestamptz
)
language sql
stable
as $$
  select e.id, e.sofa_id, e.asset_id, e.expires_at
  from public.sofa_render_exports e
  where e.expires_at is not null
    and e.expires_at <= p_now
    and e.asset_id is not null;
$$;

create or replace function public.spec_0009_public_render_assets_for_unavailable_sofas()
returns table (
  sofa_id uuid,
  render_cell_id uuid,
  storage_asset_id uuid,
  bucket_id text,
  object_path text
)
language sql
stable
as $$
  select
    rc.sofa_id,
    rc.id as render_cell_id,
    public_asset.id as storage_asset_id,
    public_asset.bucket_id,
    public_asset.object_path
  from public.sofa_render_cells rc
  join public.sofas s
    on s.id = rc.sofa_id
    and s.lifecycle_state <> 'published'
  join public.storage_assets public_asset
    on public_asset.id = rc.current_public_asset_id
    and public_asset.visibility = 'public'
    and public_asset.lifecycle_state = 'active'
    and public_asset.bucket_id = 'catalog-public-assets';
$$;

create or replace view public.public_catalog_sofas
with (security_barrier = true)
as
select
  s.id,
  s.public_name,
  s.public_slug,
  s.shopify_order_url,
  s.public_description,
  s.length_cm,
  s.depth_cm,
  s.height_cm,
  s.footprint_type,
  s.footprint_measurements,
  s.manual_public_order,
  s.created_at
from public.sofas s
where s.lifecycle_state = 'published';

create or replace view public.public_catalog_tags
with (security_barrier = true)
as
select distinct
  t.id,
  t.public_label,
  t.slug
from public.public_tags t
join public.sofa_tags st on st.tag_id = t.id
join public.sofas s on s.id = st.sofa_id
where s.lifecycle_state = 'published';

create or replace view public.public_sofa_visual_positions
with (security_barrier = true)
as
select
  vm.id,
  vm.sofa_id,
  vm.sequence,
  vm.public_label
from public.visual_matrix_columns vm
join public.sofas s on s.id = vm.sofa_id
where s.lifecycle_state = 'published'
  and vm.deleted_at is null;

create or replace view public.public_sofa_fabrics
with (security_barrier = true)
as
select
  f.id,
  sf.sofa_id,
  f.public_name,
  f.is_premium,
  sf.public_order,
  swatch_asset.object_path as public_swatch_object_path,
  swatch_asset.content_type as public_swatch_content_type,
  swatch_asset.width_px as public_swatch_width_px,
  swatch_asset.height_px as public_swatch_height_px
from public.sofa_fabrics sf
join public.sofas s
  on s.id = sf.sofa_id
  and s.lifecycle_state = 'published'
join public.fabrics f
  on f.id = sf.fabric_id
  and f.lifecycle_state = 'active'
join public.storage_assets swatch_asset
  on swatch_asset.id = f.swatch_asset_id
  and swatch_asset.visibility = 'public'
  and swatch_asset.lifecycle_state = 'active'
  and swatch_asset.bucket_id = 'catalog-public-assets'
where sf.public_order is not null
  and not exists (
    select 1
    from public.visual_matrix_columns vm
    where vm.sofa_id = sf.sofa_id
      and vm.deleted_at is null
      and not exists (
        select 1
        from public.sofa_render_cells rc
        join public.storage_assets public_asset
          on public_asset.id = rc.current_public_asset_id
          and public_asset.visibility = 'public'
          and public_asset.lifecycle_state = 'active'
          and public_asset.bucket_id = 'catalog-public-assets'
        where rc.sofa_id = sf.sofa_id
          and rc.fabric_id = sf.fabric_id
          and rc.visual_matrix_column_id = vm.id
      )
  );

create or replace view public.public_sofa_render_cells
with (security_barrier = true)
as
select
  rc.sofa_id,
  rc.fabric_id,
  rc.visual_matrix_column_id,
  rc.id as render_cell_id,
  public_asset.object_path as public_render_object_path,
  public_asset.content_type as public_render_content_type,
  public_asset.width_px as public_render_width_px,
  public_asset.height_px as public_render_height_px
from public.sofa_render_cells rc
join public.sofas s
  on s.id = rc.sofa_id
  and s.lifecycle_state = 'published'
join public.sofa_fabrics sf
  on sf.sofa_id = rc.sofa_id
  and sf.fabric_id = rc.fabric_id
  and sf.public_order is not null
join public.fabrics f
  on f.id = rc.fabric_id
  and f.lifecycle_state = 'active'
join public.visual_matrix_columns vm
  on vm.id = rc.visual_matrix_column_id
  and vm.sofa_id = rc.sofa_id
  and vm.deleted_at is null
join public.storage_assets public_asset
  on public_asset.id = rc.current_public_asset_id
  and public_asset.visibility = 'public'
  and public_asset.lifecycle_state = 'active'
  and public_asset.bucket_id = 'catalog-public-assets';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'catalog-public-assets',
    'catalog-public-assets',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'catalog-private-assets',
    'catalog-private-assets',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'application/zip']
  ),
  (
    'simulation-private-artifacts',
    'simulation-private-artifacts',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'text/plain', 'application/json']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.worker_smoke_jobs enable row level security;

do $$
declare
  table_name text;
  table_names text[] := array[
    'worker_smoke_jobs',
    'storage_assets',
    'sofas',
    'public_tags',
    'sofa_tags',
    'fabrics',
    'sofa_fabrics',
    'visual_matrix_columns',
    'sofa_source_photos',
    'sofa_render_cells',
    'fabric_render_jobs',
    'fabric_render_candidates',
    'sofa_render_exports',
    'email_verification_requests',
    'consent_records',
    'simulation_sessions',
    'in_home_simulation_jobs',
    'simulation_generated_outputs',
    'worker_job_events'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'spec_0009_service_role_all_' || table_name,
      table_name
    );
  end loop;
end $$;

revoke all on table
  public.public_catalog_sofas,
  public.public_catalog_tags,
  public.public_sofa_fabrics,
  public.public_sofa_visual_positions,
  public.public_sofa_render_cells
from anon, authenticated;

grant select on
  public.public_catalog_sofas,
  public.public_catalog_tags,
  public.public_sofa_fabrics,
  public.public_sofa_visual_positions,
  public.public_sofa_render_cells
to anon, authenticated;

grant execute on function public.sofa_publication_readiness_errors(uuid) to service_role;
grant execute on function public.spec_0009_expired_simulation_jobs(timestamptz) to service_role;
grant execute on function public.spec_0009_orphan_room_upload_objects(timestamptz) to service_role;
grant execute on function public.spec_0009_mark_simulation_job_purged(uuid) to service_role;
grant execute on function public.spec_0009_expired_zip_exports(timestamptz) to service_role;
grant execute on function public.spec_0009_public_render_assets_for_unavailable_sofas() to service_role;

create policy spec_0009_catalog_public_assets_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'catalog-public-assets');

create policy spec_0009_service_role_storage_objects_all
on storage.objects
for all
to service_role
using (true)
with check (true);
