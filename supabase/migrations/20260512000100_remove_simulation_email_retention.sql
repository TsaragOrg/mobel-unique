-- SPEC-0015 PLAN-0081 remove public simulation email retention.
--
-- Email remains part of the public OTP provider request, but application-owned
-- tables must not retain readable or encrypted email values. The application
-- keeps only a short-lived server-HMAC subject for request binding and the
-- 24-hour anti-abuse window.

alter table public.email_verification_requests
  add column if not exists verification_subject_hash text;

alter table public.simulation_sessions
  add column if not exists verification_subject_hash text;

alter table public.email_verification_requests
  alter column email_normalized_hash drop not null;

alter table public.simulation_sessions
  alter column email_normalized_hash drop not null,
  alter column required_email_consent_record_id drop not null;

create index if not exists email_verification_requests_subject_hash_idx
  on public.email_verification_requests (verification_subject_hash)
  where verification_subject_hash is not null;

create index if not exists simulation_sessions_subject_hash_idx
  on public.simulation_sessions (verification_subject_hash)
  where verification_subject_hash is not null;

update public.simulation_sessions
set
  optional_commercial_consent_record_id = null,
  updated_at = now()
where optional_commercial_consent_record_id is not null;

delete from public.consent_records
where consent_type = 'commercial_contact_optional'
  and source = 'public-simulation-email-gate';

update public.consent_records
set email_normalized_hash = null
where email_normalized_hash is not null;

update public.email_verification_requests
set
  email_address_encrypted = null,
  email_normalized_hash = null,
  email_purged_at = coalesce(email_purged_at, now()),
  updated_at = now()
where email_address_encrypted is not null
   or email_normalized_hash is not null;

update public.simulation_sessions
set
  email_normalized_hash = null,
  status = case
    when status = 'active' and expires_at <= now() then 'expired'
    else status
  end,
  updated_at = now()
where email_normalized_hash is not null
   or (status = 'active' and expires_at <= now());

delete from public.simulation_rate_limits
where subject_kind = 'email';

alter table public.simulation_rate_limits
  drop constraint if exists simulation_rate_limits_subject_kind_check;

alter table public.simulation_rate_limits
  add constraint simulation_rate_limits_subject_kind_check
  check (subject_kind in ('ip', 'verification_subject'));

