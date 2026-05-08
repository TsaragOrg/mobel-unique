-- PLAN-0068 public API transitions for the checkpoint pump.
--
-- The public API should persist durable checkpoint work before it wakes the
-- worker pump. These wrappers keep the legacy pgmq RPCs available for local
-- tooling while giving the production public API a checkpoint-first surface.

create or replace function public.create_in_home_simulation_job_for_visitor_checkpoint_pump(
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
  created record;
begin
  for created in
    select *
    from public.create_in_home_simulation_job_for_visitor(
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
    perform public.enqueue_in_home_simulation_checkpoint(
      p_simulation_job_id => created.out_job_id,
      p_checkpoint_key => 'room_validation',
      p_generation_index => null,
      p_max_attempts => 3,
      p_progress_step_key => 'room_validation',
      p_progress_step_ordinal => 1,
      p_progress_total_steps => 4
    );

    out_job_id := created.out_job_id;
    out_status := created.out_status;
    out_created_at := created.out_created_at;
    out_retention_deadline := created.out_retention_deadline;
    out_room_geometry_mode := created.out_room_geometry_mode;
    out_storage_prefix := created.out_storage_prefix;
    return next;
  end loop;
end;
$$;

grant execute on function public.create_in_home_simulation_job_for_visitor_checkpoint_pump(
  text, text, uuid, uuid, text, public.room_geometry_mode, uuid, integer
) to service_role;

create or replace function public.submit_in_home_simulation_dimensions_checkpoint_pump(
  p_job_id uuid,
  p_supplied_dimensions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  checkpoint_id uuid;
  matched integer;
begin
  if p_job_id is null then
    raise exception 'p_job_id is required';
  end if;

  if p_supplied_dimensions is null then
    raise exception 'p_supplied_dimensions is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for p_job_id %', p_job_id;
  end if;

  if job_record.status <> 'awaiting_dimensions' then
    raise exception 'job % is in status % and cannot accept dimensions',
      p_job_id, job_record.status;
  end if;

  if job_record.retention_deadline <= now() then
    raise exception 'job % has passed its retention_deadline', p_job_id;
  end if;

  if job_record.room_geometry_mode = 'back_wall' then
    if not (
      p_supplied_dimensions ? 'wall_width'
      and p_supplied_dimensions ? 'wall_height'
      and p_supplied_dimensions ? 'room_depth'
    ) then
      raise exception 'back_wall mode requires wall_width, wall_height, and room_depth';
    end if;
  elsif job_record.room_geometry_mode = 'corner' then
    if not (
      p_supplied_dimensions ? 'left_wall_width'
      and p_supplied_dimensions ? 'right_wall_width'
      and p_supplied_dimensions ? 'room_height'
      and p_supplied_dimensions ? 'room_depth'
    ) then
      raise exception 'corner mode requires left_wall_width, right_wall_width, room_height, and room_depth';
    end if;
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'placement_queued',
    supplied_dimensions = p_supplied_dimensions,
    dimensions_submitted_at = now(),
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where id = p_job_id
    and status = 'awaiting_dimensions';

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during checkpoint dimension submission for job %', p_job_id;
  end if;

  checkpoint_id := public.enqueue_in_home_simulation_checkpoint(
    p_simulation_job_id => p_job_id,
    p_checkpoint_key => 'placement_generation',
    p_generation_index => null,
    p_max_attempts => 3,
    p_progress_step_key => 'placement_generation',
    p_progress_step_ordinal => 4,
    p_progress_total_steps => 4
  );

  return checkpoint_id;
end;
$$;

grant execute on function public.submit_in_home_simulation_dimensions_checkpoint_pump(
  uuid, jsonb
) to service_role;

create or replace function public.request_in_home_simulation_regeneration_checkpoint_pump(
  p_job_id uuid,
  p_supplied_dimensions jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_record public.in_home_simulation_jobs;
  checkpoint_id uuid;
  next_index integer;
  matched integer;
  new_dimensions jsonb;
begin
  if p_job_id is null then
    raise exception 'p_job_id is required';
  end if;

  select * into job_record
  from public.in_home_simulation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'in_home_simulation_jobs row not found for p_job_id %', p_job_id;
  end if;

  if job_record.status <> 'succeeded' then
    raise exception 'job % is in status % and cannot regenerate',
      p_job_id, job_record.status;
  end if;

  if job_record.retention_deadline <= now() then
    raise exception 'job % has passed its retention_deadline', p_job_id;
  end if;

  if job_record.generated_output_count >= 3 then
    raise exception 'job % already has the maximum of 3 generated outputs', p_job_id;
  end if;

  next_index := job_record.generated_output_count;
  new_dimensions := coalesce(p_supplied_dimensions, job_record.supplied_dimensions);

  if new_dimensions is null then
    raise exception 'job % has no supplied_dimensions and no override was provided', p_job_id;
  end if;

  update public.in_home_simulation_jobs
  set
    status = 'placement_queued',
    reserved_generation_index = next_index,
    supplied_dimensions = new_dimensions,
    last_regeneration_error_message = null,
    updated_at = now()
  where id = p_job_id
    and status = 'succeeded'
    and generated_output_count < 3;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'race during checkpoint regeneration request for job %', p_job_id;
  end if;

  checkpoint_id := public.enqueue_in_home_simulation_checkpoint(
    p_simulation_job_id => p_job_id,
    p_checkpoint_key => 'placement_generation',
    p_generation_index => next_index,
    p_max_attempts => 3,
    p_progress_step_key => 'placement_generation',
    p_progress_step_ordinal => 4,
    p_progress_total_steps => 4
  );

  return checkpoint_id;
end;
$$;

grant execute on function public.request_in_home_simulation_regeneration_checkpoint_pump(
  uuid, jsonb
) to service_role;
