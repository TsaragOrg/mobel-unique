-- PLAN-0068 in-home simulation checkpoint claim RPCs.
--
-- These helpers are the database execution surface for the future worker pump:
-- make a checkpoint claimable, claim one checkpoint under global capacity,
-- claim a specific checkpoint from a queue wake-up, and release a checkpoint
-- after retryable or terminal failure.

create or replace function public.in_home_simulation_checkpoint_job_status(
  checkpoint_key public.simulation_checkpoint_key
)
returns public.simulation_job_status
language sql
immutable
as $$
  select case
    when checkpoint_key in (
      'room_validation',
      'room_cleaning',
      'room_corners',
      'dimension_guide'
    ) then 'queued'::public.simulation_job_status
    when checkpoint_key in (
      'placement_generation',
      'placement_measurement',
      'placement_finalize'
    ) then 'placement_queued'::public.simulation_job_status
    when checkpoint_key = 'awaiting_dimensions' then 'awaiting_dimensions'::public.simulation_job_status
    when checkpoint_key = 'completed' then 'succeeded'::public.simulation_job_status
    when checkpoint_key = 'expired' then 'expired'::public.simulation_job_status
    else 'failed'::public.simulation_job_status
  end;
$$;

grant execute on function public.in_home_simulation_checkpoint_job_status(
  public.simulation_checkpoint_key
) to service_role;

create or replace function public.in_home_simulation_checkpoint_processing_status(
  checkpoint_key public.simulation_checkpoint_key
)
returns public.simulation_job_status
language sql
immutable
as $$
  select case
    when checkpoint_key in (
      'placement_generation',
      'placement_measurement',
      'placement_finalize'
    ) then 'placement_processing'::public.simulation_job_status
    else 'room_prep_processing'::public.simulation_job_status
  end;
$$;

grant execute on function public.in_home_simulation_checkpoint_processing_status(
  public.simulation_checkpoint_key
) to service_role;

