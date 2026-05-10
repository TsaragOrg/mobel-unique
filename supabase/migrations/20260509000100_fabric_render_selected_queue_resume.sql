-- PLAN-0074 selected fabric render queue resume.
-- The worker can prefer one queued job when an admin resumes from a chosen
-- render cell. Normal request/global capacity rules still apply.

drop function if exists public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text
);

drop function if exists public.fabric_render_worker_claim_one_for_request(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text,
  uuid
);

create or replace function public.fabric_render_worker_claim_one_for_request(
  p_request_id uuid,
  worker_id text default 'fabric-render-worker-local',
  claim_ttl_seconds integer default 300,
  claim_provider_name text default null,
  claim_provider_model text default null,
  p_max_concurrent_jobs integer default 3,
  p_capacity_scope text default 'request',
  p_preferred_job_id uuid default null
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
    select job.id
    from public.fabric_render_jobs as job
    where job.request_id = p_request_id
      and job.status = 'queued'
    order by
      case when p_preferred_job_id is not null and job.id = p_preferred_job_id then 0 else 1 end,
      job.queued_at nulls first,
      job.created_at,
      job.id
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

grant execute on function public.fabric_render_worker_claim_one_for_request(uuid, text, integer, text, text, integer, text, uuid)
  to service_role;