create or replace function public.increment_simulation_rate_limit(
  p_subject_kind text,
  p_subject_value_hash text,
  p_window_start timestamptz,
  p_cap integer
)
returns table (
  count integer,
  allowed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if p_subject_kind is null
    or p_subject_kind not in ('ip', 'verification_subject') then
    raise exception 'p_subject_kind must be ip or verification_subject';
  end if;

  if p_subject_value_hash is null
    or length(btrim(p_subject_value_hash)) = 0 then
    raise exception 'p_subject_value_hash is required';
  end if;

  if p_window_start is null then
    raise exception 'p_window_start is required';
  end if;

  if p_cap is null or p_cap <= 0 then
    raise exception 'p_cap must be positive';
  end if;

  insert into public.simulation_rate_limits as srl (
    subject_kind, subject_value_hash, window_start, count
  )
  values (p_subject_kind, p_subject_value_hash, p_window_start, 1)
  on conflict (subject_kind, subject_value_hash, window_start)
  do update set
    count = srl.count + 1,
    updated_at = now()
  returning srl.count into new_count;

  return query select new_count, new_count <= p_cap;
end;
$$;

grant execute on function public.increment_simulation_rate_limit(
  text, text, timestamptz, integer
) to service_role;

drop function if exists public.create_public_simulation_email_verification_request(
  text,
  text,
  text,
  text,
  public.consent_decision,
  text,
  text,
  timestamptz
);

create or replace function public.create_public_simulation_email_verification_request(
  p_verification_subject_hash text,
  p_expires_at timestamptz
)
returns table (
  out_verification_request_id uuid,
  out_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_request_id uuid;
begin
  if p_verification_subject_hash is null
    or length(btrim(p_verification_subject_hash)) = 0 then
    raise exception 'p_verification_subject_hash is required';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'p_expires_at must be in the future';
  end if;

  insert into public.email_verification_requests (
    email_address_encrypted,
    email_normalized_hash,
    verification_subject_hash,
    verification_code_hash,
    status,
    send_count,
    expires_at,
    last_sent_at
  )
  values (
    null,
    null,
    p_verification_subject_hash,
    null,
    'code_sent',
    1,
    p_expires_at,
    now()
  )
  returning id into new_request_id;

  out_verification_request_id := new_request_id;
  out_expires_at := p_expires_at;
  return next;
end;
$$;

grant execute on function public.create_public_simulation_email_verification_request(
  text,
  timestamptz
) to service_role;

drop function if exists public.verify_public_simulation_auth_otp_session(
  uuid,
  uuid,
  text,
  timestamptz
);

create or replace function public.verify_public_simulation_auth_otp_session(
  p_verification_request_id uuid,
  p_auth_user_id uuid,
  p_verification_subject_hash text,
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
  session_id uuid;
begin
  if p_verification_request_id is null then
    raise exception 'p_verification_request_id is required';
  end if;

  if p_auth_user_id is null then
    raise exception 'p_auth_user_id is required';
  end if;

  if p_verification_subject_hash is null
    or length(btrim(p_verification_subject_hash)) = 0 then
    raise exception 'p_verification_subject_hash is required';
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

  if request_row.verification_subject_hash is distinct from
    p_verification_subject_hash then
    raise exception 'email verification request subject mismatch';
  end if;

  update public.email_verification_requests
  set
    auth_user_id = p_auth_user_id,
    email_address_encrypted = null,
    email_normalized_hash = null,
    status = 'verified',
    verified_at = coalesce(verified_at, now()),
    email_purged_at = coalesce(email_purged_at, now()),
    updated_at = now()
  where id = p_verification_request_id;

  insert into public.simulation_sessions (
    email_verification_request_id,
    auth_user_id,
    email_normalized_hash,
    verification_subject_hash,
    required_email_consent_record_id,
    optional_commercial_consent_record_id,
    access_token_hash,
    status,
    expires_at
  )
  values (
    p_verification_request_id,
    p_auth_user_id,
    null,
    p_verification_subject_hash,
    null,
    null,
    p_access_token_hash,
    'active',
    p_session_expires_at
  )
  on conflict (access_token_hash) do update
  set
    auth_user_id = excluded.auth_user_id,
    email_verification_request_id = excluded.email_verification_request_id,
    email_normalized_hash = null,
    verification_subject_hash = excluded.verification_subject_hash,
    required_email_consent_record_id = null,
    optional_commercial_consent_record_id = null,
    status = 'active',
    expires_at = excluded.expires_at,
    updated_at = now()
  returning id into session_id;

  out_simulation_session_id := session_id;
  return next;
end;
$$;

grant execute on function public.verify_public_simulation_auth_otp_session(
  uuid,
  uuid,
  text,
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
    where (
        evr.email_address_encrypted is not null
        or evr.email_normalized_hash is not null
        or evr.verification_subject_hash is not null
      )
      and evr.created_at < now() - interval '24 hours'
    order by evr.created_at asc
    limit p_batch_size
    for update skip locked
  ),
  updated_requests as (
    update public.email_verification_requests evr
    set
      email_address_encrypted = null,
      email_normalized_hash = null,
      verification_subject_hash = null,
      email_purged_at = coalesce(email_purged_at, now()),
      updated_at = now()
    from eligible
    where evr.id = eligible.id
    returning evr.id
  ),
  updated_sessions as (
    update public.simulation_sessions s
    set
      email_normalized_hash = null,
      verification_subject_hash = null,
      auth_user_id = case
        when s.expires_at <= now() then null
        else s.auth_user_id
      end,
      status = case
        when s.status = 'active' and s.expires_at <= now() then 'expired'
        else s.status
      end,
      updated_at = now()
    from eligible
    where s.email_verification_request_id = eligible.id
    returning s.id
  ),
  auth_cleanup_candidates as (
    select distinct eligible.auth_user_id
    from eligible
    where eligible.auth_user_id is not null
      and not exists (
        select 1
        from public.simulation_sessions active_session
        where active_session.auth_user_id = eligible.auth_user_id
          and active_session.status = 'active'
          and active_session.expires_at > now()
      )
  )
  select
    eligible.id,
    case
      when eligible.auth_user_id in (
        select auth_cleanup_candidates.auth_user_id
        from auth_cleanup_candidates
      ) then eligible.auth_user_id
      else null
    end
  from eligible
  where exists (
    select 1 from updated_requests where updated_requests.id = eligible.id
  );
end;
$$;

grant execute on function public.purge_public_simulation_email_handoffs(
  integer
) to service_role;

drop function if exists public.record_simulation_lead_for_job(uuid);
drop function if exists public.admin_list_simulation_leads(
  timestamptz, timestamptz, text, text, integer, timestamptz, uuid
);
drop function if exists public.admin_list_simulation_lead_jobs(
  uuid, timestamptz, timestamptz
);
drop function if exists public.admin_delete_simulation_lead_identity(
  uuid, text, text
);

drop table if exists public.simulation_lead_jobs;
drop table if exists public.simulation_leads;

create or replace function public.create_in_home_simulation_job_for_visitor_dispatch_outbox(
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
begin
  return query
  select *
  from public.create_in_home_simulation_job_for_visitor_checkpoint_pump(
    p_verification_request_id,
    p_sofa_slug,
    p_fabric_id,
    p_visual_position_id,
    p_customer_room_original_path,
    p_room_geometry_mode,
    p_job_id_override,
    p_retention_hours
  );
end;
$$;

grant execute on function public.create_in_home_simulation_job_for_visitor_dispatch_outbox(
  text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer
) to service_role;
