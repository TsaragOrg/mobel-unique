-- SPEC-0007 PLAN-0068 purge checkpoint and Realtime progress state.
--
-- PLAN-0012/PLAN-0039 purge logic redacted job artifacts and idempotency
-- state, but the later PLAN-0068 checkpoint dispatcher added durable
-- checkpoint rows, dispatch intents, and visitor-safe Realtime progress.
-- Expired simulations must remove those execution/progress records too so
-- no visitor-facing progress subscription or worker recovery path can observe
-- expired work.

create or replace function public.mark_in_home_simulation_job_purged(
  job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched integer;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  update public.simulation_generated_outputs
  set purged_at = now(), object_path = null
  where in_home_simulation_job_id = mark_in_home_simulation_job_purged.job_id
    and purged_at is null;

  delete from public.simulation_public_progress
  where simulation_job_id = mark_in_home_simulation_job_purged.job_id;

  delete from public.in_home_simulation_checkpoint_dispatch_outbox
  where in_home_simulation_job_id = mark_in_home_simulation_job_purged.job_id;

  delete from public.in_home_simulation_checkpoints
  where in_home_simulation_job_id = mark_in_home_simulation_job_purged.job_id;

  delete from public.simulation_idempotency_keys
  where simulation_job_id = mark_in_home_simulation_job_purged.job_id;

  update public.in_home_simulation_jobs
  set
    status = 'expired',
    expired_at = coalesce(expired_at, now()),
    customer_room_original_path = null,
    room_normalized_path = null,
    room_compressed_path = null,
    room_cleaned_path = null,
    dimension_guide_overlay_path = null,
    prepared_sofa_path = null,
    worker_error_path = null,
    reserved_generation_index = null,
    claim_expires_at = null,
    claimed_by = null,
    claimed_at = null,
    current_checkpoint = 'expired',
    current_checkpoint_status = 'expired',
    progress_step_key = null,
    progress_step_ordinal = null,
    progress_total_steps = null,
    progress_updated_at = null,
    updated_at = now()
  where id = mark_in_home_simulation_job_purged.job_id;

  get diagnostics matched = row_count;
  if matched = 0 then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;
end;
$$;

grant execute on function public.mark_in_home_simulation_job_purged(uuid)
  to service_role;
