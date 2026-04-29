-- PLAN-0025 fabric render production cron runner.
-- Invokes the fabric render worker on a schedule so queued jobs do not depend
-- on a browser session or a manual function call.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'fabric-render-worker-runner'
  ) then
    perform cron.unschedule('fabric-render-worker-runner');
  end if;
end;
$$;

select cron.schedule(
  'fabric-render-worker-runner',
  '* * * * *',
  $cron$
    select net.http_post(
      url := secrets.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-fabric-render-worker-secret', secrets.invoke_secret
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron',
        'worker', 'fabric-render-worker',
        'time', now()
      ),
      timeout_milliseconds := 300000
    ) as request_id
    from (
      select
        max(decrypted_secret) filter (
          where name = 'fabric_render_worker_function_url'
        ) as function_url,
        max(decrypted_secret) filter (
          where name = 'fabric_render_worker_invoke_secret'
        ) as invoke_secret
      from vault.decrypted_secrets
      where name in (
        'fabric_render_worker_function_url',
        'fabric_render_worker_invoke_secret'
      )
    ) as secrets
    where secrets.function_url is not null
      and secrets.invoke_secret is not null;
  $cron$
);
