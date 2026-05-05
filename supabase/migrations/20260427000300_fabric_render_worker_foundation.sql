create extension if not exists pgcrypto;
create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1
    from pgmq.meta
    where queue_name = 'local_fabric_render_jobs'
  ) then
    perform pgmq.create('local_fabric_render_jobs');
  end if;
end $$;

create or replace function public.fabric_render_worker_seed_mock_job(
  queue_name text default 'local_fabric_render_jobs'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  seed_id uuid := gen_random_uuid();
  swatch_asset_id uuid;
  fabric_reference_asset_id uuid;
  target_sofa_asset_id uuid;
  sofa_id uuid;
  fabric_id uuid;
  visual_matrix_column_id uuid;
  render_cell_id uuid;
  seeded_job_id uuid;
begin
  insert into public.storage_assets (
    bucket_id,
    object_path,
    visibility,
    lifecycle_state,
    asset_kind,
    content_type,
    byte_size,
    width_px,
    height_px
  )
  values (
    'catalog-public-assets',
    'fabric-render-smoke/' || seed_id || '/swatch.png',
    'public',
    'active',
    'fabric_swatch_public',
    'image/png',
    68,
    1,
    1
  )
  returning id into swatch_asset_id;

  insert into public.storage_assets (
    bucket_id,
    object_path,
    visibility,
    lifecycle_state,
    asset_kind,
    content_type,
    byte_size,
    width_px,
    height_px
  )
  values (
    'catalog-private-assets',
    'fabric-render-smoke/' || seed_id || '/fabric_ref.jpg',
    'private',
    'active',
    'fabric_ai_reference',
    'image/jpeg',
    68,
    1,
    1
  )
  returning id into fabric_reference_asset_id;

  insert into public.storage_assets (
    bucket_id,
    object_path,
    visibility,
    lifecycle_state,
    asset_kind,
    content_type,
    byte_size,
    width_px,
    height_px
  )
  values (
    'catalog-private-assets',
    'fabric-render-smoke/' || seed_id || '/target_sofa.jpg',
    'private',
    'active',
    'sofa_source_photo',
    'image/jpeg',
    68,
    1,
    1
  )
  returning id into target_sofa_asset_id;

  insert into public.sofas (internal_name, public_name, shopify_order_url)
  values (
    'Mock Fabric Render Sofa ' || seed_id,
    'Mock Fabric Render Sofa ' || seed_id,
    'https://shop.example/fabric-render-smoke'
  )
  returning id into sofa_id;

  insert into public.fabrics (
    internal_name,
    public_name,
    swatch_asset_id,
    ai_reference_asset_id
  )
  values (
    'Mock Fabric ' || seed_id,
    'Mock Fabric ' || seed_id,
    swatch_asset_id,
    fabric_reference_asset_id
  )
  returning id into fabric_id;

  insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
  values (sofa_id, fabric_id, 1);

  insert into public.visual_matrix_columns (
    sofa_id,
    sequence,
    admin_label,
    public_label
  )
  values (sofa_id, 1, 'Mock front', 'Front')
  returning id into visual_matrix_column_id;

  insert into public.sofa_render_cells (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    source_type
  )
  values (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    'manual_upload'
  )
  returning id into render_cell_id;

  insert into public.fabric_render_jobs (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    render_cell_id,
    generation_mode,
    target_sofa_asset_id,
    fabric_ai_reference_asset_id,
    provider_name,
    provider_model,
    prompt_version,
    status,
    max_attempts,
    queued_at
  )
  values (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    render_cell_id,
    'initial',
    target_sofa_asset_id,
    fabric_reference_asset_id,
    'mock',
    'mock-fabric-render-v1',
    'v007',
    'queued',
    3,
    now()
  )
  returning id into seeded_job_id;

  perform pgmq.send(
    queue_name,
    jsonb_build_object(
      'job_id', seeded_job_id,
      'type', 'fabric_render_generation'
    )
  );

  return jsonb_build_object(
    'status', 'queued',
    'job_id', seeded_job_id,
    'queue_name', queue_name
  );
end;
$$;

create or replace function public.fabric_render_worker_claim_next(
  queue_name text default 'local_fabric_render_jobs',
  worker_id text default 'fabric-render-worker-local',
  claim_ttl_seconds integer default 300
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

create or replace function public.fabric_render_worker_succeed(
  job_id uuid,
  output_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  target_job public.fabric_render_jobs%rowtype;
  output_asset_id uuid;
  candidate_id uuid;
begin
  if output_path is null or length(trim(output_path)) = 0 then
    raise exception 'output_path is required';
  end if;

  select *
  into target_job
  from public.fabric_render_jobs
  where id = job_id
    and status = 'processing';

  if target_job.id is null then
    raise exception 'Fabric render job % is not processing', job_id;
  end if;

  insert into public.storage_assets (
    bucket_id,
    object_path,
    visibility,
    lifecycle_state,
    asset_kind,
    content_type,
    byte_size,
    width_px,
    height_px
  )
  values (
    'catalog-private-assets',
    output_path,
    'private',
    'active',
    'fabric_render_candidate',
    'image/png',
    68,
    1,
    1
  )
  on conflict (bucket_id, object_path) do update set
    visibility = excluded.visibility,
    lifecycle_state = excluded.lifecycle_state,
    asset_kind = excluded.asset_kind,
    content_type = excluded.content_type,
    byte_size = excluded.byte_size,
    width_px = excluded.width_px,
    height_px = excluded.height_px
  returning id into output_asset_id;

  insert into public.fabric_render_candidates (
    job_id,
    render_cell_id,
    asset_id,
    generation_mode,
    refinement_source_asset_id,
    provider_name,
    provider_model,
    prompt_version,
    sofa_id,
    fabric_id,
    visual_matrix_column_id
  )
  values (
    target_job.id,
    target_job.render_cell_id,
    output_asset_id,
    target_job.generation_mode,
    target_job.refinement_source_asset_id,
    target_job.provider_name,
    target_job.provider_model,
    target_job.prompt_version,
    target_job.sofa_id,
    target_job.fabric_id,
    target_job.visual_matrix_column_id
  )
  returning id into candidate_id;

  update public.fabric_render_jobs
  set
    status = 'succeeded',
    claimed_by = null,
    claim_expires_at = null,
    last_error_message = null,
    completed_at = now(),
    updated_at = now()
  where id = target_job.id;

  update public.sofa_render_cells
  set
    current_private_asset_id = output_asset_id,
    accepted_fabric_render_candidate_id = candidate_id,
    updated_at = now()
  where id = target_job.render_cell_id;

  return jsonb_build_object(
    'status', 'succeeded',
    'job_id', target_job.id,
    'output_path', output_path,
    'asset_id', output_asset_id,
    'candidate_id', candidate_id
  );
end;
$$;

create or replace function public.fabric_render_worker_fail(
  job_id uuid,
  error_message text,
  retryable boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  updated_job public.fabric_render_jobs%rowtype;
  next_status public.fabric_render_job_status;
begin
  if error_message is null or length(trim(error_message)) = 0 then
    raise exception 'error_message is required';
  end if;

  select
    case
      when retryable and attempt_count < max_attempts then 'queued'::public.fabric_render_job_status
      else 'failed'::public.fabric_render_job_status
    end
  into next_status
  from public.fabric_render_jobs
  where id = job_id
    and status = 'processing';

  if next_status is null then
    raise exception 'Fabric render job % is not processing', job_id;
  end if;

  update public.fabric_render_jobs
  set
    status = next_status,
    claimed_by = null,
    claimed_at = case when next_status = 'queued' then null else claimed_at end,
    claim_expires_at = null,
    last_error_message = error_message,
    completed_at = case when next_status = 'failed' then now() else completed_at end,
    updated_at = now()
  where id = job_id
  returning * into updated_job;

  if updated_job.status = 'queued' then
    perform pgmq.send(
      'local_fabric_render_jobs',
      jsonb_build_object(
        'job_id', updated_job.id,
        'type', 'fabric_render_generation'
      )
    );
  end if;

  return jsonb_build_object(
    'status', updated_job.status,
    'job_id', updated_job.id,
    'last_error_message', updated_job.last_error_message
  );
end;
$$;

grant execute on function public.fabric_render_worker_seed_mock_job(text) to service_role;
grant execute on function public.fabric_render_worker_claim_next(text, text, integer) to service_role;
grant execute on function public.fabric_render_worker_succeed(uuid, text) to service_role;
grant execute on function public.fabric_render_worker_fail(uuid, text, boolean) to service_role;
