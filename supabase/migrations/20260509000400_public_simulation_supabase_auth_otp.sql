-- SPEC-0015 PLAN-0074 public simulation Supabase Auth email OTP.
--
-- This migration replaces the launch-window identity stub with database
-- support for provider-backed OTP verification while preserving the public
-- simulation access-token boundary. Supabase Auth owns OTP generation and
-- validation; application tables own consent, verified simulation sessions,
-- rate-limit identity, and retention cleanup.

alter table public.email_verification_requests
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
  add column if not exists email_purged_at timestamptz;

alter table public.email_verification_requests
  alter column verification_code_hash drop not null;

alter table public.consent_records
  add column if not exists email_verification_request_id uuid
    references public.email_verification_requests (id) on delete set null;

alter table public.simulation_sessions
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists email_verification_requests_auth_user_id_idx
  on public.email_verification_requests (auth_user_id)
  where auth_user_id is not null;

create index if not exists email_verification_requests_status_expires_idx
  on public.email_verification_requests (status, expires_at);

create index if not exists email_verification_requests_email_purge_idx
  on public.email_verification_requests (expires_at, email_purged_at)
  where email_address_encrypted is not null;

create index if not exists consent_records_email_verification_request_id_idx
  on public.consent_records (email_verification_request_id);

create index if not exists simulation_sessions_auth_user_id_idx
  on public.simulation_sessions (auth_user_id)
  where auth_user_id is not null;

