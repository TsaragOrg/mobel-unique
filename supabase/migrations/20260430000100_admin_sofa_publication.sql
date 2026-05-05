create or replace function public.sofa_publication_readiness_errors(p_sofa_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  sofa record;
  errors text[] := array[]::text[];
  active_column_count integer;
  public_fabric_count integer;
  missing_render_count integer;
  missing_swatch_count integer;
begin
  select *
  into sofa
  from public.sofas
  where id = p_sofa_id;

  if sofa.id is null then
    return array['sofa_not_found'];
  end if;

  if sofa.public_name is null or length(btrim(sofa.public_name)) = 0 then
    errors := array_append(errors, 'missing_public_name');
  end if;

  if sofa.shopify_order_url is null
    or sofa.shopify_order_url !~* '^https?://'
  then
    errors := array_append(errors, 'missing_or_invalid_shopify_order_url');
  end if;

  if sofa.first_published_at is not null and sofa.public_slug is null then
    errors := array_append(errors, 'missing_frozen_public_slug');
  end if;

  select count(*)
  into active_column_count
  from public.visual_matrix_columns
  where sofa_id = p_sofa_id
    and deleted_at is null;

  if active_column_count = 0 then
    errors := array_append(errors, 'missing_active_visual_position');
  end if;

  select count(*)
  into public_fabric_count
  from public.sofa_fabrics sf
  join public.fabrics f on f.id = sf.fabric_id
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and f.lifecycle_state = 'active';

  if public_fabric_count = 0 then
    errors := array_append(errors, 'missing_public_fabric');
  end if;

  select count(*)
  into missing_render_count
  from public.sofa_fabrics sf
  join public.fabrics f
    on f.id = sf.fabric_id
    and f.lifecycle_state = 'active'
  cross join public.visual_matrix_columns vm
  left join public.sofa_render_cells rc
    on rc.sofa_id = sf.sofa_id
    and rc.fabric_id = sf.fabric_id
    and rc.visual_matrix_column_id = vm.id
  left join public.storage_assets private_asset
    on private_asset.id = rc.current_private_asset_id
    and private_asset.lifecycle_state = 'active'
    and private_asset.visibility = 'private'
  left join public.storage_assets public_asset
    on public_asset.id = rc.current_public_asset_id
    and public_asset.lifecycle_state = 'active'
    and public_asset.visibility = 'public'
    and public_asset.bucket_id = 'catalog-public-assets'
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and vm.sofa_id = p_sofa_id
    and vm.deleted_at is null
    and (
      rc.id is null
      or private_asset.id is null
      or (sofa.lifecycle_state = 'published' and public_asset.id is null)
    );

  if missing_render_count > 0 then
    errors := array_append(errors, 'incomplete_public_render_coverage');
  end if;

  select count(*)
  into missing_swatch_count
  from public.sofa_fabrics sf
  join public.fabrics f
    on f.id = sf.fabric_id
    and f.lifecycle_state = 'active'
  left join public.storage_assets swatch_asset
    on swatch_asset.id = f.swatch_asset_id
    and swatch_asset.lifecycle_state = 'active'
    and swatch_asset.visibility = 'public'
    and swatch_asset.bucket_id = 'catalog-public-assets'
  where sf.sofa_id = p_sofa_id
    and sf.public_order is not null
    and swatch_asset.id is null;

  if missing_swatch_count > 0 then
    errors := array_append(errors, 'missing_public_swatch_asset');
  end if;

  return errors;
end;
$$;

create or replace function public.admin_publish_sofa(
  p_sofa_id uuid,
  p_public_render_assets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sofa public.sofas%rowtype;
  readiness_errors text[];
  required_render_count integer;
  mapped_render_count integer;
  distinct_mapped_render_count integer;
  published_sofa public.sofas%rowtype;
begin
  select *
  into target_sofa
  from public.sofas
  where id = p_sofa_id
  for update;

  if target_sofa.id is null then
    raise exception 'sofa was not found' using errcode = 'P0002';
  end if;

  if target_sofa.lifecycle_state = 'archived' then
    raise exception 'archived sofas cannot be published' using errcode = '23514';
  end if;

  readiness_errors := public.sofa_publication_readiness_errors(p_sofa_id);

  if array_length(readiness_errors, 1) is not null then
    raise exception 'sofa is not ready for publication: %', array_to_string(readiness_errors, ', ')
      using errcode = '23514';
  end if;

  with required_cells as (
    select rc.id, rc.current_private_asset_id
    from public.sofa_fabrics sf
    join public.fabrics f
      on f.id = sf.fabric_id
      and f.lifecycle_state = 'active'
    join public.visual_matrix_columns vm
      on vm.sofa_id = sf.sofa_id
      and vm.deleted_at is null
    join public.sofa_render_cells rc
      on rc.sofa_id = sf.sofa_id
      and rc.fabric_id = sf.fabric_id
      and rc.visual_matrix_column_id = vm.id
    join public.storage_assets private_asset
      on private_asset.id = rc.current_private_asset_id
      and private_asset.visibility = 'private'
      and private_asset.lifecycle_state = 'active'
    where sf.sofa_id = p_sofa_id
      and sf.public_order is not null
  )
  select count(*)
  into required_render_count
  from required_cells;

  with required_cells as (
    select rc.id, rc.current_private_asset_id
    from public.sofa_fabrics sf
    join public.fabrics f
      on f.id = sf.fabric_id
      and f.lifecycle_state = 'active'
    join public.visual_matrix_columns vm
      on vm.sofa_id = sf.sofa_id
      and vm.deleted_at is null
    join public.sofa_render_cells rc
      on rc.sofa_id = sf.sofa_id
      and rc.fabric_id = sf.fabric_id
      and rc.visual_matrix_column_id = vm.id
    join public.storage_assets private_asset
      on private_asset.id = rc.current_private_asset_id
      and private_asset.visibility = 'private'
      and private_asset.lifecycle_state = 'active'
    where sf.sofa_id = p_sofa_id
      and sf.public_order is not null
  ),
  mappings as (
    select *
    from jsonb_to_recordset(coalesce(p_public_render_assets, '[]'::jsonb)) as asset(
      render_cell_id uuid,
      private_asset_id uuid,
      public_asset_id uuid,
      object_path text,
      content_type text,
      byte_size bigint,
      width_px integer,
      height_px integer
    )
  ),
  valid_mappings as (
    select m.*
    from mappings m
    join required_cells rc
      on rc.id = m.render_cell_id
      and rc.current_private_asset_id = m.private_asset_id
    join public.storage_assets private_asset
      on private_asset.id = m.private_asset_id
      and private_asset.visibility = 'private'
      and private_asset.lifecycle_state = 'active'
  )
  select count(*), count(distinct render_cell_id)
  into mapped_render_count, distinct_mapped_render_count
  from valid_mappings;

  if mapped_render_count <> required_render_count
    or distinct_mapped_render_count <> required_render_count
  then
    raise exception 'public render asset mappings do not match required render coverage'
      using errcode = '23514';
  end if;

  with required_cells as (
    select rc.id, rc.current_private_asset_id
    from public.sofa_fabrics sf
    join public.fabrics f
      on f.id = sf.fabric_id
      and f.lifecycle_state = 'active'
    join public.visual_matrix_columns vm
      on vm.sofa_id = sf.sofa_id
      and vm.deleted_at is null
    join public.sofa_render_cells rc
      on rc.sofa_id = sf.sofa_id
      and rc.fabric_id = sf.fabric_id
      and rc.visual_matrix_column_id = vm.id
    join public.storage_assets private_asset
      on private_asset.id = rc.current_private_asset_id
      and private_asset.visibility = 'private'
      and private_asset.lifecycle_state = 'active'
    where sf.sofa_id = p_sofa_id
      and sf.public_order is not null
  ),
  mappings as (
    select *
    from jsonb_to_recordset(coalesce(p_public_render_assets, '[]'::jsonb)) as asset(
      render_cell_id uuid,
      private_asset_id uuid,
      public_asset_id uuid,
      object_path text,
      content_type text,
      byte_size bigint,
      width_px integer,
      height_px integer
    )
  ),
  valid_mappings as (
    select m.*
    from mappings m
    join required_cells rc
      on rc.id = m.render_cell_id
      and rc.current_private_asset_id = m.private_asset_id
  ),
  inserted_assets as (
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
      m.public_asset_id,
      'catalog-public-assets',
      m.object_path,
      'public',
      'active',
      'published_sofa_render',
      m.content_type,
      m.byte_size,
      m.width_px,
      m.height_px
    from valid_mappings m
    on conflict (id) do update set
      bucket_id = excluded.bucket_id,
      object_path = excluded.object_path,
      visibility = excluded.visibility,
      lifecycle_state = excluded.lifecycle_state,
      asset_kind = excluded.asset_kind,
      content_type = excluded.content_type,
      byte_size = excluded.byte_size,
      width_px = excluded.width_px,
      height_px = excluded.height_px
    returning id
  )
  update public.sofa_render_cells rc
  set
    current_public_asset_id = m.public_asset_id,
    updated_at = now()
  from valid_mappings m
  where rc.id = m.render_cell_id
    and rc.sofa_id = p_sofa_id
    and rc.current_private_asset_id = m.private_asset_id;

  update public.sofas
  set
    lifecycle_state = 'published',
    updated_at = now()
  where id = p_sofa_id
  returning *
  into published_sofa;

  return jsonb_build_object(
    'sofa_id', published_sofa.id,
    'lifecycle_state', published_sofa.lifecycle_state,
    'public_slug', published_sofa.public_slug,
    'published_at', published_sofa.published_at
  );
end;
$$;

create or replace function public.admin_unpublish_sofa(p_sofa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sofa public.sofas%rowtype;
  unpublished_sofa public.sofas%rowtype;
begin
  select *
  into target_sofa
  from public.sofas
  where id = p_sofa_id
  for update;

  if target_sofa.id is null then
    raise exception 'sofa was not found' using errcode = 'P0002';
  end if;

  if target_sofa.lifecycle_state = 'archived' then
    raise exception 'archived sofas cannot be unpublished' using errcode = '23514';
  end if;

  update public.sofa_render_cells
  set
    current_public_asset_id = null,
    updated_at = now()
  where sofa_id = p_sofa_id;

  update public.sofas
  set
    lifecycle_state = 'draft',
    published_at = null,
    updated_at = now()
  where id = p_sofa_id
  returning *
  into unpublished_sofa;

  return jsonb_build_object(
    'sofa_id', unpublished_sofa.id,
    'lifecycle_state', unpublished_sofa.lifecycle_state,
    'public_slug', unpublished_sofa.public_slug
  );
end;
$$;

grant execute on function public.admin_publish_sofa(uuid, jsonb) to service_role;
grant execute on function public.admin_unpublish_sofa(uuid) to service_role;
