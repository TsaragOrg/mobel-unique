create or replace function public.admin_unarchive_sofa(p_sofa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sofa public.sofas%rowtype;
  restored_sofa public.sofas%rowtype;
begin
  select *
  into target_sofa
  from public.sofas
  where id = p_sofa_id
  for update;

  if target_sofa.id is null then
    raise exception 'sofa was not found' using errcode = 'P0002';
  end if;

  if target_sofa.lifecycle_state <> 'archived' then
    raise exception 'only archived sofas can be restored from archive'
      using errcode = '23514';
  end if;

  update public.sofas
  set
    lifecycle_state = 'draft',
    published_at = null,
    archived_at = null,
    updated_at = now()
  where id = p_sofa_id
  returning *
  into restored_sofa;

  return jsonb_build_object(
    'sofa_id', restored_sofa.id,
    'lifecycle_state', restored_sofa.lifecycle_state,
    'public_slug', restored_sofa.public_slug,
    'archived_at', restored_sofa.archived_at
  );
end;
$$;

grant execute on function public.admin_unarchive_sofa(uuid) to service_role;
