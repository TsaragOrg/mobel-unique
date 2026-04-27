-- SPEC-0007 PLAN-0011 in-home simulation Stage 2 SQL surface.
--
-- These functions wrap the atomic state transitions required for Stage 2
-- (sofa placement) and the regeneration cycle so the Edge Function and the
-- local CLIs can drive them with a single RPC call rather than juggling
-- multi-statement PATCHes that could violate
-- `regeneration_count_matches_outputs`.
--
--   - `submit_in_home_simulation_dimensions` is the API-facing transition
--     after the visitor has chosen wall dimensions. It moves
--     `awaiting_dimensions` -> `placement_queued`, persists the supplied
--     dimensions, and sends the placement work message on the queue.
--   - `request_in_home_simulation_regeneration` enforces the SPEC-0004 MVP
--     three-result cap, atomically reserves the next output index, may
--     update wall dimensions, and re-queues the job.
--   - `claim_specific_in_home_simulation_placement_job` claims a specific
--     job for Stage 2 from a dequeued message.
--   - `complete_in_home_simulation_placement_stage` records the persisted
--     output, transitions the job back to `succeeded`, and respects the
--     `regeneration_count_matches_outputs` invariant.
--   - `record_in_home_simulation_placement_failure` rolls back a failed
--     regeneration to the previous successful state when a prior output
--     exists, or to `failed` when none does.

