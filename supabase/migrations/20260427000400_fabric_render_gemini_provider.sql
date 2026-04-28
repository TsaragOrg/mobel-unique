-- PLAN-0010 real provider support.
--
-- Final private output path shape:
-- renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png
--
-- Input dimension guard shape: greatest(asset.width_px, asset.height_px) <= 2048.

create or replace function public.fabric_render_worker_resolve_inputs(
  job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
declare
  target_job public.fabric_render_jobs%rowtype;
  target_sofa_asset public.storage_assets%rowtype;
  fabric_reference_asset public.storage_assets%rowtype;
  refinement_source_asset public.storage_assets%rowtype;
begin
  select *
  into target_job
  from public.fabric_render_jobs as frj
  where frj.id = $1
    and frj.status = 'processing';

  if target_job.id is null then
    raise exception 'Fabric render job % is not processing', $1;
  end if;

  select *
  into target_sofa_asset
  from public.storage_assets as sa
  where sa.id = target_job.target_sofa_asset_id;

  select *
  into fabric_reference_asset
  from public.storage_assets as sa
  where sa.id = target_job.fabric_ai_reference_asset_id;

  if target_job.generation_mode = 'refine' then
    if target_job.refinement_source_asset_id is null then
      raise exception 'refinement source is required for refine mode';
    end if;

    select *
    into refinement_source_asset
    from public.storage_assets as sa
    where sa.id = target_job.refinement_source_asset_id;
  elsif target_job.refinement_source_asset_id is not null then
    raise exception 'refinement source is not allowed for initial mode';
  end if;

  perform public.fabric_render_worker_validate_input_asset(
    target_sofa_asset,
    'target sofa'
  );
  perform public.fabric_render_worker_validate_input_asset(
    fabric_reference_asset,
    'fabric reference'
  );

  if target_job.generation_mode = 'refine' then
    perform public.fabric_render_worker_validate_input_asset(
      refinement_source_asset,
      'refinement source'
    );
  end if;

  return jsonb_build_object(
    'status', 'resolved',
    'job_id', target_job.id,
    'sofa_id', target_job.sofa_id,
    'fabric_id', target_job.fabric_id,
    'visual_matrix_column_id', target_job.visual_matrix_column_id,
    'render_cell_id', target_job.render_cell_id,
    'generation_mode', target_job.generation_mode,
    'prompt_note', target_job.prompt_note,
    'provider_name', target_job.provider_name,
    'provider_model', target_job.provider_model,
    'prompt_version', target_job.prompt_version,
    'target_sofa', public.fabric_render_worker_asset_json(target_sofa_asset),
    'fabric_reference', public.fabric_render_worker_asset_json(fabric_reference_asset),
    'refinement_source',
      case
        when target_job.generation_mode = 'refine'
          then public.fabric_render_worker_asset_json(refinement_source_asset)
        else null
      end
  );
end;
$$;

create or replace function public.fabric_render_worker_validate_input_asset(
  asset public.storage_assets,
  label text
)
returns void
language plpgsql
security definer
set search_path = public, pgmq, extensions
as $$
begin
  if asset.id is null then
    raise exception '% asset is missing', label;
  end if;

  if asset.visibility <> 'private' then
    raise exception '% asset must be private', label;
  end if;

  if asset.lifecycle_state <> 'active' then
    raise exception '% asset must be active', label;
  end if;

  if asset.bucket_id <> 'catalog-private-assets' then
    raise exception '% asset must be in catalog-private-assets', label;
  end if;

  if asset.content_type not in ('image/jpeg', 'image/jpg', 'image/png') then
    raise exception '% asset content type is unsupported: %',
      label,
      asset.content_type;
  end if;

  if asset.width_px is null or asset.height_px is null then
    raise exception '% width and height are required', label;
  end if;

  if asset.width_px <= 0 or asset.height_px <= 0 then
    raise exception '% width and height must be positive', label;
  end if;

  if not (greatest(asset.width_px, asset.height_px) <= 2048) then
    raise exception '% exceeds 2048 px on the longest edge', label;
  end if;
end;
$$;

create or replace function public.fabric_render_worker_asset_json(
  asset public.storage_assets
)
returns jsonb
language sql
security definer
set search_path = public, pgmq, extensions
as $$
  select jsonb_build_object(
    'asset_id', asset.id,
    'bucket_id', asset.bucket_id,
    'object_path', asset.object_path,
    'content_type', asset.content_type,
    'byte_size', asset.byte_size,
    'width_px', asset.width_px,
    'height_px', asset.height_px
  );
$$;

drop function if exists public.fabric_render_worker_succeed(uuid, text);

create or replace function public.fabric_render_worker_succeed(
  job_id uuid,
  output_path text,
  output_byte_size bigint default 68,
  output_width_px integer default 1,
  output_height_px integer default 1,
  output_content_type text default 'image/png'
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

  if output_byte_size is null or output_byte_size <= 0 then
    raise exception 'output_byte_size must be positive';
  end if;

  if output_width_px is null or output_width_px <= 0 then
    raise exception 'output_width_px must be positive';
  end if;

  if output_height_px is null or output_height_px <= 0 then
    raise exception 'output_height_px must be positive';
  end if;

  select *
  into target_job
  from public.fabric_render_jobs as frj
  where frj.id = $1
    and frj.status = 'processing';

  if target_job.id is null then
    raise exception 'Fabric render job % is not processing', $1;
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
    output_content_type,
    output_byte_size,
    output_width_px,
    output_height_px
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
    visual_matrix_column_id,
    accepted_at
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
    target_job.visual_matrix_column_id,
    null
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

  return jsonb_build_object(
    'status', 'succeeded',
    'job_id', target_job.id,
    'output_path', output_path,
    'asset_id', output_asset_id,
    'candidate_id', candidate_id
  );
end;
$$;

grant execute on function public.fabric_render_worker_resolve_inputs(uuid) to service_role;
grant execute on function public.fabric_render_worker_validate_input_asset(public.storage_assets, text) to service_role;
grant execute on function public.fabric_render_worker_asset_json(public.storage_assets) to service_role;
grant execute on function public.fabric_render_worker_succeed(uuid, text, bigint, integer, integer, text) to service_role;
