-- SPEC-0007 PLAN-0010 / PLAN-0011 column disambiguation fix.
--
-- The Stage 1 and Stage 2 claim functions return a row whose column
-- names (`retention_deadline`, `room_prep_attempt_count`,
-- `placement_attempt_count`, `max_attempts_per_stage`) collide with
-- columns of the `in_home_simulation_jobs` table. Postgres surfaces
-- this in newer PG versions as
-- `column reference "retention_deadline" is ambiguous`. The functions
-- below replace the originals with table-qualified column references
-- so the planner unambiguously picks the table column for filters.
--
-- The behavior is otherwise identical: same parameters, same return
-- shape, same status transitions and counter increments.

create or replace function public.claim_in_home_simulation_room_prep_job(
  worker_identifier text,
  claim_ttl_seconds integer default 600
)
returns table (
  job_id uuid,
  storage_prefix text,
  customer_room_original_path text,
  retention_deadline timestamptz,
  room_prep_attempt_count integer,
  max_attempts_per_stage integer,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate_id uuid;
  ttl_interval interval;
  new_claim_expires_at timestamptz;
  claimed_storage_prefix text;
  claimed_customer_room_original_path text;
  claimed_retention_deadline timestamptz;
  claimed_room_prep_attempt_count integer;
  claimed_max_attempts_per_stage integer;
begin
  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if claim_ttl_seconds is null or claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be a positive integer';
  end if;

  ttl_interval := make_interval(secs => claim_ttl_seconds);

  select j.id
  into candidate_id
  from public.in_home_simulation_jobs j
  where j.status = 'queued'
    and j.retention_deadline > now()
    and j.room_prep_attempt_count < j.max_attempts_per_stage
  order by j.queued_at nulls last, j.created_at
  for update skip locked
  limit 1;

  if candidate_id is null then
    return;
  end if;

  new_claim_expires_at := now() + ttl_interval;

  update public.in_home_simulation_jobs j
  set
    status = 'room_prep_processing',
    room_prep_attempt_count = j.room_prep_attempt_count + 1,
    claimed_by = worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    room_prep_started_at = coalesce(j.room_prep_started_at, now()),
    updated_at = now()
  where j.id = candidate_id
  returning
    j.storage_prefix,
    j.customer_room_original_path,
    j.retention_deadline,
    j.room_prep_attempt_count,
    j.max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_customer_room_original_path,
    claimed_retention_deadline,
    claimed_room_prep_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  customer_room_original_path := claimed_customer_room_original_path;
  retention_deadline := claimed_retention_deadline;
  room_prep_attempt_count := claimed_room_prep_attempt_count;
  max_attempts_per_stage := claimed_max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;

create or replace function public.claim_specific_in_home_simulation_room_prep_job(
  target_job_id uuid,
  worker_identifier text,
  claim_ttl_seconds integer default 600
)
returns table (
  job_id uuid,
  storage_prefix text,
  customer_room_original_path text,
  retention_deadline timestamptz,
  room_prep_attempt_count integer,
  max_attempts_per_stage integer,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate_id uuid;
  ttl_interval interval;
  new_claim_expires_at timestamptz;
  claimed_storage_prefix text;
  claimed_customer_room_original_path text;
  claimed_retention_deadline timestamptz;
  claimed_room_prep_attempt_count integer;
  claimed_max_attempts_per_stage integer;
begin
  if target_job_id is null then
    raise exception 'job_id is required';
  end if;

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if claim_ttl_seconds is null or claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be a positive integer';
  end if;

  ttl_interval := make_interval(secs => claim_ttl_seconds);

  select j.id
  into candidate_id
  from public.in_home_simulation_jobs j
  where j.id = target_job_id
    and j.status = 'queued'
    and j.retention_deadline > now()
    and j.room_prep_attempt_count < j.max_attempts_per_stage
  for update skip locked
  limit 1;

  if candidate_id is null then
    return;
  end if;

  new_claim_expires_at := now() + ttl_interval;

  update public.in_home_simulation_jobs j
  set
    status = 'room_prep_processing',
    room_prep_attempt_count = j.room_prep_attempt_count + 1,
    claimed_by = worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    room_prep_started_at = coalesce(j.room_prep_started_at, now()),
    updated_at = now()
  where j.id = candidate_id
  returning
    j.storage_prefix,
    j.customer_room_original_path,
    j.retention_deadline,
    j.room_prep_attempt_count,
    j.max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_customer_room_original_path,
    claimed_retention_deadline,
    claimed_room_prep_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  customer_room_original_path := claimed_customer_room_original_path;
  retention_deadline := claimed_retention_deadline;
  room_prep_attempt_count := claimed_room_prep_attempt_count;
  max_attempts_per_stage := claimed_max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;

create or replace function public.claim_specific_in_home_simulation_placement_job(
  target_job_id uuid,
  worker_identifier text,
  claim_ttl_seconds integer default 600
)
returns table (
  job_id uuid,
  storage_prefix text,
  room_cleaned_path text,
  room_geometry_mode public.room_geometry_mode,
  room_geometry_points jsonb,
  supplied_dimensions jsonb,
  prepared_sofa_asset_id uuid,
  prepared_sofa_path text,
  reserved_generation_index integer,
  generated_output_count integer,
  retention_deadline timestamptz,
  placement_attempt_count integer,
  max_attempts_per_stage integer,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate_id uuid;
  ttl_interval interval;
  new_claim_expires_at timestamptz;
  claimed_storage_prefix text;
  claimed_room_cleaned_path text;
  claimed_room_geometry_mode public.room_geometry_mode;
  claimed_room_geometry_points jsonb;
  claimed_supplied_dimensions jsonb;
  claimed_prepared_sofa_asset_id uuid;
  claimed_prepared_sofa_path text;
  claimed_reserved_generation_index integer;
  claimed_generated_output_count integer;
  claimed_retention_deadline timestamptz;
  claimed_placement_attempt_count integer;
  claimed_max_attempts_per_stage integer;
begin
  if target_job_id is null then
    raise exception 'job_id is required';
  end if;

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if claim_ttl_seconds is null or claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be a positive integer';
  end if;

  ttl_interval := make_interval(secs => claim_ttl_seconds);

  select j.id
  into candidate_id
  from public.in_home_simulation_jobs j
  where j.id = target_job_id
    and j.status = 'placement_queued'
    and j.retention_deadline > now()
    and j.placement_attempt_count < j.max_attempts_per_stage
  for update skip locked
  limit 1;

  if candidate_id is null then
    return;
  end if;

  new_claim_expires_at := now() + ttl_interval;

  update public.in_home_simulation_jobs j
  set
    status = 'placement_processing',
    placement_attempt_count = j.placement_attempt_count + 1,
    claimed_by = worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    placement_started_at = coalesce(j.placement_started_at, now()),
    updated_at = now()
  where j.id = candidate_id
  returning
    j.storage_prefix,
    j.room_cleaned_path,
    j.room_geometry_mode,
    j.room_geometry_points,
    j.supplied_dimensions,
    j.prepared_sofa_asset_id,
    j.prepared_sofa_path,
    j.reserved_generation_index,
    j.generated_output_count,
    j.retention_deadline,
    j.placement_attempt_count,
    j.max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_room_cleaned_path,
    claimed_room_geometry_mode,
    claimed_room_geometry_points,
    claimed_supplied_dimensions,
    claimed_prepared_sofa_asset_id,
    claimed_prepared_sofa_path,
    claimed_reserved_generation_index,
    claimed_generated_output_count,
    claimed_retention_deadline,
    claimed_placement_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  room_cleaned_path := claimed_room_cleaned_path;
  room_geometry_mode := claimed_room_geometry_mode;
  room_geometry_points := claimed_room_geometry_points;
  supplied_dimensions := claimed_supplied_dimensions;
  prepared_sofa_asset_id := claimed_prepared_sofa_asset_id;
  prepared_sofa_path := claimed_prepared_sofa_path;
  reserved_generation_index := claimed_reserved_generation_index;
  generated_output_count := claimed_generated_output_count;
  retention_deadline := claimed_retention_deadline;
  placement_attempt_count := claimed_placement_attempt_count;
  max_attempts_per_stage := claimed_max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;
