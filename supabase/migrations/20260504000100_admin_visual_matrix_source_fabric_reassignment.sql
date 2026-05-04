create or replace function public.admin_update_visual_matrix_column_source_fabric(
  p_column_id uuid,
  p_update_sequence boolean,
  p_sequence integer,
  p_update_admin_label boolean,
  p_admin_label text,
  p_update_public_label boolean,
  p_public_label text,
  p_source_original_fabric_id uuid
)
returns public.visual_matrix_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  column_row public.visual_matrix_columns%rowtype;
  previous_original_fabric_id uuid;
  source_photo_row public.sofa_source_photos%rowtype;
begin
  if p_column_id is null then
    raise exception 'p_column_id is required' using errcode = '23514';
  end if;

  if p_source_original_fabric_id is null then
    raise exception 'p_source_original_fabric_id is required' using errcode = '23514';
  end if;

  select *
  into column_row
  from public.visual_matrix_columns
  where id = p_column_id
  for update;

  if column_row.id is null or column_row.deleted_at is not null then
    raise exception 'visual matrix column was not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.sofas
    where id = column_row.sofa_id
      and lifecycle_state = 'draft'
  ) then
    raise exception 'only draft sofa visual matrix columns can be edited'
      using errcode = '23514';
  end if;

  if p_update_sequence and (p_sequence is null or p_sequence <= 0) then
    raise exception 'sequence must be positive' using errcode = '23514';
  end if;

  if p_update_admin_label
    and p_admin_label is not null
    and length(btrim(p_admin_label)) = 0
  then
    raise exception 'admin_label cannot be blank' using errcode = '23514';
  end if;

  if p_update_public_label
    and p_public_label is not null
    and length(btrim(p_public_label)) = 0
  then
    raise exception 'public_label cannot be blank' using errcode = '23514';
  end if;

  if column_row.current_source_photo_id is null then
    raise exception 'current source photo is required before changing source fabric'
      using errcode = '23514';
  end if;

  select *
  into source_photo_row
  from public.sofa_source_photos
  where id = column_row.current_source_photo_id
  for update;

  if source_photo_row.id is null then
    raise exception 'visual matrix column source photo was not found'
      using errcode = 'P0002';
  end if;

  if source_photo_row.sofa_id <> column_row.sofa_id
    or source_photo_row.visual_matrix_column_id <> column_row.id
  then
    raise exception 'source photo must belong to the visual matrix column'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.sofa_fabrics
    where sofa_id = column_row.sofa_id
      and fabric_id = p_source_original_fabric_id
  ) then
    raise exception 'source fabric must be assigned to the sofa'
      using errcode = '23514';
  end if;

  update public.visual_matrix_columns
  set
    sequence = case when p_update_sequence then p_sequence else sequence end,
    admin_label = case when p_update_admin_label then p_admin_label else admin_label end,
    public_label = case when p_update_public_label then p_public_label else public_label end
  where id = p_column_id
  returning * into column_row;

  previous_original_fabric_id := source_photo_row.original_fabric_id;

  if previous_original_fabric_id <> p_source_original_fabric_id then
    update public.sofa_source_photos
    set original_fabric_id = p_source_original_fabric_id
    where id = source_photo_row.id
    returning * into source_photo_row;

    update public.sofa_render_cells
    set
      accepted_fabric_render_candidate_id = null,
      current_private_asset_id = null,
      source_photo_id = null,
      source_type = 'ai_generated',
      updated_at = now()
    where sofa_id = source_photo_row.sofa_id
      and fabric_id = previous_original_fabric_id
      and visual_matrix_column_id = source_photo_row.visual_matrix_column_id
      and source_photo_id = source_photo_row.id;
  end if;

  insert into public.sofa_render_cells (
    accepted_fabric_render_candidate_id,
    current_private_asset_id,
    fabric_id,
    sofa_id,
    source_photo_id,
    source_type,
    updated_at,
    visual_matrix_column_id
  )
  values (
    null,
    source_photo_row.asset_id,
    p_source_original_fabric_id,
    source_photo_row.sofa_id,
    source_photo_row.id,
    'source_photo',
    now(),
    source_photo_row.visual_matrix_column_id
  )
  on conflict (sofa_id, fabric_id, visual_matrix_column_id)
  do update set
    accepted_fabric_render_candidate_id = null,
    current_private_asset_id = excluded.current_private_asset_id,
    source_photo_id = excluded.source_photo_id,
    source_type = excluded.source_type,
    updated_at = excluded.updated_at;

  return column_row;
end;
$$;

revoke all on function public.admin_update_visual_matrix_column_source_fabric(
  uuid,
  boolean,
  integer,
  boolean,
  text,
  boolean,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.admin_update_visual_matrix_column_source_fabric(
  uuid,
  boolean,
  integer,
  boolean,
  text,
  boolean,
  text,
  uuid
) to service_role;