create or replace function public.submit_in_home_simulation_dimensions(
  job_id uuid,
  supplied_dimensions jsonb,
  queue_name text default 'local_in_home_simulation_jobs'
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  msg_id bigint;
  matched integer;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if supplied_dimensions is null then
    raise exception 'supplied_dimensions is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = submit_in_home_simulation_dimensions.job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  if job_record.status <> 'awaiting_dimensions' then
    raise exception 'job % is in status % and cannot accept dimensions',
      job_id, job_record.status;
  end if;

  if job_record.retention_deadline <= now() then
    raise exception 'job % has passed its retention_deadline', job_id;
  end if;

  if job_record.room_geometry_mode = 'back_wall' then
    if not (
      supplied_dimensions ? 'wall_width'
      and supplied_dimensions ? 'wall_height'
    ) then
      raise exception 'back_wall mode requires wall_width and wall_height';
    end if;
  elsif job_record.room_geometry_mode = 'corner' then
    if not (
      supplied_dimensions ? 'left_wall_width'
      and supplied_dimensions ? 'right_wall_width'
      and supplied_dimensions ? 'room_height'
    ) then
      raise exception 'corner mode requires left_wall_width, right_wall_width, and room_height';
    end if;
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'placement_queued',
    supplied_dimensions = submit_in_home_simulation_dimensions.supplied_dimensions,
    dimensions_submitted_at = now(),
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where id = submit_in_home_simulation_dimensions.job_id
    and status = 'awaiting_dimensions';

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during dimension submission for job %', job_id;
  end if;

  msg_id := pgmq.send(
    queue_name,
    jsonb_build_object(
      'job_id', submit_in_home_simulation_dimensions.job_id,
      'type', 'in_home_simulation_placement'
    )
  );

  return msg_id;
end;
$$;

create or replace function public.request_in_home_simulation_regeneration(
  job_id uuid,
  supplied_dimensions jsonb default null,
  queue_name text default 'local_in_home_simulation_jobs'
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  msg_id bigint;
  next_index integer;
  matched integer;
  new_dimensions jsonb;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = request_in_home_simulation_regeneration.job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  if job_record.status <> 'succeeded' then
    raise exception 'job % is in status % and cannot regenerate',
      job_id, job_record.status;
  end if;

  if job_record.retention_deadline <= now() then
    raise exception 'job % has passed its retention_deadline', job_id;
  end if;

  if job_record.generated_output_count >= 3 then
    raise exception 'job % already has the maximum of 3 generated outputs', job_id;
  end if;

  next_index := job_record.generated_output_count;
  new_dimensions := coalesce(supplied_dimensions, job_record.supplied_dimensions);

  if new_dimensions is null then
    raise exception 'job % has no supplied_dimensions and no override was provided', job_id;
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'placement_queued',
    reserved_generation_index = next_index,
    supplied_dimensions = new_dimensions,
    last_regeneration_error_message = null,
    updated_at = now()
  where id = request_in_home_simulation_regeneration.job_id
    and status = 'succeeded'
    and generated_output_count < 3;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during regeneration request for job %', job_id;
  end if;

  msg_id := pgmq.send(
    queue_name,
    jsonb_build_object(
      'job_id', request_in_home_simulation_regeneration.job_id,
      'type', 'in_home_simulation_placement',
      'generation_index', next_index
    )
  );

  return msg_id;
end;
$$;

create or replace function public.claim_specific_in_home_simulation_placement_job(
  job_id uuid,
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
  claimed public.in_home_simulation_jobs;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if claim_ttl_seconds is null or claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be a positive integer';
  end if;

  ttl_interval := make_interval(secs => claim_ttl_seconds);

  select id
  into candidate_id
  from public.in_home_simulation_jobs
  where id = claim_specific_in_home_simulation_placement_job.job_id
    and status = 'placement_queued'
    and retention_deadline > now()
    and placement_attempt_count < max_attempts_per_stage
  for update skip locked
  limit 1;

  if candidate_id is null then
    return;
  end if;

  new_claim_expires_at := now() + ttl_interval;

  update public.in_home_simulation_jobs
  set
    status = 'placement_processing',
    placement_attempt_count = placement_attempt_count + 1,
    claimed_by = worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    placement_started_at = coalesce(placement_started_at, now()),
    updated_at = now()
  where id = candidate_id
  returning * into claimed;

  job_id := claimed.id;
  storage_prefix := claimed.storage_prefix;
  room_cleaned_path := claimed.room_cleaned_path;
  room_geometry_mode := claimed.room_geometry_mode;
  room_geometry_points := claimed.room_geometry_points;
  supplied_dimensions := claimed.supplied_dimensions;
  prepared_sofa_asset_id := claimed.prepared_sofa_asset_id;
  prepared_sofa_path := claimed.prepared_sofa_path;
  reserved_generation_index := claimed.reserved_generation_index;
  generated_output_count := claimed.generated_output_count;
  retention_deadline := claimed.retention_deadline;
  placement_attempt_count := claimed.placement_attempt_count;
  max_attempts_per_stage := claimed.max_attempts_per_stage;
  claim_expires_at := new_claim_expires_at;

  return next;
end;
$$;

create or replace function public.complete_in_home_simulation_placement_stage(
  job_id uuid,
  worker_identifier text,
  generation_index integer,
  output_object_path text,
  output_content_type text,
  output_width_px integer,
  output_height_px integer,
  provider_name text,
  provider_model text,
  prompt_version text,
  prepared_sofa_path text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  new_count integer;
  matched integer;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if generation_index is null or generation_index < 0 or generation_index > 2 then
    raise exception 'generation_index must be 0, 1, or 2';
  end if;

  if output_object_path is null
    or length(btrim(output_object_path)) = 0 then
    raise exception 'output_object_path is required';
  end if;

  if provider_name is null or length(btrim(provider_name)) = 0 then
    raise exception 'provider_name is required';
  end if;

  if provider_model is null or length(btrim(provider_model)) = 0 then
    raise exception 'provider_model is required';
  end if;

  if prompt_version is null or length(btrim(prompt_version)) = 0 then
    raise exception 'prompt_version is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = complete_in_home_simulation_placement_stage.job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  if job_record.status <> 'placement_processing' then
    raise exception 'job % is not in placement_processing', job_id;
  end if;

  if job_record.claimed_by <> worker_identifier then
    raise exception 'job % is claimed by another worker', job_id;
  end if;

  if job_record.generated_output_count >= 3 then
    raise exception 'job % already has the maximum of 3 generated outputs', job_id;
  end if;

  new_count := job_record.generated_output_count + 1;

  insert into public.simulation_generated_outputs (
    in_home_simulation_job_id,
    generation_index,
    object_path,
    content_type,
    width_px,
    height_px,
    source_type,
    provider_name,
    provider_model,
    prompt_version
  )
  values (
    complete_in_home_simulation_placement_stage.job_id,
    complete_in_home_simulation_placement_stage.generation_index,
    output_object_path,
    output_content_type,
    output_width_px,
    output_height_px,
    'ai_generated_in_home_simulation',
    provider_name,
    provider_model,
    prompt_version
  );

  update public.in_home_simulation_jobs
  set
    status = 'succeeded',
    latest_generated_output_index = complete_in_home_simulation_placement_stage.generation_index,
    generated_output_count = new_count,
    regeneration_count = greatest(new_count - 1, 0),
    reserved_generation_index = null,
    claim_expires_at = null,
    completed_at = now(),
    last_error_code = null,
    last_error_message = null,
    last_regeneration_error_message = null,
    prepared_sofa_path = coalesce(
      complete_in_home_simulation_placement_stage.prepared_sofa_path,
      job_record.prepared_sofa_path
    ),
    updated_at = now()
  where id = complete_in_home_simulation_placement_stage.job_id
    and status = 'placement_processing'
    and claimed_by = worker_identifier;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during placement completion for job %', job_id;
  end if;
end;
$$;

create or replace function public.record_in_home_simulation_placement_failure(
  job_id uuid,
  worker_identifier text,
  error_code text,
  error_message text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  matched integer;
  new_status text;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if worker_identifier is null or length(btrim(worker_identifier)) = 0 then
    raise exception 'worker_identifier is required';
  end if;

  if error_message is null or length(btrim(error_message)) = 0 then
    raise exception 'error_message is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = record_in_home_simulation_placement_failure.job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  if job_record.status <> 'placement_processing' then
    raise exception 'job % is not in placement_processing', job_id;
  end if;

  if job_record.claimed_by <> worker_identifier then
    raise exception 'job % is claimed by another worker', job_id;
  end if;

  if job_record.generated_output_count > 0 then
    -- Regeneration failure with a previous result available. Keep the
    -- prior result accessible per SPEC-0007 and surface the error via
    -- last_regeneration_error_message.
    new_status := 'succeeded';
    update public.in_home_simulation_jobs
    set
      status = 'succeeded',
      reserved_generation_index = null,
      claim_expires_at = null,
      last_regeneration_error_message = error_message,
      updated_at = now()
    where id = record_in_home_simulation_placement_failure.job_id;
  else
    new_status := 'failed';
    update public.in_home_simulation_jobs
    set
      status = 'failed',
      reserved_generation_index = null,
      claim_expires_at = null,
      last_error_code = error_code,
      last_error_message = error_message,
      updated_at = now()
    where id = record_in_home_simulation_placement_failure.job_id;
  end if;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during placement failure recording for job %', job_id;
  end if;

  return new_status;
end;
$$;
