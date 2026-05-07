-- PLAN-0068 in-home simulation checkpoint success transition.
--
-- A checkpoint worker needs a symmetric success RPC to pair with
-- `release_in_home_simulation_checkpoint_claim`: mark the claimed checkpoint
-- succeeded, publish safe progress, and optionally make the next checkpoint
-- claimable.

create or replace function public.complete_in_home_simulation_checkpoint_claim(
  p_checkpoint_id uuid,
  p_worker_identifier text,
  p_next_checkpoint_key public.simulation_checkpoint_key default null,
  p_next_generation_index integer default null,
  p_progress_step_key text default null,
  p_progress_step_ordinal integer default null,
  p_progress_total_steps integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  checkpoint_record public.in_home_simulation_checkpoints%rowtype;
  job_record public.in_home_simulation_jobs%rowtype;
  next_checkpoint_id uuid;
begin
  if p_checkpoint_id is null then
    raise exception 'p_checkpoint_id is required';
  end if;

  if p_worker_identifier is null or length(btrim(p_worker_identifier)) = 0 then
    raise exception 'p_worker_identifier is required';
  end if;

  if p_next_generation_index is not null
    and p_next_generation_index not in (0, 1, 2) then
    raise exception 'p_next_generation_index must be 0, 1, 2, or null';
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

  if job_record.id is null then
    raise exception 'in_home_simulation_jobs row not found for checkpoint %', p_checkpoint_id;
  end if;

  update public.in_home_simulation_checkpoints
  set
    status = 'succeeded',
    claimed_by = null,
    claimed_at = null,
    claim_expires_at = null,
    safe_error_code = null,
    safe_error_message = null,
    completed_at = now(),
    updated_at = now()
  where id = checkpoint_record.id;

  update public.in_home_simulation_jobs
  set
    claimed_by = null,
    claim_expires_at = null,
    current_checkpoint = checkpoint_record.checkpoint_key,
    current_checkpoint_status = 'succeeded',
    last_error_code = null,
    last_error_message = null,
    progress_updated_at = now(),
    updated_at = now()
  where id = checkpoint_record.in_home_simulation_job_id;

  perform public.record_in_home_simulation_progress(
    checkpoint_record.in_home_simulation_job_id,
    checkpoint_record.checkpoint_key,
    'succeeded',
    coalesce(p_progress_step_key, checkpoint_record.checkpoint_key::text),
    p_progress_step_ordinal,
    p_progress_total_steps,
    false,
    false,
    job_record.generated_output_count > 0,
    job_record.status = 'succeeded' and job_record.generated_output_count < 3
  );

  if p_next_checkpoint_key is not null then
    next_checkpoint_id := public.enqueue_in_home_simulation_checkpoint(
      checkpoint_record.in_home_simulation_job_id,
      p_next_checkpoint_key,
      coalesce(p_next_generation_index, checkpoint_record.generation_index),
      checkpoint_record.max_attempts,
      p_next_checkpoint_key::text,
      p_progress_step_ordinal,
      p_progress_total_steps
    );

    update public.in_home_simulation_jobs
    set
      status = public.in_home_simulation_checkpoint_job_status(p_next_checkpoint_key),
      updated_at = now()
    where id = checkpoint_record.in_home_simulation_job_id;
  end if;

  return jsonb_build_object(
    'status', 'succeeded',
    'checkpoint_id', checkpoint_record.id,
    'job_id', checkpoint_record.in_home_simulation_job_id,
    'next_checkpoint_id', next_checkpoint_id,
    'next_checkpoint_key', p_next_checkpoint_key
  );
end;
$$;

grant execute on function public.complete_in_home_simulation_checkpoint_claim(
  uuid,
  text,
  public.simulation_checkpoint_key,
  integer,
  text,
  integer,
  integer
) to service_role;
