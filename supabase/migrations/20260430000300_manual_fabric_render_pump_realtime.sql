-- PLAN-0031 manual fabric render pump and Realtime observation.
-- Fabric render processing is started by explicit admin actions, not cron.

alter table public.fabric_render_jobs
  add column if not exists request_id uuid;

alter table public.fabric_render_jobs
  alter column request_id set default gen_random_uuid();

update public.fabric_render_jobs
set request_id = id
where request_id is null;

alter table public.fabric_render_jobs
  alter column request_id set not null;

create index if not exists fabric_render_jobs_request_status_idx
  on public.fabric_render_jobs (request_id, status, queued_at);

create index if not exists fabric_render_jobs_request_processing_idx
  on public.fabric_render_jobs (request_id, status, claim_expires_at)
  where status = 'processing';

do $$
begin
  if to_regclass('cron.job') is not null and exists (
    select 1
    from cron.job
    where jobname = 'fabric-render-worker-runner'
  ) then
    perform cron.unschedule('fabric-render-worker-runner');
  end if;
end;
$$;

drop function if exists public.fabric_render_worker_request_status(uuid);

create or replace function public.fabric_render_worker_request_status(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  queued_count integer;
  processing_count integer;
  succeeded_count integer;
  failed_count integer;
  canceled_count integer;
begin
  if p_request_id is null then
    raise exception 'request_id is required';
  end if;

  update public.fabric_render_jobs
  set
    status = 'failed',
    claimed_by = null,
    claim_expires_at = null,
    last_error_message = coalesce(
      last_error_message,
      'Worker claim expired before manual resume'
    ),
    completed_at = now(),
    updated_at = now()
  where request_id = p_request_id
    and status = 'processing'
    and claim_expires_at < now();

  select
    count(*) filter (where status = 'queued'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'succeeded'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'canceled')
  into
    queued_count,
    processing_count,
    succeeded_count,
    failed_count,
    canceled_count
  from public.fabric_render_jobs
  where request_id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'queued', queued_count,
    'processing', processing_count,
    'succeeded', succeeded_count,
    'failed', failed_count,
    'canceled', canceled_count
  );
end;
$$;

drop function if exists public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text
);

drop function if exists public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer
);

create or replace function public.fabric_render_worker_claim_one_for_request(
  p_request_id uuid,
  worker_id text default 'fabric-render-worker-local',
  claim_ttl_seconds integer default 300,
  claim_provider_name text default null,
  claim_provider_model text default null,
  p_max_concurrent_jobs integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  active_job_count integer;
  claimed_job public.fabric_render_jobs%rowtype;
begin
  if p_request_id is null then
    raise exception 'request_id is required';
  end if;

  if claim_ttl_seconds <= 0 then
    raise exception 'claim_ttl_seconds must be greater than zero';
  end if;

  if p_max_concurrent_jobs <= 0 then
    raise exception 'p_max_concurrent_jobs must be greater than zero';
  end if;

  if claim_provider_name is null or length(trim(claim_provider_name)) = 0 then
    raise exception 'claim_provider_name is required';
  end if;

  if claim_provider_model is null or length(trim(claim_provider_model)) = 0 then
    raise exception 'claim_provider_model is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  perform public.fabric_render_worker_request_status(p_request_id);

  select count(*)::integer
  into active_job_count
  from public.fabric_render_jobs
  where request_id = p_request_id
    and status = 'processing';

  if active_job_count >= p_max_concurrent_jobs then
    return jsonb_build_object(
      'status', 'capacity_full',
      'request_id', p_request_id
    );
  end if;

  with next_job as (
    select id
    from public.fabric_render_jobs
    where request_id = p_request_id
      and status = 'queued'
    order by queued_at nulls first, created_at, id
    for update skip locked
    limit 1
  )
  update public.fabric_render_jobs as job
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
  from next_job
  where job.id = next_job.id
  returning job.* into claimed_job;

  if claimed_job.id is null then
    return jsonb_build_object(
      'status', 'empty',
      'request_id', p_request_id
    );
  end if;

  return jsonb_build_object(
    'status', 'processing',
    'request_id', claimed_job.request_id,
    'job_id', claimed_job.id,
    'attempt_count', claimed_job.attempt_count,
    'render_cell_id', claimed_job.render_cell_id,
    'generation_mode', claimed_job.generation_mode,
    'target_sofa_asset_id', claimed_job.target_sofa_asset_id,
    'fabric_ai_reference_asset_id', claimed_job.fabric_ai_reference_asset_id,
    'refinement_source_asset_id', claimed_job.refinement_source_asset_id,
    'prompt_note', claimed_job.prompt_note,
    'refine_prompt', claimed_job.refine_prompt,
    'provider_name', claimed_job.provider_name,
    'provider_model', claimed_job.provider_model,
    'prompt_version', claimed_job.prompt_version
  );
end;
$$;

grant execute on function public.fabric_render_worker_request_status(uuid)
  to service_role;

grant execute on function public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer
) to service_role;

grant select on public.fabric_render_jobs to authenticated;

drop policy if exists spec_0031_admin_fabric_render_jobs_realtime_select
  on public.fabric_render_jobs;

create policy spec_0031_admin_fabric_render_jobs_realtime_select
on public.fabric_render_jobs
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' -> 'mobel_unique' ->> 'role', '') = 'admin'
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fabric_render_jobs'
  ) then
    alter publication supabase_realtime add table public.fabric_render_jobs;
  end if;
end;
$$;
