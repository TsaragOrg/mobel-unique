-- SPEC-0006 PLAN-0036 local Gemini render worker global capacity.
--
-- Manual render requests are grouped by request_id, but the local Supabase Edge
-- runtime can cancel concurrent Gemini image generations even when each request
-- individually respects FABRIC_RENDER_MAX_CONCURRENT_JOBS=1. This migration
-- keeps the existing request-scoped production behavior while allowing the
-- worker to opt into a global capacity scope for local Gemini runs.

drop function if exists public.fabric_render_worker_request_status(uuid);
drop function if exists public.fabric_render_worker_request_status(uuid, text);

create or replace function public.fabric_render_worker_request_status(
  p_request_id uuid,
  p_capacity_scope text default 'request'
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
  active_processing_count integer;
begin
  if p_request_id is null then
    raise exception 'request_id is required';
  end if;

  if p_capacity_scope not in ('request', 'global') then
    raise exception 'p_capacity_scope must be request or global';
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
  where status = 'processing'
    and claim_expires_at < now()
    and (
      p_capacity_scope = 'global'
      or request_id = p_request_id
    );

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

  select count(*)::integer
  into active_processing_count
  from public.fabric_render_jobs
  where status = 'processing'
    and (
      p_capacity_scope = 'global'
      or request_id = p_request_id
    );

  return jsonb_build_object(
    'request_id', p_request_id,
    'capacity_scope', p_capacity_scope,
    'queued', queued_count,
    'processing', processing_count,
    'active_processing', active_processing_count,
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
  text,
  integer
);
drop function if exists public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text
);

create or replace function public.fabric_render_worker_claim_one_for_request(
  p_request_id uuid,
  worker_id text default 'fabric-render-worker-local',
  claim_ttl_seconds integer default 300,
  claim_provider_name text default null,
  claim_provider_model text default null,
  p_max_concurrent_jobs integer default 3,
  p_capacity_scope text default 'request'
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

  if p_capacity_scope not in ('request', 'global') then
    raise exception 'p_capacity_scope must be request or global';
  end if;

  if claim_provider_name is null or length(trim(claim_provider_name)) = 0 then
    raise exception 'claim_provider_name is required';
  end if;

  if claim_provider_model is null or length(trim(claim_provider_model)) = 0 then
    raise exception 'claim_provider_model is required';
  end if;

  perform pg_advisory_xact_lock(
    case
      when p_capacity_scope = 'global'
        then hashtextextended('fabric_render_worker_global_capacity', 0)
      else hashtextextended(p_request_id::text, 0)
    end
  );

  perform public.fabric_render_worker_request_status(
    p_request_id,
    p_capacity_scope
  );

  select count(*)::integer
  into active_job_count
  from public.fabric_render_jobs
  where status = 'processing'
    and (
      p_capacity_scope = 'global'
      or request_id = p_request_id
    );

  if active_job_count >= p_max_concurrent_jobs then
    return jsonb_build_object(
      'status', 'capacity_full',
      'request_id', p_request_id,
      'capacity_scope', p_capacity_scope
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
      'request_id', p_request_id,
      'capacity_scope', p_capacity_scope
    );
  end if;

  return jsonb_build_object(
    'status', 'processing',
    'request_id', claimed_job.request_id,
    'capacity_scope', p_capacity_scope,
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

drop function if exists public.fabric_render_worker_next_queued_request_id(uuid);

create or replace function public.fabric_render_worker_next_queued_request_id(
  p_current_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  next_request_id uuid;
begin
  select job.request_id
  into next_request_id
  from public.fabric_render_jobs as job
  where job.status = 'queued'
    and (
      p_current_request_id is null
      or job.request_id <> p_current_request_id
    )
  order by job.queued_at nulls first, job.created_at, job.id
  limit 1;

  return next_request_id;
end;
$$;

grant execute on function public.fabric_render_worker_request_status(uuid, text)
  to service_role;

grant execute on function public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text
) to service_role;

grant execute on function public.fabric_render_worker_next_queued_request_id(uuid)
  to service_role;
