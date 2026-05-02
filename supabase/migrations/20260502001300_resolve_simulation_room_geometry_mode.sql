-- SPEC-0015 PLAN-0040 helper RPC that resolves the
-- `room_geometry_mode` for a given sofa slug ahead of the create-job
-- call.
--
-- The public simulation upload route handler needs to know the
-- geometry mode before it uploads the room photo so the create-job
-- RPC receives the correct value. The mode is determined by whether
-- the sofa carries the agreed corner tag (catalog-owner-confirmed
-- value, defaulted to `corner` for the launch). When the sofa is
-- not publishable (missing slug or not in `published` lifecycle),
-- the function returns null and the caller maps that to a safe
-- validation error.

create or replace function public.resolve_simulation_room_geometry_mode(
  p_sofa_slug text,
  p_corner_tag_slug text
)
returns public.room_geometry_mode
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  resolved_sofa_id uuid;
  has_corner_tag boolean;
begin
  if p_sofa_slug is null or length(btrim(p_sofa_slug)) = 0 then
    raise exception 'p_sofa_slug is required';
  end if;

  if p_corner_tag_slug is null or length(btrim(p_corner_tag_slug)) = 0 then
    raise exception 'p_corner_tag_slug is required';
  end if;

  select id into resolved_sofa_id
  from public.sofas
  where public_slug = p_sofa_slug
    and lifecycle_state = 'published'
  limit 1;

  if resolved_sofa_id is null then
    return null;
  end if;

  select exists (
    select 1
    from public.sofa_tags st
    join public.public_tags pt on pt.id = st.tag_id
    where st.sofa_id = resolved_sofa_id
      and pt.slug = p_corner_tag_slug
  ) into has_corner_tag;

  if has_corner_tag then
    return 'corner'::public.room_geometry_mode;
  end if;
  return 'back_wall'::public.room_geometry_mode;
end;
$$;

grant execute on function public.resolve_simulation_room_geometry_mode(text, text)
  to service_role;
