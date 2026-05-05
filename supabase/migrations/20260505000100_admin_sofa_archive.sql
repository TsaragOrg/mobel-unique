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
  where sofa_id = p_sofa_id;

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

grant execute on function public.admin_archive_sofa(uuid) to service_role;
