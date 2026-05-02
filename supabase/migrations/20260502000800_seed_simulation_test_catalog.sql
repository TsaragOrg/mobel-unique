-- SPEC-0015 PLAN-0039: deterministic test catalog seed.
--
-- `seed_simulation_test_catalog(corner_tag_slug text)` upserts the
-- minimum catalog rows the public simulation wizard needs to drive
-- a happy path end-to-end:
--
--   - one straight back_wall sofa (without the corner tag) and one
--     corner-tagged sofa whose tag slug matches the
--     `corner_tag_slug` argument;
--   - one shared fabric with a swatch + AI-reference asset pair;
--   - one visual matrix column per sofa; and
--   - a published `sofa_render_cells` row per sofa pointing at a
--     placeholder prepared-sofa storage asset so the worker has
--     somewhere to download the prepared sofa from.
--
-- The function is idempotent: every insert uses `on conflict do
-- nothing` on the deterministic ids, and the storage objects use
-- fixed byte-stable seed paths. Real placeholder image bytes are
-- uploaded separately by `scripts/seed-simulation-test-data.mjs`.
-- The function only needs to exist so the catalog rows reference
-- valid storage asset rows.
--
-- The `corner_tag_slug` argument lets PLAN-0042 swap the final
-- catalog-owner-confirmed value without a migration. Until then,
-- `'corner'` is the agreed placeholder.

create or replace function public.seed_simulation_test_catalog(
  corner_tag_slug text default 'corner'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  swatch_asset_id constant uuid := '00000000-0000-4000-8000-0000000a55c1';
  ai_reference_asset_id constant uuid := '00000000-0000-4000-8000-0000000a55c2';
  straight_render_asset_id constant uuid := '00000000-0000-4000-8000-0000000a55c3';
  corner_render_asset_id constant uuid := '00000000-0000-4000-8000-0000000a55c4';
  corner_tag_id constant uuid := '00000000-0000-4000-8000-0000000ca501';
  fabric_id constant uuid := '00000000-0000-4000-8000-0000000fab01';
  straight_sofa_id constant uuid := '00000000-0000-4000-8000-0000000505f1';
  corner_sofa_id constant uuid := '00000000-0000-4000-8000-0000000505f2';
  straight_visual_id constant uuid := '00000000-0000-4000-8000-0000000ymc01';
  corner_visual_id constant uuid := '00000000-0000-4000-8000-0000000ymc02';
  straight_cell_id constant uuid := '00000000-0000-4000-8000-0000000ce101';
  corner_cell_id constant uuid := '00000000-0000-4000-8000-0000000ce102';
begin
  if corner_tag_slug is null or length(btrim(corner_tag_slug)) = 0 then
    raise exception 'corner_tag_slug is required';
  end if;

  insert into public.storage_assets (
    id, bucket_id, object_path, visibility, lifecycle_state,
    asset_kind, content_type, byte_size, width_px, height_px
  )
  values
    (
      swatch_asset_id, 'catalog-public-assets',
      'seed/simulation-test/fabric-swatch.png', 'public', 'active',
      'fabric_swatch_public', 'image/png', 1024, 256, 256
    ),
    (
      ai_reference_asset_id, 'catalog-private-assets',
      'seed/simulation-test/fabric-ai-reference.png', 'private', 'active',
      'fabric_ai_reference', 'image/png', 1024, 512, 512
    ),
    (
      straight_render_asset_id, 'catalog-public-assets',
      'seed/simulation-test/sofa-straight-render.png', 'public', 'active',
      'sofa_render_public', 'image/png', 1024, 1024, 768
    ),
    (
      corner_render_asset_id, 'catalog-public-assets',
      'seed/simulation-test/sofa-corner-render.png', 'public', 'active',
      'sofa_render_public', 'image/png', 1024, 1024, 768
    )
  on conflict (id) do nothing;

  insert into public.public_tags (id, public_label, slug)
  values (corner_tag_id, 'Corner', corner_tag_slug)
  on conflict (id) do update
    set
      public_label = excluded.public_label,
      slug = excluded.slug,
      updated_at = now();

  insert into public.fabrics (
    id, lifecycle_state, internal_name, public_name,
    swatch_asset_id, ai_reference_asset_id, is_premium
  )
  values (
    fabric_id, 'active', 'simulation-test-fabric', 'Simulation Test Fabric',
    swatch_asset_id, ai_reference_asset_id, false
  )
  on conflict (id) do nothing;

  insert into public.sofas (
    id, lifecycle_state, internal_name, public_name, public_slug,
    public_description, length_cm, depth_cm, height_cm, footprint_type
  )
  values
    (
      straight_sofa_id, 'published', 'simulation-test-straight',
      'Simulation Test Sofa (Straight)',
      'simulation-test-straight',
      'Test sofa for the public simulation wizard, back-wall mode.',
      220, 95, 85, 'rectangular'
    ),
    (
      corner_sofa_id, 'published', 'simulation-test-corner',
      'Simulation Test Sofa (Corner)',
      'simulation-test-corner',
      'Test sofa for the public simulation wizard, corner mode.',
      260, 220, 85, 'l_shape'
    )
  on conflict (id) do update
    set
      lifecycle_state = excluded.lifecycle_state,
      first_published_at = coalesce(public.sofas.first_published_at, now()),
      published_at = now(),
      updated_at = now();

  insert into public.sofa_tags (sofa_id, tag_id)
  values (corner_sofa_id, corner_tag_id)
  on conflict (sofa_id, tag_id) do nothing;

  insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
  values
    (straight_sofa_id, fabric_id, 0),
    (corner_sofa_id, fabric_id, 0)
  on conflict (sofa_id, fabric_id) do nothing;

  insert into public.visual_matrix_columns (
    id, sofa_id, sequence, admin_label, public_label
  )
  values
    (
      straight_visual_id, straight_sofa_id, 1,
      'Front view', 'Front view'
    ),
    (
      corner_visual_id, corner_sofa_id, 1,
      'Front view', 'Front view'
    )
  on conflict (id) do nothing;

  insert into public.sofa_render_cells (
    id, sofa_id, fabric_id, visual_matrix_column_id,
    current_private_asset_id, current_public_asset_id, source_type
  )
  values
    (
      straight_cell_id, straight_sofa_id, fabric_id, straight_visual_id,
      null, straight_render_asset_id, 'manual_upload'
    ),
    (
      corner_cell_id, corner_sofa_id, fabric_id, corner_visual_id,
      null, corner_render_asset_id, 'manual_upload'
    )
  on conflict (sofa_id, fabric_id, visual_matrix_column_id) do update
    set
      current_public_asset_id = excluded.current_public_asset_id,
      updated_at = now();
end;
$$;

grant execute on function public.seed_simulation_test_catalog(text) to service_role;
