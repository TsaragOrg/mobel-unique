-- SPEC-0015 PLAN-0056 in-home simulation recovery cron.
--
-- Recovers stuck `room_prep_processing` and `placement_processing`
-- jobs whose `claim_expires_at` has passed. Calls the existing
-- `recover_expired_in_home_simulation_claims(batch_size)` RPC defined
-- by PLAN-0012. Without this schedule, jobs whose isolate dies inside
-- a slow OpenAI fetch (over the Edge Functions 150s wall-clock) sit
-- in a processing state forever — the AbortController inside the
-- providers handles the well-behaved case, this cron is the
-- defense-in-depth for cases where the isolate is killed before the
-- abort can fire.
--
-- The cron runs every minute. With the default
-- `IN_HOME_SIMULATION_CLAIM_TTL_SECONDS=600` the worst-case recovery
-- window is ~11 minutes from the moment the isolate died.

create extension if not exists pg_cron with schema extensions;

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
    select public.recover_expired_in_home_simulation_claims(100);
  $cron$
);
