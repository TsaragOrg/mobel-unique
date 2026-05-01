-- SPEC-0007 PLAN-0010 local test seeding helpers for the in-home simulation
-- worker.
--
-- These helpers exist so the local CLIs `pnpm sim:enqueue:stage1` and
-- `pnpm sim:status` can drive the worker end to end against local Supabase
-- without needing the public API to exist yet. They create idempotent
-- catalog fixtures (a published sofa, fabric, visual matrix column, and
-- prepared render cell) under stable test-fixture UUIDs, then mint a fresh
-- simulation session and in-home simulation job for each call.
--
-- These helpers MUST NOT be invoked from production code. They are intended
-- for local CLI use only. The fixture rows they create live under the
-- `00000000-0000-4000-8000-00000F00xxxx` UUID prefix so an operator can
-- identify and remove them in any non-local environment.

create or replace function public.ensure_in_home_simulation_local_test_fixtures()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  swatch_asset uuid := '00000000-0000-4000-8000-00000f000101';
  ai_reference_asset uuid := '00000000-0000-4000-8000-00000f000102';
  render_private_asset uuid := '00000000-0000-4000-8000-00000f000103';
  render_public_asset uuid := '00000000-0000-4000-8000-00000f000104';
  prepared_sofa_asset uuid := '00000000-0000-4000-8000-00000f000105';
  test_sofa uuid := '00000000-0000-4000-8000-00000f000201';
  test_fabric uuid := '00000000-0000-4000-8000-00000f000301';
  test_visual_column uuid := '00000000-0000-4000-8000-00000f000401';
  test_render_cell uuid := '00000000-0000-4000-8000-00000f000501';
