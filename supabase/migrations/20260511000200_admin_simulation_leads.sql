-- SPEC-0020 PLAN-0080: retained admin simulation leads.
--
-- Lead records are created only after a public simulation job exists and the
-- visitor granted both the required simulation email consent and the optional
-- commercial contact consent. The browser must use first-party admin APIs; the
-- database surface below is service-role-only.

alter table public.email_verification_requests
  alter column email_normalized_hash drop not null;

alter table public.simulation_sessions
  alter column email_normalized_hash drop not null;

create table if not exists public.simulation_leads (
  id uuid primary key default gen_random_uuid(),
  email_address_encrypted text not null,
  email_normalized_hash text not null unique,
  first_simulation_at timestamptz not null,
  last_simulation_at timestamptz not null,
  job_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_leads_email_encrypted_not_blank check (
    length(btrim(email_address_encrypted)) > 0
  ),
  constraint simulation_leads_email_hash_not_blank check (
    length(btrim(email_normalized_hash)) > 0
  ),
  constraint simulation_leads_job_count_non_negative check (job_count >= 0),
  constraint simulation_leads_simulation_dates_order check (
    first_simulation_at <= last_simulation_at
  )
);

create table if not exists public.simulation_lead_jobs (
  id uuid primary key default gen_random_uuid(),
  simulation_lead_id uuid not null references public.simulation_leads (id) on delete cascade,
  in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs (id) on delete restrict,
  selected_sofa_id uuid not null references public.sofas (id) on delete restrict,
  selected_fabric_id uuid not null references public.fabrics (id) on delete restrict,
  selected_visual_matrix_column_id uuid not null references public.visual_matrix_columns (id) on delete restrict,
  prepared_render_cell_id uuid references public.sofa_render_cells (id) on delete set null,
  prepared_sofa_asset_id uuid references public.storage_assets (id) on delete set null,
  sofa_public_name_snapshot text not null,
  fabric_public_name_snapshot text not null,
  visual_position_label_snapshot text,
  simulation_status_snapshot text not null,
  simulation_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint simulation_lead_jobs_source_job_unique unique (in_home_simulation_job_id),
  constraint simulation_lead_jobs_sofa_snapshot_not_blank check (
    length(btrim(sofa_public_name_snapshot)) > 0
  ),
  constraint simulation_lead_jobs_fabric_snapshot_not_blank check (
    length(btrim(fabric_public_name_snapshot)) > 0
  ),
  constraint simulation_lead_jobs_visual_snapshot_not_blank check (
    visual_position_label_snapshot is null
    or length(btrim(visual_position_label_snapshot)) > 0
  ),
  constraint simulation_lead_jobs_status_snapshot_not_blank check (
    length(btrim(simulation_status_snapshot)) > 0
  )
);

create index if not exists simulation_lead_jobs_lead_created_desc_idx
  on public.simulation_lead_jobs (simulation_lead_id, simulation_created_at desc);

create index if not exists simulation_lead_jobs_created_at_idx
  on public.simulation_lead_jobs (simulation_created_at);

alter table public.simulation_leads
  enable row level security;

alter table public.simulation_lead_jobs
  enable row level security;

revoke all on table public.simulation_leads
  from anon, authenticated;

revoke all on table public.simulation_lead_jobs
  from anon, authenticated;

grant all on table public.simulation_leads
  to service_role;

grant all on table public.simulation_lead_jobs
  to service_role;

drop policy if exists spec_0020_service_role_all_simulation_leads
  on public.simulation_leads;

create policy spec_0020_service_role_all_simulation_leads
  on public.simulation_leads
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists spec_0020_service_role_all_simulation_lead_jobs
  on public.simulation_lead_jobs;

