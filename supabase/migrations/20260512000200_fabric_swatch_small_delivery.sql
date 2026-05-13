-- PLAN-0083 Fabric Swatch Small Delivery
--
-- Public fabric selectors use a stored 96 px swatch variant. The canonical
-- fabric_swatch_public asset remains the source of truth, and public reads only
-- expose the small swatch when both assets are active public catalog assets.

alter table public.storage_asset_variants
  drop constraint if exists storage_asset_variants_kind_check;

alter table public.storage_asset_variants
  add constraint storage_asset_variants_kind_check
  check (variant_kind in ('small', 'medium', 'swatch_small'));

drop view if exists public.public_sofa_fabrics;

create or replace view public.public_sofa_fabrics
with (security_barrier = true)
as
select
  f.id,
  sf.sofa_id,
  f.public_name,
  f.is_premium,
  sf.public_order,
  swatch_asset.object_path as public_swatch_object_path,
  swatch_asset.content_type as public_swatch_content_type,
  swatch_asset.width_px as public_swatch_width_px,
  swatch_asset.height_px as public_swatch_height_px,
  swatch_small_asset.id as public_swatch_small_asset_id,
  swatch_small_asset.object_path as public_swatch_small_object_path,
  swatch_small_asset.content_type as public_swatch_small_content_type,
  swatch_small_asset.width_px as public_swatch_small_width_px,
  swatch_small_asset.height_px as public_swatch_small_height_px
from public.sofa_fabrics sf
join public.sofas s
  on s.id = sf.sofa_id
  and s.lifecycle_state = 'published'
join public.fabrics f
  on f.id = sf.fabric_id
  and f.lifecycle_state = 'active'
join public.storage_assets swatch_asset
  on swatch_asset.id = f.swatch_asset_id
  and swatch_asset.visibility = 'public'
  and swatch_asset.lifecycle_state = 'active'
  and swatch_asset.bucket_id = 'catalog-public-assets'
join public.storage_asset_variants swatch_small_variant
  on swatch_small_variant.original_asset_id = swatch_asset.id
  and swatch_small_variant.variant_kind = 'swatch_small'
join public.storage_assets swatch_small_asset
  on swatch_small_asset.id = swatch_small_variant.variant_asset_id
  and swatch_small_asset.visibility = 'public'
  and swatch_small_asset.lifecycle_state = 'active'
  and swatch_small_asset.bucket_id = 'catalog-public-assets'
where sf.public_order is not null
  and not exists (
    select 1
    from public.visual_matrix_columns vm
    where vm.sofa_id = sf.sofa_id
      and vm.deleted_at is null
      and not exists (
        select 1
        from public.sofa_render_cells rc
        join public.storage_assets public_asset
          on public_asset.id = rc.current_public_asset_id
          and public_asset.visibility = 'public'
          and public_asset.lifecycle_state = 'active'
          and public_asset.bucket_id = 'catalog-public-assets'
        where rc.sofa_id = sf.sofa_id
          and rc.fabric_id = sf.fabric_id
          and rc.visual_matrix_column_id = vm.id
      )
  );

revoke all on table public.public_sofa_fabrics from anon, authenticated;
grant select on public.public_sofa_fabrics to anon, authenticated;
