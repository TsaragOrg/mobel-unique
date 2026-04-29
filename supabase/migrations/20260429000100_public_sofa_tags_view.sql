create or replace view public.public_sofa_tags
with (security_barrier = true)
as
select
  st.sofa_id,
  t.public_label,
  t.slug
from public.sofa_tags st
join public.public_tags t on t.id = st.tag_id
join public.sofas s on s.id = st.sofa_id
where s.lifecycle_state = 'published';

revoke all on table public.public_sofa_tags from anon, authenticated;

grant select on public.public_sofa_tags to anon, authenticated;