create policy spec_0020_service_role_all_simulation_lead_jobs
  on public.simulation_lead_jobs
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.record_simulation_lead_for_job(
  p_in_home_simulation_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  source_job record;
  created_lead_id uuid;
begin
  if p_in_home_simulation_job_id is null then
    return;
  end if;

  select
    j.id as in_home_simulation_job_id,
    j.selected_sofa_id,
    j.selected_fabric_id,
    j.selected_visual_matrix_column_id,
    j.prepared_render_cell_id,
    j.prepared_sofa_asset_id,
    j.status,
    j.created_at as simulation_created_at,
    s.id as simulation_session_id,
    evr.email_address_encrypted,
    evr.email_normalized_hash,
    sofa.public_name as sofa_public_name,
    fabric.public_name as fabric_public_name,
    coalesce(vmc.public_label, vmc.admin_label) as visual_position_label
  into source_job
  from public.in_home_simulation_jobs j
  join public.simulation_sessions s
    on s.id = j.simulation_session_id
    and s.status = 'active'
    and s.expires_at > now()
  join public.email_verification_requests evr
    on evr.id = s.email_verification_request_id
  join public.consent_records required_consent
    on required_consent.id = s.required_email_consent_record_id
    and required_consent.consent_type = 'email_verification_required'
    and required_consent.decision = 'granted'
    and required_consent.revoked_at is null
    and required_consent.simulation_session_id = s.id
  join public.consent_records optional_consent
    on optional_consent.id = s.optional_commercial_consent_record_id
    and optional_consent.consent_type = 'commercial_contact_optional'
    and optional_consent.decision = 'granted'
    and optional_consent.revoked_at is null
    and optional_consent.simulation_session_id = s.id
  join public.sofas sofa
    on sofa.id = j.selected_sofa_id
  join public.fabrics fabric
    on fabric.id = j.selected_fabric_id
  join public.visual_matrix_columns vmc
    on vmc.id = j.selected_visual_matrix_column_id
  where j.id = p_in_home_simulation_job_id
  for update of j, s, evr, required_consent, optional_consent;

  if not found then
    return;
  end if;

  if source_job.email_address_encrypted is null
    or length(btrim(source_job.email_address_encrypted)) = 0
    or source_job.email_normalized_hash is null
    or length(btrim(source_job.email_normalized_hash)) = 0 then
    return;
  end if;

  insert into public.simulation_leads as lead (
    email_address_encrypted,
    email_normalized_hash,
    first_simulation_at,
    last_simulation_at,
    job_count,
    created_at,
    updated_at
  )
  values (
    source_job.email_address_encrypted,
    source_job.email_normalized_hash,
    source_job.simulation_created_at,
    source_job.simulation_created_at,
    0,
    now(),
    now()
  )
  on conflict (email_normalized_hash) do update
  set
    email_address_encrypted = excluded.email_address_encrypted,
    first_simulation_at = least(lead.first_simulation_at, excluded.first_simulation_at),
    last_simulation_at = greatest(lead.last_simulation_at, excluded.last_simulation_at),
    updated_at = now()
  returning id into created_lead_id;

  insert into public.simulation_lead_jobs (
    simulation_lead_id,
    in_home_simulation_job_id,
    selected_sofa_id,
    selected_fabric_id,
    selected_visual_matrix_column_id,
    prepared_render_cell_id,
    prepared_sofa_asset_id,
    sofa_public_name_snapshot,
    fabric_public_name_snapshot,
    visual_position_label_snapshot,
    simulation_status_snapshot,
    simulation_created_at
  )
  values (
    created_lead_id,
    source_job.in_home_simulation_job_id,
    source_job.selected_sofa_id,
    source_job.selected_fabric_id,
    source_job.selected_visual_matrix_column_id,
    source_job.prepared_render_cell_id,
    source_job.prepared_sofa_asset_id,
    coalesce(source_job.sofa_public_name, 'Archived sofa'),
    source_job.fabric_public_name,
    source_job.visual_position_label,
    source_job.status::text,
    source_job.simulation_created_at
  )
  on conflict (in_home_simulation_job_id) do nothing;

  update public.simulation_leads lead
  set
    first_simulation_at = aggregate_jobs.first_simulation_at,
    last_simulation_at = aggregate_jobs.last_simulation_at,
    job_count = aggregate_jobs.job_count,
    updated_at = now()
  from (
    select
      simulation_lead_id,
      min(simulation_created_at) as first_simulation_at,
      max(simulation_created_at) as last_simulation_at,
      count(*)::integer as job_count
    from public.simulation_lead_jobs
    where simulation_lead_id = created_lead_id
    group by simulation_lead_id
  ) aggregate_jobs
  where lead.id = aggregate_jobs.simulation_lead_id;
end;
$$;

grant execute on function public.record_simulation_lead_for_job(uuid)
  to service_role;

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
declare
  created_job record;
begin
  for created_job in
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
    )
  loop
    perform public.record_simulation_lead_for_job(created_job.out_job_id);

    out_job_id := created_job.out_job_id;
    out_status := created_job.out_status;
    out_created_at := created_job.out_created_at;
    out_retention_deadline := created_job.out_retention_deadline;
    out_room_geometry_mode := created_job.out_room_geometry_mode;
    out_storage_prefix := created_job.out_storage_prefix;
    return next;
  end loop;
end;
$$;

grant execute on function public.create_in_home_simulation_job_for_visitor_dispatch_outbox(
  text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer
) to service_role;

