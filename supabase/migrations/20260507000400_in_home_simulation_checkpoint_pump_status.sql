-- PLAN-0068 in-home simulation checkpoint pump status.
--
-- The worker pump uses this service-role helper to inspect durable checkpoint
-- backlog and active capacity before it starts short checkpoint invocations.

create or replace function public.in_home_simulation_checkpoint_pump_status(
  p_max_active_checkpoints integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  active_checkpoint_count integer;
  claimable_checkpoint_count integer;
  worker_paused boolean;
  resolved_max_active_checkpoints integer;
begin
  if p_max_active_checkpoints is null or p_max_active_checkpoints <= 0 then
    raise exception 'p_max_active_checkpoints must be positive';
  end if;

  resolved_max_active_checkpoints := p_max_active_checkpoints;
  worker_paused := public.simulation_cost_meter_paused();

  select count(*)::integer
  into active_checkpoint_count
  from public.in_home_simulation_checkpoints as c
  where c.status = 'processing'
    and c.claim_expires_at > now();

  select count(*)::integer
  into claimable_checkpoint_count
  from public.in_home_simulation_checkpoints as c
  join public.in_home_simulation_jobs as j
    on j.id = c.in_home_simulation_job_id
  where c.status in ('queued', 'retrying')
    and c.attempt_number < c.max_attempts + 1
    and j.retention_deadline > now()
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
    );

  return jsonb_build_object(
    'active_processing', active_checkpoint_count,
    'available_slots', case
      when worker_paused then 0
      else greatest(resolved_max_active_checkpoints - active_checkpoint_count, 0)
    end,
    'max_active_checkpoints', resolved_max_active_checkpoints,
    'queued', claimable_checkpoint_count,
    'status', case
      when worker_paused then 'paused'
      when claimable_checkpoint_count > 0
        and active_checkpoint_count < resolved_max_active_checkpoints
      then 'ready'
      else 'idle'
    end,
    'worker_paused', worker_paused
  );
end;
$$;

grant execute on function public.in_home_simulation_checkpoint_pump_status(
  integer
) to service_role;
