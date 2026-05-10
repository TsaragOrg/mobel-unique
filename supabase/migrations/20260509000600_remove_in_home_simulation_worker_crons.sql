-- SPEC-0015 PLAN-0068 remove cron-driven in-home simulation execution.
--
-- Public API actions now wake the in-home simulation worker immediately after
-- durable database state is committed. The visitor-facing workflow must not
-- wait for a one-minute cron drain or a local watch process. The outbox remains
-- the durable handoff record, but execution is API-triggered and observed
-- through Realtime.

do $$
begin
  if to_regclass('cron.job') is not null and exists (
    select 1
    from cron.job
    where jobname = 'in-home-simulation-worker-runner'
  ) then
    perform cron.unschedule('in-home-simulation-worker-runner');
  end if;

  if to_regclass('cron.job') is not null and exists (
    select 1
    from cron.job
    where jobname = 'in-home-simulation-recovery-runner'
  ) then
    perform cron.unschedule('in-home-simulation-recovery-runner');
  end if;
end;
$$;
