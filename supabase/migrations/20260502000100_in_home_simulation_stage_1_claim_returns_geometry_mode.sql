-- SPEC-0015 PLAN-0038: Stage 1 claim returns room_geometry_mode.
--
-- After SPEC-0015 the in-home simulation worker drops the scene
-- classifier sub-step. `room_geometry_mode` is now authoritative on
-- the job row at job creation (set by the API based on sofa tags;
-- see PLAN-0040). For the worker to read it without an extra round
-- trip, the room-prep claim RPCs must surface the column.
--
-- Both Stage 1 claim functions are updated to return
-- `room_geometry_mode`. The value is coalesced to 'back_wall' as a
-- safety net so legacy / test-script jobs that pre-date PLAN-0040
-- still produce a usable mode for the corners step. Once every
-- producer of `in_home_simulation_jobs` rows sets the column
-- explicitly, the coalesce becomes a no-op.

create or replace function public.claim_in_home_simulation_room_prep_job(
  worker_identifier text,
  claim_ttl_seconds integer default 600
)
returns table (
  job_id uuid,
  storage_prefix text,
  customer_room_original_path text,
  room_geometry_mode public.room_geometry_mode,
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
  claimed_room_geometry_mode public.room_geometry_mode;
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
    coalesce(j.room_geometry_mode, 'back_wall'::public.room_geometry_mode),
    j.retention_deadline,
    j.room_prep_attempt_count,
    j.max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_customer_room_original_path,
    claimed_room_geometry_mode,
    claimed_retention_deadline,
    claimed_room_prep_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  customer_room_original_path := claimed_customer_room_original_path;
  room_geometry_mode := claimed_room_geometry_mode;
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
  room_geometry_mode public.room_geometry_mode,
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
  claimed_room_geometry_mode public.room_geometry_mode;
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
    coalesce(j.room_geometry_mode, 'back_wall'::public.room_geometry_mode),
    j.retention_deadline,
    j.room_prep_attempt_count,
    j.max_attempts_per_stage
  into
    claimed_storage_prefix,
    claimed_customer_room_original_path,
    claimed_room_geometry_mode,
    claimed_retention_deadline,
    claimed_room_prep_attempt_count,
    claimed_max_attempts_per_stage;

  job_id := candidate_id;
  storage_prefix := claimed_storage_prefix;
  customer_room_original_path := claimed_customer_room_original_path;
  room_geometry_mode := claimed_room_geometry_mode;
  retention_deadline := claimed_retention_deadline;
  room_prep_attempt_count := claimed_room_prep_attempt_count;
  max_attempts_per_stage := claimed_max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;