create or replace function public.enqueue_in_home_simulation_checkpoint(
  p_simulation_job_id uuid,
  p_checkpoint_key public.simulation_checkpoint_key,
  p_generation_index integer default null,
  p_max_attempts integer default 3,
  p_progress_step_key text default null,
  p_progress_step_ordinal integer default null,
  p_progress_total_steps integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_job public.in_home_simulation_jobs%rowtype;
  checkpoint_id uuid;
  next_job_status public.simulation_job_status;
begin
  if p_simulation_job_id is null then
    raise exception 'p_simulation_job_id is required';
  end if;

  if p_checkpoint_key is null then
    raise exception 'p_checkpoint_key is required';
  end if;

  if p_max_attempts is null or p_max_attempts <= 0 then
    raise exception 'p_max_attempts must be positive';
  end if;

  if p_generation_index is not null and p_generation_index not in (0, 1, 2) then
    raise exception 'p_generation_index must be 0, 1, 2, or null';
  end if;

  select *
  into target_job
  from public.in_home_simulation_jobs
  where id = p_simulation_job_id
  for update;

  if target_job.id is null then
    raise exception 'in_home_simulation_jobs row not found for id %', p_simulation_job_id;
  end if;

  if target_job.retention_deadline <= now() then
    raise exception 'in_home_simulation_jobs row % is past retention deadline', p_simulation_job_id;
  end if;

  next_job_status := public.in_home_simulation_checkpoint_job_status(p_checkpoint_key);

  insert into public.in_home_simulation_checkpoints (
    in_home_simulation_job_id,
    checkpoint_key,
    status,
    attempt_number,
    max_attempts,
    generation_index
  )
  values (
    p_simulation_job_id,
    p_checkpoint_key,
    'queued',
    1,
    p_max_attempts,
    p_generation_index
  )
  on conflict (
    in_home_simulation_job_id,
    checkpoint_key,
    (coalesce(generation_index, -1))
  )
  where status in ('queued', 'processing', 'retrying')
  do update set
    status = case
      when public.in_home_simulation_checkpoints.status = 'processing'
        then public.in_home_simulation_checkpoints.status
      else 'queued'::public.simulation_checkpoint_status
    end,
    max_attempts = greatest(public.in_home_simulation_checkpoints.max_attempts, excluded.max_attempts),
    updated_at = now()
  returning id into checkpoint_id;

  update public.in_home_simulation_jobs
  set
    status = case
      when next_job_status in ('failed', 'expired', 'succeeded', 'awaiting_dimensions')
        then next_job_status
      else status
    end,
    current_checkpoint = p_checkpoint_key,
    current_checkpoint_status = 'queued',
    updated_at = now()
  where id = p_simulation_job_id;

  perform public.record_in_home_simulation_progress(
    p_simulation_job_id,
    p_checkpoint_key,
    'queued',
    coalesce(p_progress_step_key, p_checkpoint_key::text),
    p_progress_step_ordinal,
    p_progress_total_steps,
    p_checkpoint_key = 'awaiting_dimensions',
    p_checkpoint_key = 'awaiting_dimensions',
    target_job.generated_output_count > 0,
    target_job.status = 'succeeded' and target_job.generated_output_count < 3
  );

  return checkpoint_id;
end;
$$;

create or replace function public.claim_in_home_simulation_checkpoint(
  p_worker_identifier text,
  p_claim_ttl_seconds integer default 180,
  p_max_active_checkpoints integer default 1
)
returns table (
  checkpoint_id uuid,
  job_id uuid,
  checkpoint_key public.simulation_checkpoint_key,
  attempt_number integer,
  max_attempts integer,
  generation_index integer,
  storage_prefix text,
  customer_room_original_path text,
  room_geometry_mode public.room_geometry_mode,
  room_cleaned_path text,
  room_geometry_points jsonb,
  supplied_dimensions jsonb,
  prepared_sofa_asset_id uuid,
  prepared_sofa_path text,
  reserved_generation_index integer,
  generated_output_count integer,
  retention_deadline timestamptz,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select *
  from public.claim_specific_in_home_simulation_checkpoint(
    null,
    null,
    p_worker_identifier,
    p_claim_ttl_seconds,
    p_max_active_checkpoints
  );
end;
$$;

create or replace function public.claim_specific_in_home_simulation_checkpoint(
  p_simulation_job_id uuid,
  p_checkpoint_key public.simulation_checkpoint_key,
  p_worker_identifier text,
  p_claim_ttl_seconds integer default 180,
  p_max_active_checkpoints integer default 1
)
returns table (
  checkpoint_id uuid,
  job_id uuid,
  checkpoint_key public.simulation_checkpoint_key,
  attempt_number integer,
  max_attempts integer,
  generation_index integer,
  storage_prefix text,
  customer_room_original_path text,
  room_geometry_mode public.room_geometry_mode,
  room_cleaned_path text,
  room_geometry_points jsonb,
  supplied_dimensions jsonb,
  prepared_sofa_asset_id uuid,
  prepared_sofa_path text,
  reserved_generation_index integer,
  generated_output_count integer,
  retention_deadline timestamptz,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  active_checkpoint_count integer;
  candidate_checkpoint_id uuid;
  new_claim_expires_at timestamptz;
  claimed record;
begin
  if p_worker_identifier is null or length(btrim(p_worker_identifier)) = 0 then
    raise exception 'p_worker_identifier is required';
  end if;

  if p_claim_ttl_seconds is null or p_claim_ttl_seconds <= 0 then
    raise exception 'p_claim_ttl_seconds must be positive';
  end if;

  if p_max_active_checkpoints is null or p_max_active_checkpoints <= 0 then
    raise exception 'p_max_active_checkpoints must be positive';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('in_home_simulation_checkpoint_capacity', 0)
  );

  if public.simulation_cost_meter_paused() then
    return;
  end if;

  select count(*)::integer
  into active_checkpoint_count
  from public.in_home_simulation_checkpoints
  where status = 'processing'
    and public.in_home_simulation_checkpoints.claim_expires_at > now();

  if active_checkpoint_count >= p_max_active_checkpoints then
    return;
  end if;

  select c.id
  into candidate_checkpoint_id
  from public.in_home_simulation_checkpoints as c
  join public.in_home_simulation_jobs as j
    on j.id = c.in_home_simulation_job_id
  where c.status in ('queued', 'retrying')
    and c.attempt_number < c.max_attempts + 1
    and j.retention_deadline > now()
    and (p_simulation_job_id is null or c.in_home_simulation_job_id = p_simulation_job_id)
    and (p_checkpoint_key is null or c.checkpoint_key = p_checkpoint_key)
    and not exists (
      select 1
      from public.in_home_simulation_checkpoints as active
      where active.in_home_simulation_job_id = c.in_home_simulation_job_id
        and active.status = 'processing'
    )
    and (
      (
        c.checkpoint_key in (
          'room_validation',
          'room_cleaning',
          'room_corners',
          'dimension_guide'
        )
        and j.status in ('queued', 'room_prep_processing')
      )
      or (
        c.checkpoint_key in (
          'placement_generation',
          'placement_measurement',
          'placement_finalize'
        )
        and j.status in ('placement_queued', 'placement_processing')
      )
    )
  order by c.created_at, c.id
  for update skip locked
  limit 1;

  if candidate_checkpoint_id is null then
    return;
  end if;

  new_claim_expires_at := now() + make_interval(secs => p_claim_ttl_seconds);

  update public.in_home_simulation_checkpoints as c
  set
    status = 'processing',
    attempt_number = case
      when c.status = 'retrying' then c.attempt_number + 1
      else c.attempt_number
    end,
    claimed_by = p_worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    started_at = coalesce(c.started_at, now()),
    updated_at = now()
  where c.id = candidate_checkpoint_id
  returning
    c.id,
    c.in_home_simulation_job_id,
    c.checkpoint_key,
    c.attempt_number,
    c.max_attempts,
    c.generation_index
  into claimed;

  update public.in_home_simulation_jobs as j
  set
    status = public.in_home_simulation_checkpoint_processing_status(claimed.checkpoint_key),
    claimed_by = p_worker_identifier,
    claimed_at = now(),
    claim_expires_at = new_claim_expires_at,
    current_checkpoint = claimed.checkpoint_key,
    current_checkpoint_status = 'processing',
    progress_updated_at = now(),
    room_prep_started_at = case
      when claimed.checkpoint_key in (
        'room_validation',
        'room_cleaning',
        'room_corners',
        'dimension_guide'
      ) then coalesce(j.room_prep_started_at, now())
      else j.room_prep_started_at
    end,
    placement_started_at = case
      when claimed.checkpoint_key in (
        'placement_generation',
        'placement_measurement',
        'placement_finalize'
      ) then coalesce(j.placement_started_at, now())
      else j.placement_started_at
    end,
    updated_at = now()
  where j.id = claimed.in_home_simulation_job_id;

  perform public.record_in_home_simulation_progress(
    claimed.in_home_simulation_job_id,
    claimed.checkpoint_key,
    'processing',
    claimed.checkpoint_key::text,
    null,
    null,
    false,
    false,
    false,
    false
  );

  return query
  select
    claimed.id,
    j.id,
    claimed.checkpoint_key,
    claimed.attempt_number,
    claimed.max_attempts,
    claimed.generation_index,
    j.storage_prefix,
    j.customer_room_original_path,
    j.room_geometry_mode,
    j.room_cleaned_path,
    j.room_geometry_points,
    j.supplied_dimensions,
    j.prepared_sofa_asset_id,
    j.prepared_sofa_path,
    j.reserved_generation_index,
    j.generated_output_count,
    j.retention_deadline,
    new_claim_expires_at
  from public.in_home_simulation_jobs as j
  where j.id = claimed.in_home_simulation_job_id;
end;
$$;

create or replace function public.release_in_home_simulation_checkpoint_claim(
  p_checkpoint_id uuid,
  p_worker_identifier text,
  p_safe_error_code text,
  p_safe_error_message text,
  p_retryable boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  checkpoint_record public.in_home_simulation_checkpoints%rowtype;
  job_record public.in_home_simulation_jobs%rowtype;
  should_retry boolean;
  next_checkpoint_status public.simulation_checkpoint_status;
  next_job_status public.simulation_job_status;
begin
  if p_checkpoint_id is null then
    raise exception 'p_checkpoint_id is required';
  end if;

  if p_worker_identifier is null or length(btrim(p_worker_identifier)) = 0 then
    raise exception 'p_worker_identifier is required';
  end if;

  if p_safe_error_code is null or length(btrim(p_safe_error_code)) = 0 then
    raise exception 'p_safe_error_code is required';
  end if;

  if p_safe_error_message is null or length(btrim(p_safe_error_message)) = 0 then
    raise exception 'p_safe_error_message is required';
  end if;

  select *
  into checkpoint_record
  from public.in_home_simulation_checkpoints
  where id = p_checkpoint_id
    and status = 'processing'
    and claimed_by = p_worker_identifier
  for update;

  if checkpoint_record.id is null then
    raise exception 'checkpoint % is not processing or is claimed by another worker', p_checkpoint_id;
  end if;

  select *
  into job_record
  from public.in_home_simulation_jobs
  where id = checkpoint_record.in_home_simulation_job_id
  for update;

  should_retry := coalesce(p_retryable, true)
    and checkpoint_record.attempt_number < checkpoint_record.max_attempts
    and job_record.retention_deadline > now();

  next_checkpoint_status := case
    when should_retry then 'retrying'::public.simulation_checkpoint_status
    else 'failed'::public.simulation_checkpoint_status
  end;

  next_job_status := case
    when should_retry then public.in_home_simulation_checkpoint_job_status(checkpoint_record.checkpoint_key)
    when checkpoint_record.checkpoint_key in (
      'placement_generation',
      'placement_measurement',
      'placement_finalize'
    ) and job_record.generated_output_count > 0 then 'succeeded'::public.simulation_job_status
    else 'failed'::public.simulation_job_status
  end;

  update public.in_home_simulation_checkpoints
  set
    status = next_checkpoint_status,
    claimed_by = null,
    claimed_at = null,
    claim_expires_at = null,
    retryable = should_retry,
    safe_error_code = p_safe_error_code,
    safe_error_message = p_safe_error_message,
    completed_at = case when should_retry then completed_at else now() end,
    updated_at = now()
  where id = checkpoint_record.id;

  update public.in_home_simulation_jobs
  set
    status = next_job_status,
    claimed_by = null,
    claim_expires_at = null,
    current_checkpoint = checkpoint_record.checkpoint_key,
    current_checkpoint_status = next_checkpoint_status,
    last_error_code = p_safe_error_code,
    last_error_message = case
      when next_job_status = 'failed' then p_safe_error_message
      else last_error_message
    end,
    last_regeneration_error_message = case
      when next_job_status = 'succeeded'
        and checkpoint_record.checkpoint_key in (
          'placement_generation',
          'placement_measurement',
          'placement_finalize'
        )
      then p_safe_error_message
      else last_regeneration_error_message
    end,
    reserved_generation_index = case
      when next_job_status = 'succeeded'
        and checkpoint_record.checkpoint_key in (
          'placement_generation',
          'placement_measurement',
          'placement_finalize'
        )
      then null
      else reserved_generation_index
    end,
    progress_updated_at = now(),
    updated_at = now()
  where id = checkpoint_record.in_home_simulation_job_id;

  perform public.record_in_home_simulation_progress(
    checkpoint_record.in_home_simulation_job_id,
    checkpoint_record.checkpoint_key,
    next_checkpoint_status,
    checkpoint_record.checkpoint_key::text,
    null,
    null,
    false,
    false,
    next_job_status = 'succeeded' and job_record.generated_output_count > 0,
    next_job_status = 'succeeded' and job_record.generated_output_count < 3
  );

  return jsonb_build_object(
    'status', next_checkpoint_status,
    'job_status', next_job_status,
    'checkpoint_id', checkpoint_record.id,
    'job_id', checkpoint_record.in_home_simulation_job_id,
    'retryable', should_retry
  );
end;
$$;

grant execute on function public.enqueue_in_home_simulation_checkpoint(
  uuid,
  public.simulation_checkpoint_key,
  integer,
  integer,
  text,
  integer,
  integer
) to service_role;

grant execute on function public.claim_in_home_simulation_checkpoint(
  text,
  integer,
  integer
) to service_role;

grant execute on function public.claim_specific_in_home_simulation_checkpoint(
  uuid,
  public.simulation_checkpoint_key,
  text,
  integer,
  integer
) to service_role;

grant execute on function public.release_in_home_simulation_checkpoint_claim(
  uuid,
  text,
  text,
  text,
  boolean
) to service_role;
