-- SPEC-0015 PLAN-0057 watchdog re-enqueue and placement enqueue helper.
--
-- PLAN-0012 added `recover_expired_in_home_simulation_claims` which
-- flips a stuck `*_processing` row back to `queued`/`placement_queued`
-- but does not re-insert a pgmq message for it. PLAN-0056 scheduled
-- that recovery RPC every minute. End-to-end DEV testing showed the
-- gap: by the time recovery flips the row back to `queued`, the
-- original pgmq message has already been deleted by an earlier worker
-- tick that observed the row in `*_processing` state and dropped its
-- claim. The result is an orphan `queued` job that no worker ever
-- picks up.
--
-- This migration adds two pieces:
--
--   1. `enqueue_in_home_simulation_placement_message(job_id, queue_name)`
--      mirrors the existing
--      `enqueue_in_home_simulation_room_prep_message` so we have a
--      stable function to enqueue a Stage 2 message by id.
--
--   2. `requeue_recovered_in_home_simulation_jobs(batch_size, queue_name)`
--      composes `recover_expired_in_home_simulation_claims` with the
--      two enqueue helpers. For every row whose `new_status` is
--      `queued` or `placement_queued`, it inserts a fresh pgmq
--      message keyed on the job id. Returns the same shape as the
--      underlying recovery RPC so callers that just want the rows
--      can swap to the wrapper without other changes.
--
-- The `in-home-simulation-recovery-runner` cron is dropped and
-- re-scheduled to call the wrapper instead of the bare RPC. The cron
-- schedule (`* * * * *`) is unchanged.

create or replace function public.enqueue_in_home_simulation_placement_message(
  job_id uuid,
  queue_name text default 'local_in_home_simulation_jobs'
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  msg_id bigint;
begin
  if job_id is null then
    raise exception 'job_id is required';
  end if;

  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  if not exists (
    select 1 from public.in_home_simulation_jobs where id = job_id
  ) then
    raise exception 'in_home_simulation_jobs row not found for job_id %', job_id;
  end if;

  msg_id := pgmq.send(
    queue_name,
    jsonb_build_object(
      'job_id', job_id,
      'type', 'in_home_simulation_placement'
    )
  );

  return msg_id;
end;
$$;

grant execute on function public.enqueue_in_home_simulation_placement_message(uuid, text)
  to service_role;

create or replace function public.requeue_recovered_in_home_simulation_jobs(
  batch_size integer default 100,
  queue_name text default 'local_in_home_simulation_jobs'
)
returns table (
  job_id uuid,
  previous_status public.simulation_job_status,
  new_status public.simulation_job_status,
  reason text
)
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  recovered record;
begin
  if batch_size is null or batch_size <= 0 then
    raise exception 'batch_size must be a positive integer';
  end if;

  if queue_name is null or length(btrim(queue_name)) = 0 then
    raise exception 'queue_name is required';
  end if;

  for recovered in
    select *
    from public.recover_expired_in_home_simulation_claims(batch_size)
  loop
    if recovered.new_status = 'queued' then
      perform public.enqueue_in_home_simulation_room_prep_message(
        recovered.job_id,
        queue_name
      );
    elsif recovered.new_status = 'placement_queued' then
      perform public.enqueue_in_home_simulation_placement_message(
        recovered.job_id,
        queue_name
      );
    end if;

    job_id := recovered.job_id;
    previous_status := recovered.previous_status;
    new_status := recovered.new_status;
    reason := recovered.reason;
    return next;
  end loop;
end;
$$;

grant execute on function public.requeue_recovered_in_home_simulation_jobs(integer, text)
  to service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'in-home-simulation-recovery-runner'
  ) then
    perform cron.unschedule('in-home-simulation-recovery-runner');
  end if;
end;
$$;

select cron.schedule(
  'in-home-simulation-recovery-runner',
  '* * * * *',
  $cron$
    select public.requeue_recovered_in_home_simulation_jobs(100, 'local_in_home_simulation_jobs');
  $cron$
);