create or replace function public.admin_list_simulation_leads(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_email_normalized_hash text default null,
  p_sort text default 'newest',
  p_limit integer default 50,
  p_cursor_last_simulation_at timestamptz default null,
  p_cursor_lead_id uuid default null
)
returns table (
  out_lead_id uuid,
  out_email_address_encrypted text,
  out_last_simulation_at timestamptz,
  out_matching_job_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_sort is null or p_sort not in ('newest', 'oldest') then
    raise exception 'invalid lead sort';
  end if;

  return query
  with matching_leads as (
    select
      l.id as lead_id,
      l.email_address_encrypted,
      l.email_normalized_hash,
      max(lj.simulation_created_at) as latest_matching_simulation_at,
      count(lj.id)::integer as matching_job_count
    from public.simulation_leads l
    join public.simulation_lead_jobs lj
      on lj.simulation_lead_id = l.id
    where (p_from is null or lj.simulation_created_at >= p_from)
      and (p_to is null or lj.simulation_created_at < p_to)
      and (
        p_email_normalized_hash is null
        or l.email_normalized_hash = p_email_normalized_hash
      )
    group by l.id, l.email_address_encrypted, l.email_normalized_hash
  ),
  paged_leads as (
    select *
    from matching_leads
    where p_cursor_last_simulation_at is null
      or p_cursor_lead_id is null
      or (
        p_sort = 'newest'
        and (
          latest_matching_simulation_at < p_cursor_last_simulation_at
          or (
            latest_matching_simulation_at = p_cursor_last_simulation_at
            and lead_id > p_cursor_lead_id
          )
        )
      )
      or (
        p_sort = 'oldest'
        and (
          latest_matching_simulation_at > p_cursor_last_simulation_at
          or (
            latest_matching_simulation_at = p_cursor_last_simulation_at
            and lead_id > p_cursor_lead_id
          )
        )
      )
    order by
      case when p_sort = 'oldest' then latest_matching_simulation_at end asc,
      case when p_sort = 'newest' then latest_matching_simulation_at end desc,
      lead_id asc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select
    lead_id,
    email_address_encrypted,
    latest_matching_simulation_at,
    matching_job_count
  from paged_leads;
end;
$$;

grant execute on function public.admin_list_simulation_leads(
  timestamptz, timestamptz, text, text, integer, timestamptz, uuid
) to service_role;

create or replace function public.admin_list_simulation_lead_jobs(
  p_lead_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  out_prepared_render_cell_id uuid,
  out_prepared_sofa_asset_id uuid,
  out_sofa_name text,
  out_fabric_name text,
  out_visual_position_label text,
  out_simulation_date timestamptz,
  out_status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    prepared_render_cell_id,
    prepared_sofa_asset_id,
    sofa_public_name_snapshot,
    fabric_public_name_snapshot,
    visual_position_label_snapshot,
    simulation_created_at,
    simulation_status_snapshot
  from public.simulation_lead_jobs
  where simulation_lead_id = p_lead_id
    and (p_from is null or simulation_created_at >= p_from)
    and (p_to is null or simulation_created_at < p_to)
  order by simulation_created_at desc, id asc;
end;
$$;

grant execute on function public.admin_list_simulation_lead_jobs(
  uuid, timestamptz, timestamptz
) to service_role;

create or replace function public.admin_delete_simulation_lead_identity(
  p_lead_id uuid,
  p_email_normalized_hash text,
  p_rate_limit_subject_hash text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  locked_lead record;
  lead_email_hash text;
begin
  if p_lead_id is null then
    return;
  end if;

  select
    id,
    email_normalized_hash
  into locked_lead
  from public.simulation_leads
  where id = p_lead_id
    and (
      p_email_normalized_hash is null
      or email_normalized_hash = p_email_normalized_hash
    )
  for update;

  if locked_lead.id is null then
    return;
  end if;

  lead_email_hash := locked_lead.email_normalized_hash;

  update public.email_verification_requests
  set
    email_address_encrypted = null,
    email_normalized_hash = null,
    updated_at = now()
  where email_normalized_hash = lead_email_hash;

  update public.simulation_sessions
  set
    email_normalized_hash = null,
    status = 'revoked',
    expires_at = least(expires_at, now()),
    updated_at = now()
  where email_normalized_hash = lead_email_hash;

  update public.consent_records
  set email_normalized_hash = null
  where email_normalized_hash = lead_email_hash;

  if p_rate_limit_subject_hash is not null
    and length(btrim(p_rate_limit_subject_hash)) > 0 then
    delete from public.simulation_rate_limits
    where subject_kind = 'email'
      and subject_value_hash = p_rate_limit_subject_hash;
  end if;

  delete from public.simulation_lead_jobs
  where simulation_lead_id = locked_lead.id;

  delete from public.simulation_leads
  where id = locked_lead.id;
end;
$$;

grant execute on function public.admin_delete_simulation_lead_identity(
  uuid, text, text
) to service_role;
