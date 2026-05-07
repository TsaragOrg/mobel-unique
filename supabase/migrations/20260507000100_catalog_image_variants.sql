-- PLAN-0067 Catalog Image Variant Delivery
--
-- Stored small and medium variants are durable catalog assets. Browser-facing
-- read paths must only expose variants when both the original asset and the
-- requested variant asset are active.

create table if not exists public.storage_asset_variants (
  original_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  variant_kind text not null,
  variant_asset_id uuid not null references public.storage_assets (id) on delete restrict,
  generation_kind text not null default 'stored',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (original_asset_id, variant_kind),
  constraint storage_asset_variants_kind_check
    check (variant_kind in ('small', 'medium')),
  constraint storage_asset_variants_generation_kind_check
    check (generation_kind in ('stored')),
  constraint storage_asset_variants_not_self_check
    check (original_asset_id <> variant_asset_id)
);

create unique index if not exists storage_asset_variants_variant_asset_id_unique_idx
  on public.storage_asset_variants (variant_asset_id);

create index if not exists storage_asset_variants_original_kind_idx
  on public.storage_asset_variants (original_asset_id, variant_kind);

create index if not exists storage_asset_variants_variant_asset_lookup_idx
  on public.storage_asset_variants (variant_asset_id);

drop trigger if exists storage_asset_variants_set_updated_at_trigger
  on public.storage_asset_variants;

create trigger storage_asset_variants_set_updated_at_trigger
before update on public.storage_asset_variants
for each row
execute function public.set_updated_at();

alter table public.storage_asset_variants enable row level security;

revoke all on table public.storage_asset_variants from anon, authenticated;
grant select, insert, update on public.storage_asset_variants to service_role;

drop policy if exists spec_0067_service_role_all_storage_asset_variants
  on public.storage_asset_variants;

create policy spec_0067_service_role_all_storage_asset_variants
on public.storage_asset_variants
for all
to service_role
using (true)
with check (true);