create or replace function public.create_public_simulation_email_verification_request(
  p_email_address_encrypted text,
  p_email_normalized_hash text,
  p_required_wording_version text,
  p_required_locale text,
  p_optional_commercial_decision public.consent_decision,
  p_optional_wording_version text,
  p_optional_locale text,
  p_expires_at timestamptz
)
returns table (
  out_verification_request_id uuid,
  out_required_consent_record_id uuid,
  out_optional_commercial_consent_record_id uuid,
  out_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_request_id uuid;
  required_consent_id uuid;
  optional_consent_id uuid;
begin
  if p_email_address_encrypted is null
    or length(btrim(p_email_address_encrypted)) = 0 then
    raise exception 'p_email_address_encrypted is required';
  end if;

  if p_email_normalized_hash is null
    or length(btrim(p_email_normalized_hash)) = 0 then
    raise exception 'p_email_normalized_hash is required';
  end if;

  if p_required_wording_version is null
    or length(btrim(p_required_wording_version)) = 0 then
    raise exception 'p_required_wording_version is required';
  end if;

  if p_required_locale is null or length(btrim(p_required_locale)) = 0 then
    raise exception 'p_required_locale is required';
  end if;

  if p_optional_commercial_decision is null then
    raise exception 'p_optional_commercial_decision is required';
  end if;

  if p_optional_wording_version is null
    or length(btrim(p_optional_wording_version)) = 0 then
    raise exception 'p_optional_wording_version is required';
  end if;

  if p_optional_locale is null or length(btrim(p_optional_locale)) = 0 then
    raise exception 'p_optional_locale is required';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'p_expires_at must be in the future';
  end if;

  insert into public.email_verification_requests (
    email_address_encrypted,
    email_normalized_hash,
    verification_code_hash,
    status,
    send_count,
    expires_at,
    last_sent_at
  )
  values (
    p_email_address_encrypted,
    p_email_normalized_hash,
    null,
    'code_sent',
    1,
    p_expires_at,
    now()
  )
  returning id into new_request_id;

  insert into public.consent_records (
    email_verification_request_id,
    consent_type,
    decision,
    email_normalized_hash,
    wording_version,
    locale,
    source,
    decided_at
  )
  values (
    new_request_id,
    'email_verification_required',
    'granted',
    p_email_normalized_hash,
    p_required_wording_version,
    p_required_locale,
    'public-simulation-email-gate',
    now()
  )
  returning id into required_consent_id;

  insert into public.consent_records (
    email_verification_request_id,
    consent_type,
    decision,
    email_normalized_hash,
    wording_version,
    locale,
    source,
    decided_at
  )
  values (
    new_request_id,
    'commercial_contact_optional',
    p_optional_commercial_decision,
    p_email_normalized_hash,
    p_optional_wording_version,
    p_optional_locale,
    'public-simulation-email-gate',
    now()
  )
  returning id into optional_consent_id;

  out_verification_request_id := new_request_id;
  out_required_consent_record_id := required_consent_id;
  out_optional_commercial_consent_record_id := optional_consent_id;
  out_expires_at := p_expires_at;
  return next;
end;
$$;

grant execute on function public.create_public_simulation_email_verification_request(
  text,
  text,
  text,
  text,
  public.consent_decision,
  text,
  text,
  timestamptz
) to service_role;

create or replace function public.verify_public_simulation_auth_otp_session(
  p_verification_request_id uuid,
  p_auth_user_id uuid,
  p_access_token_hash text,
  p_session_expires_at timestamptz
)
returns table (
  out_simulation_session_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  request_row public.email_verification_requests%rowtype;
  required_consent_id uuid;
  optional_consent_id uuid;
  session_id uuid;
begin
  if p_verification_request_id is null then
    raise exception 'p_verification_request_id is required';
  end if;

  if p_auth_user_id is null then
    raise exception 'p_auth_user_id is required';
  end if;

  if p_access_token_hash is null or length(btrim(p_access_token_hash)) = 0 then
    raise exception 'p_access_token_hash is required';
  end if;

  if p_session_expires_at is null or p_session_expires_at <= now() then
    raise exception 'p_session_expires_at must be in the future';
  end if;

  select *
  into request_row
  from public.email_verification_requests
  where id = p_verification_request_id
  for update;

  if request_row.id is null then
    raise exception 'email verification request not found';
  end if;

  if request_row.expires_at <= now() then
    raise exception 'email verification request expired';
  end if;

  if request_row.status not in ('code_sent', 'verified') then
    raise exception 'email verification request is not verifiable';
  end if;

  select id into required_consent_id
  from public.consent_records
  where email_verification_request_id = p_verification_request_id
    and consent_type = 'email_verification_required'
    and decision = 'granted'
  order by created_at desc
  limit 1;

  if required_consent_id is null then
    raise exception 'required consent record not found';
  end if;

  select id into optional_consent_id
  from public.consent_records
  where email_verification_request_id = p_verification_request_id
    and consent_type = 'commercial_contact_optional'
  order by created_at desc
  limit 1;

  update public.email_verification_requests
  set
    auth_user_id = p_auth_user_id,
    status = 'verified',
    verified_at = coalesce(verified_at, now()),
    updated_at = now()
  where id = p_verification_request_id;

  insert into public.simulation_sessions (
    email_verification_request_id,
    auth_user_id,
    email_normalized_hash,
    required_email_consent_record_id,
    optional_commercial_consent_record_id,
    access_token_hash,
    status,
    expires_at
  )
  values (
    p_verification_request_id,
    p_auth_user_id,
    request_row.email_normalized_hash,
    required_consent_id,
    optional_consent_id,
    p_access_token_hash,
    'active',
    p_session_expires_at
  )
  on conflict (access_token_hash) do update
  set
    auth_user_id = excluded.auth_user_id,
    email_verification_request_id = excluded.email_verification_request_id,
    email_normalized_hash = excluded.email_normalized_hash,
    required_email_consent_record_id =
      excluded.required_email_consent_record_id,
    optional_commercial_consent_record_id =
      excluded.optional_commercial_consent_record_id,
    status = 'active',
    expires_at = excluded.expires_at,
    updated_at = now()
  returning id into session_id;

  update public.consent_records
  set simulation_session_id = session_id
  where email_verification_request_id = p_verification_request_id
    and simulation_session_id is null;

  out_simulation_session_id := session_id;
  return next;
end;
$$;

grant execute on function public.verify_public_simulation_auth_otp_session(
  uuid,
  uuid,
  text,
  timestamptz
) to service_role;

create or replace function public.purge_public_simulation_email_handoffs(
  p_batch_size integer default 500
)
returns table (
  out_verification_request_id uuid,
  out_auth_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_batch_size is null or p_batch_size <= 0 then
    raise exception 'p_batch_size must be positive';
  end if;

  return query
  with eligible as (
    select evr.id, evr.auth_user_id
    from public.email_verification_requests evr
    where evr.email_address_encrypted is not null
      and evr.email_purged_at is null
      and evr.created_at < now() - interval '24 hours'
    order by evr.created_at asc
    limit p_batch_size
    for update skip locked
  ),
  updated as (
    update public.email_verification_requests evr
    set
      email_address_encrypted = null,
      email_purged_at = now(),
      updated_at = now()
    from eligible
    where evr.id = eligible.id
    returning evr.id, eligible.auth_user_id
  ),
  auth_cleanup_candidates as (
    select distinct updated.auth_user_id
    from updated
    where updated.auth_user_id is not null
      and not exists (
        select 1
        from public.email_verification_requests other_request
        where other_request.auth_user_id = updated.auth_user_id
          and other_request.email_purged_at is null
      )
      and not exists (
        select 1
        from public.simulation_sessions active_session
        where active_session.auth_user_id = updated.auth_user_id
          and active_session.status = 'active'
          and active_session.expires_at > now()
      )
  )
  select
    updated.id,
    case
      when updated.auth_user_id in (
        select auth_cleanup_candidates.auth_user_id
        from auth_cleanup_candidates
      ) then updated.auth_user_id
      else null
    end
  from updated;
end;
$$;

grant execute on function public.purge_public_simulation_email_handoffs(
  integer
) to service_role;

create or replace function public.create_in_home_simulation_job_for_visitor(
  p_verification_request_id text,
  p_sofa_slug text,
  p_fabric_id uuid,
  p_visual_position_id uuid,
  p_customer_room_original_path text,
  p_room_geometry_mode public.room_geometry_mode,
  p_job_id_override uuid default null,
  p_retention_hours integer default 24
)
returns table (
  out_job_id uuid,
  out_status public.simulation_job_status,
  out_created_at timestamptz,
  out_retention_deadline timestamptz,
  out_room_geometry_mode public.room_geometry_mode,
  out_storage_prefix text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  resolved_render_cell_id uuid;
  resolved_sofa_id uuid;
  resolved_prepared_sofa_asset_id uuid;
  derived_access_token_hash text;
  session_id uuid;
  new_job_id uuid;
  new_storage_prefix text;
  retention_interval interval;
  job_created_at timestamptz;
  job_retention_deadline timestamptz;
begin
  if p_verification_request_id is null
    or length(btrim(p_verification_request_id)) = 0 then
    raise exception 'p_verification_request_id is required';
  end if;

  if p_sofa_slug is null or length(btrim(p_sofa_slug)) = 0 then
    raise exception 'p_sofa_slug is required';
  end if;

  if p_fabric_id is null then
    raise exception 'p_fabric_id is required';
  end if;

  if p_visual_position_id is null then
    raise exception 'p_visual_position_id is required';
  end if;

  if p_customer_room_original_path is null
    or length(btrim(p_customer_room_original_path)) = 0 then
    raise exception 'p_customer_room_original_path is required';
  end if;

  if p_room_geometry_mode is null then
    raise exception 'p_room_geometry_mode is required';
  end if;

  if p_retention_hours is null
    or p_retention_hours <= 0
    or p_retention_hours > 24 then
    raise exception
      'p_retention_hours must be a positive integer no greater than 24';
  end if;

  retention_interval := make_interval(hours => p_retention_hours);

  select
    rc.id,
    rc.sofa_id,
    rc.current_private_asset_id
  into
    resolved_render_cell_id,
    resolved_sofa_id,
    resolved_prepared_sofa_asset_id
  from public.sofa_render_cells rc
  join public.sofas s on s.id = rc.sofa_id
  where s.public_slug = p_sofa_slug
    and s.lifecycle_state = 'published'
    and rc.fabric_id = p_fabric_id
    and rc.visual_matrix_column_id = p_visual_position_id
    and rc.current_private_asset_id is not null
    and rc.current_public_asset_id is not null
  limit 1;

  if resolved_render_cell_id is null then
    return;
  end if;

  derived_access_token_hash := encode(
    extensions.digest('access_token:' || p_verification_request_id, 'sha256'),
    'hex'
  );

  select id into session_id
  from public.simulation_sessions
  where access_token_hash = derived_access_token_hash
    and status = 'active'
    and expires_at > now()
  limit 1;

  if session_id is null then
    raise exception 'verified simulation session required';
  end if;

  new_job_id := coalesce(p_job_id_override, extensions.gen_random_uuid());
  new_storage_prefix := 'simulations/' || new_job_id::text;
  job_created_at := now();
  job_retention_deadline := job_created_at + retention_interval;

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
    room_geometry_mode,
    status,
    retention_deadline,
    queued_at,
    created_at,
    updated_at
  )
  values (
    new_job_id,
    session_id,
    resolved_sofa_id,
    p_fabric_id,
    p_visual_position_id,
    resolved_render_cell_id,
    resolved_prepared_sofa_asset_id,
    new_storage_prefix,
    p_customer_room_original_path,
    p_room_geometry_mode,
    'queued',
    job_retention_deadline,
    job_created_at,
    job_created_at,
    job_created_at
  );

  update public.simulation_sessions
  set
    initial_job_count = initial_job_count + 1,
    updated_at = now()
  where id = session_id;

  out_job_id := new_job_id;
  out_status := 'queued'::public.simulation_job_status;
  out_created_at := job_created_at;
  out_retention_deadline := job_retention_deadline;
  out_room_geometry_mode := p_room_geometry_mode;
  out_storage_prefix := new_storage_prefix;
  return next;
end;
$$;

grant execute on function public.create_in_home_simulation_job_for_visitor(
  text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer
) to service_role;
