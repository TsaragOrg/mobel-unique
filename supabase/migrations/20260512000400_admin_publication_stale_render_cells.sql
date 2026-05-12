-- PLAN-0088 Admin Publication Stale Render Cell Resilience
--
-- Unpublish and archive remove public visibility. They must not fail because
-- stale private render-cell rows, already outside the public read model, no
-- longer satisfy normal editing validation.

create or replace function public.validate_sofa_render_cell()
returns trigger
language plpgsql
as $$
declare
  private_asset record;
  public_asset record;
  source_photo record;
  candidate record;
begin
  if tg_op = 'UPDATE'
    and old.current_public_asset_id is not null
    and new.current_public_asset_id is null
    and new.id is not distinct from old.id
    and new.sofa_id is not distinct from old.sofa_id
    and new.fabric_id is not distinct from old.fabric_id
    and new.visual_matrix_column_id is not distinct from old.visual_matrix_column_id
    and new.current_private_asset_id is not distinct from old.current_private_asset_id
    and new.source_type is not distinct from old.source_type
    and new.source_photo_id is not distinct from old.source_photo_id
    and new.accepted_fabric_render_candidate_id is not distinct from old.accepted_fabric_render_candidate_id
  then
    return new;
  end if;

  if not exists (
    select 1
    from public.sofa_fabrics
    where sofa_id = new.sofa_id
      and fabric_id = new.fabric_id
  ) then
    raise exception 'render cell fabric must be assigned to the sofa'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.visual_matrix_columns
    where id = new.visual_matrix_column_id
      and sofa_id = new.sofa_id
  ) then
    raise exception 'render cell visual matrix column must belong to the sofa'
      using errcode = '23514';
  end if;

  if new.current_private_asset_id is not null then
    select visibility, lifecycle_state
    into private_asset
    from public.storage_assets
    where id = new.current_private_asset_id;

    if private_asset.visibility <> 'private' or private_asset.lifecycle_state <> 'active' then
      raise exception 'render cell private asset must be active and private'
        using errcode = '23514';
    end if;
  end if;

  if new.current_public_asset_id is not null then
    select visibility, lifecycle_state, bucket_id
    into public_asset
    from public.storage_assets
    where id = new.current_public_asset_id;

    if public_asset.visibility <> 'public'
      or public_asset.lifecycle_state <> 'active'
      or public_asset.bucket_id <> 'catalog-public-assets'
    then
      raise exception 'render cell public asset must be active and public'
        using errcode = '23514';
    end if;
  end if;

  if new.source_photo_id is not null then
    select sofa_id, visual_matrix_column_id, original_fabric_id
    into source_photo
    from public.sofa_source_photos
    where id = new.source_photo_id;

    if source_photo.sofa_id <> new.sofa_id
      or source_photo.visual_matrix_column_id <> new.visual_matrix_column_id
    then
      raise exception 'render cell source photo must match sofa and visual matrix column'
        using errcode = '23514';
    end if;

    if new.source_type = 'source_photo' and source_photo.original_fabric_id <> new.fabric_id then
      raise exception 'source-photo render cells must use the source photo original fabric'
        using errcode = '23514';
    end if;
  end if;

  if new.accepted_fabric_render_candidate_id is not null then
    select render_cell_id, asset_id, accepted_at
    into candidate
    from public.fabric_render_candidates
    where id = new.accepted_fabric_render_candidate_id;

    if candidate.render_cell_id <> new.id or candidate.asset_id <> new.current_private_asset_id then
      raise exception 'accepted candidate must match render cell and current private asset'
        using errcode = '23514';
    end if;
  end if;

  return new;
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
  where sofa_id = p_sofa_id
    and current_public_asset_id is not null;

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

create or replace function public.admin_archive_sofa(p_sofa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sofa public.sofas%rowtype;
  archived_sofa public.sofas%rowtype;
begin
  select *
  into target_sofa
  from public.sofas
  where id = p_sofa_id
  for update;

  if target_sofa.id is null then
    raise exception 'sofa was not found' using errcode = 'P0002';
  end if;

  update public.sofa_render_cells
  set
    current_public_asset_id = null,
    updated_at = now()
  where sofa_id = p_sofa_id
    and current_public_asset_id is not null;

  update public.sofas
  set
    lifecycle_state = 'archived',
    published_at = null,
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where id = p_sofa_id
  returning *
  into archived_sofa;

  return jsonb_build_object(
    'sofa_id', archived_sofa.id,
    'lifecycle_state', archived_sofa.lifecycle_state,
    'public_slug', archived_sofa.public_slug,
    'archived_at', archived_sofa.archived_at
  );
end;
$$;

revoke all on function public.admin_unpublish_sofa(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_archive_sofa(uuid)
  from public, anon, authenticated;

grant execute on function public.admin_unpublish_sofa(uuid) to service_role;
grant execute on function public.admin_archive_sofa(uuid) to service_role;
