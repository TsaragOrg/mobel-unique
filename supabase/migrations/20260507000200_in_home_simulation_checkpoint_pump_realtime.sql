-- PLAN-0068 in-home simulation checkpoint pump and Realtime foundation.
--
-- This migration adds durable checkpoint state and a visitor-safe progress
-- projection. It does not refactor the worker yet; later PLAN-0068 slices
-- will move worker execution onto these checkpoint primitives.

do $$
begin
  create type public.simulation_checkpoint_key as enum (
    'room_validation',
    'room_cleaning',
    'room_corners',
    'dimension_guide',
    'awaiting_dimensions',
    'placement_generation',
    'placement_measurement',
    'placement_finalize',
    'completed',
    'failed',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.simulation_checkpoint_status as enum (
    'queued',
    'processing',
    'succeeded',
    'retrying',
    'failed',
    'canceled',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.in_home_simulation_jobs
  add column if not exists current_checkpoint public.simulation_checkpoint_key,
  add column if not exists current_checkpoint_status public.simulation_checkpoint_status,
  add column if not exists progress_step_key text,
  add column if not exists progress_step_ordinal integer,
  add column if not exists progress_total_steps integer,
  add column if not exists progress_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'in_home_simulation_jobs_progress_step_ordinal_positive'
  ) then
    alter table public.in_home_simulation_jobs
      add constraint in_home_simulation_jobs_progress_step_ordinal_positive
      check (progress_step_ordinal is null or progress_step_ordinal > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'in_home_simulation_jobs_progress_total_steps_positive'
  ) then
    alter table public.in_home_simulation_jobs
      add constraint in_home_simulation_jobs_progress_total_steps_positive
      check (progress_total_steps is null or progress_total_steps > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'in_home_simulation_jobs_progress_step_within_total'
  ) then
    alter table public.in_home_simulation_jobs
      add constraint in_home_simulation_jobs_progress_step_within_total
      check (
        progress_step_ordinal is null
        or progress_total_steps is null
        or progress_step_ordinal <= progress_total_steps
      );
  end if;
end $$;

create table if not exists public.in_home_simulation_checkpoints (
  id uuid primary key default gen_random_uuid(),
  in_home_simulation_job_id uuid not null references public.in_home_simulation_jobs (id) on delete cascade,
  checkpoint_key public.simulation_checkpoint_key not null,
  status public.simulation_checkpoint_status not null default 'queued',
  attempt_number integer not null default 1,
  max_attempts integer not null default 3,
  generation_index integer,
  claimed_by text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  retryable boolean,
  safe_error_code text,
  safe_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint in_home_simulation_checkpoints_attempt_number_positive
    check (attempt_number > 0),
  constraint in_home_simulation_checkpoints_max_attempts_positive
    check (max_attempts > 0),
  constraint in_home_simulation_checkpoints_attempt_number_within_max
    check (attempt_number <= max_attempts),
  constraint in_home_simulation_checkpoints_generation_index_range
    check (generation_index is null or generation_index in (0, 1, 2)),
  constraint in_home_simulation_checkpoints_processing_claim_required
    check (
      status <> 'processing'
      or (claimed_by is not null and claim_expires_at is not null)
    ),
  constraint in_home_simulation_checkpoints_safe_error_code_not_blank
    check (safe_error_code is null or length(btrim(safe_error_code)) > 0),
  constraint in_home_simulation_checkpoints_safe_error_message_not_blank
    check (safe_error_message is null or length(btrim(safe_error_message)) > 0)
);

create index if not exists in_home_simulation_checkpoints_job_idx
  on public.in_home_simulation_checkpoints (in_home_simulation_job_id);

create index if not exists in_home_simulation_checkpoints_claimable_idx
  on public.in_home_simulation_checkpoints (checkpoint_key, created_at, id)
  where status in ('queued', 'retrying');

create index if not exists in_home_simulation_checkpoints_claim_expires_idx
  on public.in_home_simulation_checkpoints (claim_expires_at)
  where status = 'processing';

create unique index if not exists in_home_simulation_checkpoints_active_unique_idx
  on public.in_home_simulation_checkpoints (
    in_home_simulation_job_id,
    checkpoint_key,
    coalesce(generation_index, -1)
  )
  where status in ('queued', 'processing', 'retrying');

drop trigger if exists set_updated_at_in_home_simulation_checkpoints
  on public.in_home_simulation_checkpoints;

create trigger set_updated_at_in_home_simulation_checkpoints
  before update on public.in_home_simulation_checkpoints
  for each row
  execute function public.set_updated_at();

create table if not exists public.simulation_public_progress (
  simulation_job_id uuid primary key references public.in_home_simulation_jobs (id) on delete cascade,
  simulation_session_id uuid not null references public.simulation_sessions (id) on delete cascade,
  status public.simulation_job_status not null,
  progress_step_key text,
  progress_step_ordinal integer,
  progress_total_steps integer,
  visitor_action_required boolean not null default false,
  guide_available boolean not null default false,
  latest_result_available boolean not null default false,
  regeneration_available boolean not null default false,
  retention_deadline timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint simulation_public_progress_progress_step_key_not_blank
    check (progress_step_key is null or length(btrim(progress_step_key)) > 0),
  constraint simulation_public_progress_progress_step_ordinal_positive
    check (progress_step_ordinal is null or progress_step_ordinal > 0),
  constraint simulation_public_progress_progress_total_steps_positive
    check (progress_total_steps is null or progress_total_steps > 0),
  constraint simulation_public_progress_progress_step_within_total
    check (
      progress_step_ordinal is null
      or progress_total_steps is null
      or progress_step_ordinal <= progress_total_steps
    )
);

create index if not exists simulation_public_progress_session_idx
  on public.simulation_public_progress (simulation_session_id);

drop trigger if exists set_updated_at_simulation_public_progress
  on public.simulation_public_progress;

create trigger set_updated_at_simulation_public_progress
  before update on public.simulation_public_progress
  for each row
  execute function public.set_updated_at();

alter table public.in_home_simulation_checkpoints
  enable row level security;

revoke all on table public.in_home_simulation_checkpoints
  from anon, authenticated;

grant all on table public.in_home_simulation_checkpoints
  to service_role;

drop policy if exists spec_0068_service_role_all_in_home_simulation_checkpoints
  on public.in_home_simulation_checkpoints;

create policy spec_0068_service_role_all_in_home_simulation_checkpoints
  on public.in_home_simulation_checkpoints
  for all
  to service_role
  using (true)
  with check (true);

alter table public.simulation_public_progress
  enable row level security;

revoke all on table public.simulation_public_progress
  from anon, authenticated;

grant all on table public.simulation_public_progress
  to service_role;

grant select on table public.simulation_public_progress
  to authenticated;

drop policy if exists spec_0068_service_role_all_simulation_public_progress
  on public.simulation_public_progress;

create policy spec_0068_service_role_all_simulation_public_progress
  on public.simulation_public_progress
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists spec_0068_simulation_public_progress_select_own
  on public.simulation_public_progress;

create policy spec_0068_simulation_public_progress_select_own
  on public.simulation_public_progress
  for select
  to authenticated
  using (
    simulation_job_id::text = coalesce(
      auth.jwt() -> 'simulation_progress' ->> 'simulation_job_id',
      ''
    )
    and simulation_session_id::text = coalesce(
      auth.jwt() -> 'simulation_progress' ->> 'simulation_session_id',
      ''
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'simulation_public_progress'
  ) then
    alter publication supabase_realtime add table public.simulation_public_progress;
  end if;
end $$;

create or replace function public.record_in_home_simulation_progress(
  p_simulation_job_id uuid,
  p_checkpoint_key public.simulation_checkpoint_key,
  p_checkpoint_status public.simulation_checkpoint_status,
  p_progress_step_key text,
  p_progress_step_ordinal integer,
  p_progress_total_steps integer,
  p_visitor_action_required boolean default false,
  p_guide_available boolean default false,
  p_latest_result_available boolean default false,
  p_regeneration_available boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_record record;
begin
  if p_simulation_job_id is null then
    raise exception 'p_simulation_job_id is required';
  end if;

  if p_progress_step_key is not null and length(btrim(p_progress_step_key)) = 0 then
    raise exception 'p_progress_step_key must not be blank';
  end if;

  if p_progress_step_ordinal is not null and p_progress_step_ordinal <= 0 then
    raise exception 'p_progress_step_ordinal must be positive';
  end if;

  if p_progress_total_steps is not null and p_progress_total_steps <= 0 then
    raise exception 'p_progress_total_steps must be positive';
  end if;

  if p_progress_step_ordinal is not null
    and p_progress_total_steps is not null
    and p_progress_step_ordinal > p_progress_total_steps
  then
    raise exception 'p_progress_step_ordinal cannot exceed p_progress_total_steps';
  end if;

  update public.in_home_simulation_jobs
  set
    current_checkpoint = p_checkpoint_key,
    current_checkpoint_status = p_checkpoint_status,
    progress_step_key = p_progress_step_key,
    progress_step_ordinal = p_progress_step_ordinal,
    progress_total_steps = p_progress_total_steps,
    progress_updated_at = now(),
    updated_at = now()
  where id = p_simulation_job_id
  returning
    id,
    simulation_session_id,
    status,
    retention_deadline
  into job_record;

  if job_record.id is null then
    raise exception 'in_home_simulation_jobs row not found for id %', p_simulation_job_id;
  end if;

  insert into public.simulation_public_progress (
    simulation_job_id,
    simulation_session_id,
    status,
    progress_step_key,
    progress_step_ordinal,
    progress_total_steps,
    visitor_action_required,
    guide_available,
    latest_result_available,
    regeneration_available,
    retention_deadline,
    updated_at
  )
  values (
    job_record.id,
    job_record.simulation_session_id,
    job_record.status,
    p_progress_step_key,
    p_progress_step_ordinal,
    p_progress_total_steps,
    coalesce(p_visitor_action_required, false),
    coalesce(p_guide_available, false),
    coalesce(p_latest_result_available, false),
    coalesce(p_regeneration_available, false),
    job_record.retention_deadline,
    now()
  )
  on conflict (simulation_job_id) do update
  set
    simulation_session_id = excluded.simulation_session_id,
    status = excluded.status,
    progress_step_key = excluded.progress_step_key,
    progress_step_ordinal = excluded.progress_step_ordinal,
    progress_total_steps = excluded.progress_total_steps,
    visitor_action_required = excluded.visitor_action_required,
    guide_available = excluded.guide_available,
    latest_result_available = excluded.latest_result_available,
    regeneration_available = excluded.regeneration_available,
    retention_deadline = excluded.retention_deadline,
    updated_at = now();

  return jsonb_build_object(
    'status', 'recorded',
    'simulation_job_id', job_record.id,
    'checkpoint_key', p_checkpoint_key,
    'checkpoint_status', p_checkpoint_status
  );
end;
$$;

grant execute on function public.record_in_home_simulation_progress(
  uuid,
  public.simulation_checkpoint_key,
  public.simulation_checkpoint_status,
  text,
  integer,
  integer,
  boolean,
  boolean,
  boolean,
  boolean
) to service_role;
