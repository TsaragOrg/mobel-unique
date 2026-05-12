-- PLAN-0086 Public Catalog Page-Scoped Read
--
-- Returns only the public data needed to shape one catalog card page.

create or replace function public.list_public_catalog_cards(
  p_limit integer,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_cursor_manual_public_order integer default null,
  p_tag_slugs text[] default array[]::text[]
)
returns table (
  id uuid,
  public_name text,
  public_slug text,
  shopify_order_url text,
  public_description text,
  length_cm integer,
  depth_cm integer,
  height_cm integer,
  footprint_type text,
  footprint_measurements jsonb,
  manual_public_order integer,
  created_at timestamptz,
  price_cents integer,
  price_currency text,
  default_fabric_id uuid,
  default_visual_position_id uuid,
  default_render_medium_object_path text,
  default_render_medium_content_type text,
  default_render_medium_width_px integer,
  default_render_medium_height_px integer,
  tags jsonb,
  fabrics jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with
    limits as (
      select least(greatest(coalesce(p_limit, 12), 1), 49) as bounded_limit
    ),
    requested_tags as (
      select distinct btrim(tag_slug) as slug
      from unnest(coalesce(p_tag_slugs, array[]::text[])) as tag_slug
      where btrim(tag_slug) <> ''
    ),
    usable_candidates as (
      select
        sofa.*,
        default_fabric.id as default_fabric_id,
        default_position.id as default_visual_position_id,
        default_render.render_medium_object_path as default_render_medium_object_path,
        default_render.render_medium_content_type as default_render_medium_content_type,
        default_render.render_medium_width_px as default_render_medium_width_px,
        default_render.render_medium_height_px as default_render_medium_height_px
      from public.public_catalog_sofas sofa
      join lateral (
        select fabric.*
        from public.public_sofa_fabrics fabric
        where fabric.sofa_id = sofa.id
        order by fabric.public_order, fabric.id
        limit 1
      ) default_fabric on true
      join lateral (
        select position.*
        from public.public_sofa_visual_positions position
        where position.sofa_id = sofa.id
        order by position.sequence, position.id
        limit 1
      ) default_position on true
      join public.public_sofa_render_cells default_render
        on default_render.sofa_id = sofa.id
        and default_render.fabric_id = default_fabric.id
        and default_render.visual_matrix_column_id = default_position.id
      where not exists (
        select 1
        from requested_tags requested_tag
        where not exists (
          select 1
          from public.public_sofa_tags tag
          where tag.sofa_id = sofa.id
            and tag.slug = requested_tag.slug
        )
      )
      and (
        p_cursor_created_at is null
        or coalesce(sofa.manual_public_order, 2147483647)
          > coalesce(p_cursor_manual_public_order, 2147483647)
        or (
          coalesce(sofa.manual_public_order, 2147483647)
            = coalesce(p_cursor_manual_public_order, 2147483647)
          and sofa.created_at < p_cursor_created_at
        )
        or (
          coalesce(sofa.manual_public_order, 2147483647)
            = coalesce(p_cursor_manual_public_order, 2147483647)
          and sofa.created_at = p_cursor_created_at
          and sofa.id > p_cursor_id
        )
      )
    ),
    candidates as (
      select *
      from usable_candidates candidate
      order by
        coalesce(candidate.manual_public_order, 2147483647),
        candidate.created_at desc,
        candidate.id
      -- limit bounded_limit
      limit (select bounded_limit from limits)
    )
  select
    candidate.id,
    candidate.public_name,
    candidate.public_slug,
    candidate.shopify_order_url,
    candidate.public_description,
    candidate.length_cm,
    candidate.depth_cm,
    candidate.height_cm,
    candidate.footprint_type,
    candidate.footprint_measurements,
    candidate.manual_public_order,
    candidate.created_at,
    candidate.price_cents,
    candidate.price_currency,
    candidate.default_fabric_id,
    candidate.default_visual_position_id,
    candidate.default_render_medium_object_path,
    candidate.default_render_medium_content_type,
    candidate.default_render_medium_width_px,
    candidate.default_render_medium_height_px,
    coalesce(card_tags.tags, '[]'::jsonb) as tags,
    coalesce(card_fabrics.fabrics, '[]'::jsonb) as fabrics
  from candidates candidate
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'public_label', tag.public_label,
        'slug', tag.slug
      )
      order by tag.public_label, tag.slug
    ) as tags
    from public.public_sofa_tags tag
    where tag.sofa_id = candidate.id
  ) card_tags on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', fabric.id,
        'is_premium', fabric.is_premium,
        'public_name', fabric.public_name,
        'public_order', fabric.public_order,
        'render_medium_content_type', fabric_render.render_medium_content_type,
        'render_medium_height_px', fabric_render.render_medium_height_px,
        'render_medium_object_path', fabric_render.render_medium_object_path,
        'render_medium_width_px', fabric_render.render_medium_width_px,
        'swatch_small_content_type', fabric.public_swatch_small_content_type,
        'swatch_small_height_px', fabric.public_swatch_small_height_px,
        'swatch_small_object_path', fabric.public_swatch_small_object_path,
        'swatch_small_width_px', fabric.public_swatch_small_width_px
      )
      order by fabric.public_order, fabric.id
    ) as fabrics
    from public.public_sofa_fabrics fabric
    join public.public_sofa_render_cells fabric_render
      on fabric_render.sofa_id = candidate.id
      and fabric_render.fabric_id = fabric.id
      and fabric_render.visual_matrix_column_id = candidate.default_visual_position_id
    where fabric.sofa_id = candidate.id
  ) card_fabrics on true;
$$;

revoke all on function public.list_public_catalog_cards(
  integer,
  timestamptz,
  uuid,
  integer,
  text[]
) from public;

grant execute on function public.list_public_catalog_cards(
  integer,
  timestamptz,
  uuid,
  integer,
  text[]
) to anon, authenticated;