create or replace function public.deactivate_storage_asset_variants(
  original_asset_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_original public.storage_assets%rowtype;
  affected_count integer := 0;
begin
  select *
  into target_original
  from public.storage_assets
  where id = original_asset_id;

  if target_original.id is null or target_original.lifecycle_state = 'active' then
    return 0;
  end if;

  update public.storage_assets variant_asset
  set
    lifecycle_state = case
      when target_original.lifecycle_state = 'purged' then 'purged'::public.asset_lifecycle_state
      else 'deleted'::public.asset_lifecycle_state
    end,
    deleted_at = coalesce(
      variant_asset.deleted_at,
      target_original.deleted_at,
      now()
    ),
    purged_at = case
      when target_original.lifecycle_state = 'purged' then coalesce(
        variant_asset.purged_at,
        target_original.purged_at,
        now()
      )
      else variant_asset.purged_at
    end
  from public.storage_asset_variants variant_link
  where variant_link.original_asset_id = target_original.id
    and variant_link.variant_asset_id = variant_asset.id
    and variant_asset.lifecycle_state = 'active';

  get diagnostics affected_count = row_count;

  return affected_count;
end;
$$;

create or replace function public.storage_assets_deactivate_variants_on_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lifecycle_state <> 'active'
    or new.deleted_at is not null
    or new.purged_at is not null
  then
    perform public.deactivate_storage_asset_variants(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists storage_assets_deactivate_variants_trigger
  on public.storage_assets;

create trigger storage_assets_deactivate_variants_trigger
after update of lifecycle_state, deleted_at, purged_at
on public.storage_assets
for each row
when (
  old.lifecycle_state is distinct from new.lifecycle_state
  or old.deleted_at is distinct from new.deleted_at
  or old.purged_at is distinct from new.purged_at
)
execute function public.storage_assets_deactivate_variants_on_lifecycle();

drop view if exists public.public_sofa_render_cells;

create or replace view public.public_sofa_render_cells
with (security_barrier = true)
as
select
  rc.sofa_id,
  rc.fabric_id,
  rc.visual_matrix_column_id,
  rc.id as render_cell_id,
  original_asset.id as render_original_asset_id,
  original_asset.object_path as render_original_object_path,
  original_asset.content_type as render_original_content_type,
  original_asset.width_px as render_original_width_px,
  original_asset.height_px as render_original_height_px,
  medium_asset.id as render_medium_asset_id,
  medium_asset.object_path as render_medium_object_path,
  medium_asset.content_type as render_medium_content_type,
  medium_asset.width_px as render_medium_width_px,
  medium_asset.height_px as render_medium_height_px,
  medium_asset.object_path as public_render_object_path,
  medium_asset.content_type as public_render_content_type,
  medium_asset.width_px as public_render_width_px,
  medium_asset.height_px as public_render_height_px
from public.sofa_render_cells rc
join public.sofas s
  on s.id = rc.sofa_id
  and s.lifecycle_state = 'published'
join public.sofa_fabrics sf
  on sf.sofa_id = rc.sofa_id
  and sf.fabric_id = rc.fabric_id
  and sf.public_order is not null
join public.fabrics f
  on f.id = rc.fabric_id
  and f.lifecycle_state = 'active'
join public.visual_matrix_columns vm
  on vm.id = rc.visual_matrix_column_id
  and vm.sofa_id = rc.sofa_id
  and vm.deleted_at is null
join public.storage_assets original_asset
  on original_asset.id = rc.current_public_asset_id
  and original_asset.visibility = 'public'
  and original_asset.lifecycle_state = 'active'
  and original_asset.bucket_id = 'catalog-public-assets'
join public.storage_asset_variants medium_variant
  on medium_variant.original_asset_id = original_asset.id
  and medium_variant.variant_kind = 'medium'
join public.storage_assets medium_asset
  on medium_asset.id = medium_variant.variant_asset_id
  and medium_asset.visibility = 'public'
  and medium_asset.lifecycle_state = 'active'
  and medium_asset.bucket_id = 'catalog-public-assets';

revoke all on table public.public_sofa_render_cells from anon, authenticated;
grant select on public.public_sofa_render_cells to anon, authenticated;

drop function if exists public.fabric_render_worker_succeed(uuid, text);
drop function if exists public.fabric_render_worker_succeed(uuid, text, bigint, integer, integer, text);

create or replace function public.fabric_render_worker_succeed(
  job_id uuid,
  output_path text,
  output_byte_size bigint default 68,
  output_width_px integer default 1,
  output_height_px integer default 1,
  output_content_type text default 'image/png',
  p_output_variants jsonb default '[]'::jsonb
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
  variant_count integer;
  variant_kind_count integer;
  variants_are_expected_kinds boolean;
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

  p_output_variants := coalesce(p_output_variants, '[]'::jsonb);

  if jsonb_typeof(p_output_variants) <> 'array' then
    raise exception 'p_output_variants must be an array';
  end if;

  with parsed_variants as (
    select
      variant.value ->> 'variant_kind' as variant_kind
    from jsonb_array_elements(p_output_variants) as variant(value)
  )
  select
    count(*),
    count(distinct variant_kind),
    bool_and(variant_kind in ('small', 'medium'))
  into variant_count, variant_kind_count, variants_are_expected_kinds
  from parsed_variants;

  if variant_count <> 2
    or variant_kind_count <> 2
    or variants_are_expected_kinds is distinct from true
  then
    raise exception 'p_output_variants must include small and medium variants';
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

  with parsed_variants as (
    select
      (variant.value ->> 'variant_asset_id')::uuid as variant_asset_id,
      variant.value ->> 'variant_kind' as variant_kind,
      variant.value ->> 'object_path' as object_path,
      variant.value ->> 'content_type' as content_type,
      (variant.value ->> 'byte_size')::bigint as byte_size,
      (variant.value ->> 'width_px')::integer as width_px,
      (variant.value ->> 'height_px')::integer as height_px
    from jsonb_array_elements(p_output_variants) as variant(value)
  )
  insert into public.storage_assets (
    id,
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
  select
    parsed_variants.variant_asset_id,
    'catalog-private-assets',
    parsed_variants.object_path,
    'private',
    'active',
    'fabric_render_candidate_variant',
    parsed_variants.content_type,
    parsed_variants.byte_size,
    parsed_variants.width_px,
    parsed_variants.height_px
  from parsed_variants
  on conflict (id) do update set
    bucket_id = excluded.bucket_id,
    object_path = excluded.object_path,
    visibility = excluded.visibility,
    lifecycle_state = excluded.lifecycle_state,
    asset_kind = excluded.asset_kind,
    content_type = excluded.content_type,
    byte_size = excluded.byte_size,
    width_px = excluded.width_px,
    height_px = excluded.height_px;

  with parsed_variants as (
    select
      (variant.value ->> 'variant_asset_id')::uuid as variant_asset_id,
      variant.value ->> 'variant_kind' as variant_kind
    from jsonb_array_elements(p_output_variants) as variant(value)
  )
  insert into public.storage_asset_variants (
    original_asset_id,
    variant_kind,
    variant_asset_id,
    generation_kind
  )
  select
    output_asset_id,
    parsed_variants.variant_kind,
    parsed_variants.variant_asset_id,
    'stored'
  from parsed_variants
  on conflict (original_asset_id, variant_kind) do update set
    variant_asset_id = excluded.variant_asset_id,
    generation_kind = excluded.generation_kind,
    updated_at = now();

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
    'candidate_id', candidate_id,
    'variants', (
      select jsonb_object_agg(variant.value ->> 'variant_kind', variant.value ->> 'variant_asset_id')
      from jsonb_array_elements(p_output_variants) as variant(value)
    )
  );
end;
$$;

grant execute on function public.deactivate_storage_asset_variants(uuid) to service_role;
grant execute on function public.fabric_render_worker_succeed(
  uuid,
  text,
  bigint,
  integer,
  integer,
  text,
  jsonb
) to service_role;