begin
  insert into public.storage_assets (
    id, bucket_id, object_path, visibility, lifecycle_state,
    asset_kind, content_type, byte_size, width_px, height_px
  )
  values
    (swatch_asset, 'catalog-public-assets', 'in-home-simulation-local/swatch.png',
      'public', 'active', 'fabric_swatch_public', 'image/png', 10, 10, 10),
    (ai_reference_asset, 'catalog-private-assets', 'in-home-simulation-local/ai-reference.png',
      'private', 'active', 'fabric_ai_reference', 'image/png', 10, 10, 10),
    (render_private_asset, 'catalog-private-assets', 'in-home-simulation-local/render-private.png',
      'private', 'active', 'render_private', 'image/png', 10, 10, 10),
    (render_public_asset, 'catalog-public-assets', 'in-home-simulation-local/render-public.png',
      'public', 'active', 'render_public', 'image/png', 10, 10, 10),
    (prepared_sofa_asset, 'catalog-private-assets', 'in-home-simulation-local/prepared-sofa.png',
      'private', 'active', 'prepared_sofa_private', 'image/png', 10, 10, 10)
  on conflict (id) do nothing;

  insert into public.sofas (
    id, lifecycle_state, internal_name, public_name, shopify_order_url
  )
  values (
    test_sofa, 'published',
    'In-Home Simulation Local Test Sofa',
    'In-Home Simulation Local Test Sofa',
    'https://shop.example/in-home-simulation-local'
  )
  on conflict (id) do nothing;

  insert into public.fabrics (
    id, lifecycle_state, internal_name, public_name,
    swatch_asset_id, ai_reference_asset_id, is_premium
  )
  values (
    test_fabric, 'active',
    'In-Home Simulation Local Test Fabric',
    'In-Home Simulation Local Test Fabric',
    swatch_asset, ai_reference_asset, false
  )
  on conflict (id) do nothing;

  insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
  values (test_sofa, test_fabric, 0)
  on conflict (sofa_id, fabric_id) do nothing;

  insert into public.visual_matrix_columns (
    id, sofa_id, sequence, admin_label, public_label
  )
  values (
    test_visual_column, test_sofa, 1, 'Front', 'Front'
  )
  on conflict (id) do nothing;

  insert into public.sofa_render_cells (
    id, sofa_id, fabric_id, visual_matrix_column_id,
    current_private_asset_id, current_public_asset_id, source_type
  )
  values (
    test_render_cell, test_sofa, test_fabric, test_visual_column,
    render_private_asset, render_public_asset, 'manual_upload'
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.seed_in_home_simulation_local_test_job(
  customer_room_original_path text,
  job_id_override uuid default null,
  retention_hours integer default 24
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  selected_sofa_id uuid := '00000000-0000-4000-8000-00000f000201';
  selected_fabric_id uuid := '00000000-0000-4000-8000-00000f000301';
  selected_visual_column_id uuid := '00000000-0000-4000-8000-00000f000401';
  selected_render_cell_id uuid := '00000000-0000-4000-8000-00000f000501';
  prepared_sofa_asset_id uuid := '00000000-0000-4000-8000-00000f000105';
  email_hash text;
  email_verification_id uuid;
  consent_id uuid;
  session_id uuid;
  job_id uuid;
  retention_interval interval;
begin
  if customer_room_original_path is null
    or length(btrim(customer_room_original_path)) = 0 then
    raise exception 'customer_room_original_path is required';
  end if;

  if retention_hours is null
    or retention_hours <= 0
    or retention_hours > 24 then
    raise exception 'retention_hours must be a positive integer no greater than 24';
  end if;

  retention_interval := make_interval(hours => retention_hours);

  perform public.ensure_in_home_simulation_local_test_fixtures();

  email_hash := encode(extensions.gen_random_bytes(16), 'hex');

  job_id := coalesce(job_id_override, extensions.gen_random_uuid());

  insert into public.email_verification_requests (
    email_normalized_hash, verification_code_hash, status, expires_at
  )
  values (
    email_hash,
    encode(extensions.gen_random_bytes(16), 'hex'),
    'verified',
    now() + interval '15 minutes'
  )
  returning id into email_verification_id;

  insert into public.consent_records (
    consent_type, decision, email_normalized_hash,
    wording_version, locale, source, decided_at
  )
  values (
    'email_verification_required', 'granted', email_hash,
    'v1', 'fr-FR', 'in-home-simulation-local-cli', now()
  )
  returning id into consent_id;

  insert into public.simulation_sessions (
    email_verification_request_id, email_normalized_hash,
    required_email_consent_record_id, access_token_hash,
    status, expires_at
  )
  values (
    email_verification_id, email_hash, consent_id,
    encode(extensions.gen_random_bytes(32), 'hex'),
    'active', now() + interval '24 hours'
  )
  returning id into session_id;

  update public.consent_records
  set simulation_session_id = session_id
  where id = consent_id;

  insert into public.in_home_simulation_jobs (
    id,
    simulation_session_id,
    selected_sofa_id,
    selected_fabric_id,
    selected_visual_matrix_column_id,
    prepared_render_cell_id,
    prepared_sofa_asset_id,
    storage_prefix,
    customer_room_original_path,
    status,
    retention_deadline,
    queued_at
  )
  values (
    job_id,
    session_id,
    selected_sofa_id,
    selected_fabric_id,
    selected_visual_column_id,
    selected_render_cell_id,
    prepared_sofa_asset_id,
    'simulations/' || job_id::text,
    customer_room_original_path,
    'queued',
    now() + retention_interval,
    now()
  );

  return job_id;
end;
$$;

create or replace function public.enqueue_in_home_simulation_room_prep_message(
  job_id uuid,
  queue_name text default 'local_in_home_simulation_jobs'
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  msg_id bigint;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  if not exists (
    select 1 from public.in_home_simulation_jobs where id = job_id
  ) then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  msg_id := pgmq.send(
    queue_name,
    jsonb_build_object('job_id', job_id, 'type', 'in_home_simulation_room_prep')
  );

  return msg_id;
end;
$$;
