-- SPEC-0015 PLAN-0040 production create-job RPC for the public
-- simulation API.
--
-- The launch-window stub access token carries a `verification_request_id`.
-- The first time a visitor with that token uploads a room photo, the
-- API calls this function to atomically:
--
--   1. resolve the (sofa_slug, fabric_id, visual_position_id) triple
--      against `public.sofa_render_cells` and confirm the underlying
--      sofa is published and the cell carries both private and public
--      render assets (a "publishable" cell);
--   2. derive deterministic `email_normalized_hash` and
--      `access_token_hash` values from the verification_request_id so
--      the same token always maps to the same identity rows;
--   3. get-or-create the matching `email_verification_requests`,
--      `consent_records`, and `simulation_sessions` rows so the
--      session-bound `in_home_simulation_jobs.simulation_session_id`
--      foreign key is satisfied without persisting any real visitor
--      identity (real email verification ships later);
--   4. insert the `in_home_simulation_jobs` row in `queued` status
--      with the correct storage prefix, the supplied
--      `room_geometry_mode`, and the requested retention window;
--   5. bump the session's `initial_job_count` for the operational
--      overview.
--
-- The function returns zero rows when the triple is not publishable
-- so the caller can map that to a safe validation error without
-- depending on exception handling. It returns exactly one row on
-- success.
--
-- The function does not enqueue the pgmq message. The caller is
-- expected to call `enqueue_in_home_simulation_room_prep_message`
-- after this function succeeds; splitting the two keeps the database
-- transaction boundary tight.

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
  email_hash text;
  derived_access_token_hash text;
  email_verification_id uuid;
  consent_id uuid;
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

  email_hash := encode(
    extensions.digest('email:' || p_verification_request_id, 'sha256'),
    'hex'
  );
  derived_access_token_hash := encode(
    extensions.digest('access_token:' || p_verification_request_id, 'sha256'),
    'hex'
  );

  select id into email_verification_id
  from public.email_verification_requests
  where email_normalized_hash = email_hash
  order by created_at desc
  limit 1;

  if email_verification_id is null then
    insert into public.email_verification_requests (
      email_normalized_hash,
      verification_code_hash,
      status,
      expires_at,
      verified_at
    )
    values (
      email_hash,
      encode(
        extensions.digest(
          'verification_code:' || p_verification_request_id,
          'sha256'
        ),
        'hex'
      ),
      'verified',
      now() + interval '24 hours',
      now()
    )
    returning id into email_verification_id;
  end if;

  select id into consent_id
  from public.consent_records
  where email_normalized_hash = email_hash
    and consent_type = 'email_verification_required'
    and decision = 'granted'
  order by created_at desc
  limit 1;

  if consent_id is null then
    insert into public.consent_records (
      consent_type,
      decision,
      email_normalized_hash,
      wording_version,
      locale,
      source,
      decided_at
    )
    values (
      'email_verification_required',
      'granted',
      email_hash,
      'v1',
      'fr-FR',
      'public-simulation-wizard',
      now()
    )
    returning id into consent_id;
  end if;

  insert into public.simulation_sessions (
    email_verification_request_id,
    email_normalized_hash,
    required_email_consent_record_id,
    access_token_hash,
    status,
    expires_at
  )
  values (
    email_verification_id,
    email_hash,
    consent_id,
    derived_access_token_hash,
    'active',
    now() + interval '24 hours'
  )
  on conflict (access_token_hash) do nothing
  returning id into session_id;

  if session_id is null then
    select id into session_id
    from public.simulation_sessions
    where access_token_hash = derived_access_token_hash;
  end if;

  update public.consent_records
  set simulation_session_id = session_id
  where id = consent_id and simulation_session_id is null;

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
