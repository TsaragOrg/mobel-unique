-- SPEC-0015 PLAN-0074 public simulation identity retention cron.
--
-- Runs the in-home simulation purge function hourly. The function keeps the
-- existing artifact retention cleanup and also purges short-lived public
-- simulation email handoff data plus eligible transient Supabase Auth users.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'public-simulation-identity-purge-runner'
  ) then
    perform cron.unschedule('public-simulation-identity-purge-runner');
  end if;
end;
$$;

select cron.schedule(
  'public-simulation-identity-purge-runner',
  '17 * * * *',
  $cron$
    select net.http_post(
      url := secrets.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-in-home-simulation-purge-secret', secrets.invoke_secret
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron',
        'worker', 'in-home-simulation-purge',
        'time', now()
      ),
      timeout_milliseconds := 300000
    ) as request_id
    from (
      select
        max(decrypted_secret) filter (
          where name = 'in_home_simulation_purge_function_url'
        ) as function_url,
        max(decrypted_secret) filter (
          where name = 'in_home_simulation_purge_invoke_secret'
        ) as invoke_secret
      from vault.decrypted_secrets
      where name in (
        'in_home_simulation_purge_function_url',
        'in_home_simulation_purge_invoke_secret'
      )
    ) as secrets
    where secrets.function_url is not null
      and secrets.invoke_secret is not null;
  $cron$
);
