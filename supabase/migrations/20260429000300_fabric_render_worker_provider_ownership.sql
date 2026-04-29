-- PLAN-0026 fabric render worker provider ownership.
-- Provider and model are selected by the worker when it claims a job.

drop index if exists fabric_render_jobs_active_idempotency_idx;

create unique index fabric_render_jobs_active_idempotency_idx
  on public.fabric_render_jobs (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    target_sofa_asset_id,
    fabric_ai_reference_asset_id,
    coalesce(refinement_source_asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
    prompt_version,
    generation_mode,
    coalesce(prompt_note, '')
  )
  where status in ('queued', 'processing');

drop function if exists public.fabric_render_worker_claim_next(text, text, integer);

create or replace function public.fabric_render_worker_claim_next(
  queue_name text default 'local_fabric_render_jobs',
  worker_id text default 'fabric-render-worker-local',
  claim_ttl_seconds integer default 300,
  claim_provider_name text default null,
  claim_provider_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  queue_message record;
  queued_job_id uuid;
  claimed_job public.fabric_render_jobs%rowtype;
  recovered_job record;
begin
  if claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be greater than zero';
  end if;

  if claim_provider_name is null or length(trim(claim_provider_name)) = 0 then
    raise exception 'claim_provider_name is required';
  end if;

  if claim_provider_model is null or length(trim(claim_provider_model)) = 0 then
    raise exception 'claim_provider_model is required';
  end if;

  for recovered_job in
    update public.fabric_render_jobs
    set
      status = 'queued',
      claimed_by = null,
      claimed_at = null,
      claim_expires_at = null,
      last_error_message = coalesce(
        last_error_message,
        'Worker claim expired before completion'
      ),
      updated_at = now()
    where status = 'processing'
      and claim_expires_at < now()
      and attempt_count < max_attempts
    returning id
  loop
    perform pgmq.send(
      queue_name,
      jsonb_build_object(
        'job_id', recovered_job.id,
        'type', 'fabric_render_generation'
      )
    );
  end loop;

  update public.fabric_render_jobs
  set
    status = 'failed',
    claimed_by = null,
    claimed_at = null,
    claim_expires_at = null,
    last_error_message = coalesce(
      last_error_message,
      'Worker claim expired and no attempts remain'
    ),
    completed_at = now(),
    updated_at = now()
  where status = 'processing'
    and claim_expires_at < now()
    and attempt_count >= max_attempts;

  select *
  into queue_message
  from pgmq.read(queue_name, claim_ttl_seconds, 1)
  limit 1;

  if queue_message.msg_id is null then
    return jsonb_build_object(
      'status', 'empty',
      'queue_name', queue_name
    );
  end if;

  begin
    queued_job_id := (queue_message.message ->> 'job_id')::uuid;
  exception
    when others then
      perform pgmq.delete(queue_name, queue_message.msg_id);
      return jsonb_build_object(
        'status', 'skipped',
        'queue_name', queue_name,
        'queue_msg_id', queue_message.msg_id,
        'error', 'Queue message did not include a valid job_id'
      );
  end;

  update public.fabric_render_jobs
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    provider_name = claim_provider_name,
    provider_model = claim_provider_model,
    claimed_by = worker_id,
    claimed_at = now(),
    last_attempt_started_at = now(),
    claim_expires_at = now() + make_interval(secs => claim_ttl_seconds),
    updated_at = now()
  where id = queued_job_id
    and status = 'queued'
    and attempt_count < max_attempts
  returning * into claimed_job;

  perform pgmq.delete(queue_name, queue_message.msg_id);

  if claimed_job.id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'job_id', queued_job_id,
      'queue_name', queue_name,
      'queue_msg_id', queue_message.msg_id,
      'error', 'Job was not claimable'
    );
  end if;

  return jsonb_build_object(
    'status', 'processing',
    'job_id', claimed_job.id,
    'queue_name', queue_name,
    'queue_msg_id', queue_message.msg_id,
    'attempt_count', claimed_job.attempt_count,
    'max_attempts', claimed_job.max_attempts,
    'render_cell_id', claimed_job.render_cell_id,
    'generation_mode', claimed_job.generation_mode,
    'target_sofa_asset_id', claimed_job.target_sofa_asset_id,
    'fabric_ai_reference_asset_id', claimed_job.fabric_ai_reference_asset_id,
    'refinement_source_asset_id', claimed_job.refinement_source_asset_id,
    'prompt_note', claimed_job.prompt_note,
    'provider_name', claimed_job.provider_name,
    'provider_model', claimed_job.provider_model,
    'prompt_version', claimed_job.prompt_version
  );
end;
$$;

grant execute on function public.fabric_render_worker_claim_next(
  text,
  text,
  integer,
  text,
  text
) to service_role;

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
