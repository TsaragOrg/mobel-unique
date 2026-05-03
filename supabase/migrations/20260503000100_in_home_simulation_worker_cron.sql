-- PLAN-0051 in-home simulation worker production cron runner.
-- Invokes the in-home simulation worker on a schedule so queued
-- room-prep and placement jobs do not depend on a browser session
-- or a manual function call. Mirrors the fabric-render cron added
-- in 20260429000200_fabric_render_worker_cron.sql.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'in-home-simulation-worker-runner'
  ) then
    perform cron.unschedule('in-home-simulation-worker-runner');
  end if;
end;
$$;

select cron.schedule(
  'in-home-simulation-worker-runner',
  '* * * * *',
  $cron$
    select net.http_post(
      url := secrets.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-in-home-simulation-worker-secret', secrets.invoke_secret
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron',
        'worker', 'in-home-simulation-worker',
        'time', now()
      ),
      timeout_milliseconds := 300000
    ) as request_id
    from (
      select
        max(decrypted_secret) filter (
          where name = 'in_home_simulation_worker_function_url'
        ) as function_url,
        max(decrypted_secret) filter (
          where name = 'in_home_simulation_worker_invoke_secret'
        ) as invoke_secret
      from vault.decrypted_secrets
      where name in (
        'in_home_simulation_worker_function_url',
        'in_home_simulation_worker_invoke_secret'
      )
    ) as secrets
    where secrets.function_url is not null
      and secrets.invoke_secret is not null;
  $cron$
);
