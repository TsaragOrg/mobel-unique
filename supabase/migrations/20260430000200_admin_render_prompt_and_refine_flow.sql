-- PLAN-0030 admin render prompt and refine flow.
-- Admin-created refine jobs persist their own prompt and keep provider ownership in the worker.

alter table public.fabric_render_jobs
  add column if not exists refine_prompt text;

alter table public.fabric_render_jobs
  drop constraint if exists fabric_render_jobs_refine_prompt_mode_check;

alter table public.fabric_render_jobs
  add constraint fabric_render_jobs_refine_prompt_mode_check check (
    (
      generation_mode = 'initial'
      and refinement_source_asset_id is null
      and refine_prompt is null
    )
    or (
      generation_mode = 'refine'
      and refinement_source_asset_id is not null
      and prompt_note is null
      and refine_prompt is not null
      and length(btrim(refine_prompt)) > 0
    )
  );

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
    coalesce(prompt_note, ''),
    coalesce(refine_prompt, '')
  )
  where status in ('queued', 'processing');

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

    if target_job.refine_prompt is null or length(btrim(target_job.refine_prompt)) = 0 then
      raise exception 'refine prompt is required for refine mode';
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
    'refine_prompt', target_job.refine_prompt,
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

grant execute on function public.fabric_render_worker_resolve_inputs(uuid) to service_role;
