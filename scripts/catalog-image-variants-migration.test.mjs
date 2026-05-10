import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260507000100_catalog_image_variants.sql";

describe("PLAN-0067 catalog image variants migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates the durable storage asset variant relationship table", () => {
    expect(sql).toContain("create table if not exists public.storage_asset_variants");
    expect(sql).toContain("original_asset_id uuid not null");
    expect(sql).toContain("variant_kind text not null");
    expect(sql).toContain("variant_asset_id uuid not null");
    expect(sql).toContain("generation_kind text not null default 'stored'");
    expect(sql).toContain("primary key (original_asset_id, variant_kind)");
    expect(sql).toContain("storage_asset_variants_kind_check");
    expect(sql).toContain("variant_kind in ('small', 'medium')");
    expect(sql).toContain("storage_asset_variants_generation_kind_check");
    expect(sql).toContain("generation_kind in ('stored')");
    expect(sql).toContain("storage_asset_variants_not_self_check");
  });

  it("adds lookup indexes and lifecycle cleanup for variant assets", () => {
    expect(sql).toContain("storage_asset_variants_variant_asset_id_unique_idx");
    expect(sql).toContain("storage_asset_variants_original_kind_idx");
    expect(sql).toContain("storage_asset_variants_variant_asset_lookup_idx");
    expect(sql).toContain("public.deactivate_storage_asset_variants");
    expect(sql).toContain("storage_assets_deactivate_variants_trigger");
    expect(sql).toContain("after update of lifecycle_state, deleted_at, purged_at");
    expect(sql).toContain("on public.storage_assets");
  });

  it("exposes original and medium render asset metadata through the public render cell view", () => {
    expect(sql).toContain("drop view if exists public.public_sofa_render_cells");
    expect(sql).toContain("create or replace view public.public_sofa_render_cells");
    expect(sql).toContain("render_original_asset_id");
    expect(sql).toContain("render_original_object_path");
    expect(sql).toContain("render_original_width_px");
    expect(sql).toContain("render_original_height_px");
    expect(sql).toContain("render_original_content_type");
    expect(sql).toContain("render_medium_asset_id");
    expect(sql).toContain("render_medium_object_path");
    expect(sql).toContain("render_medium_width_px");
    expect(sql).toContain("render_medium_height_px");
    expect(sql).toContain("render_medium_content_type");
    expect(sql).toContain("grant select on public.public_sofa_render_cells to anon, authenticated");
  });

  it("filters public render rows through active original and medium variant assets", () => {
    expect(sql).toContain("medium_variant.variant_kind = 'medium'");
    expect(sql).toContain("original_asset.lifecycle_state = 'active'");
    expect(sql).toContain("medium_asset.lifecycle_state = 'active'");
    expect(sql).toContain("original_asset.visibility = 'public'");
    expect(sql).toContain("medium_asset.visibility = 'public'");
  });

  it("updates worker success so candidate metadata and variants are persisted atomically", () => {
    expect(sql).toContain("drop function if exists public.fabric_render_worker_succeed");
    expect(sql).toContain("p_output_variants jsonb");
    expect(sql).toContain("jsonb_array_elements(p_output_variants)");
    expect(sql).toContain("variant_kind");
    expect(sql).toContain("variant_asset_id");
    expect(sql).toContain("insert into public.storage_asset_variants");
  });

  it("grants service-role access to variant rows and helper functions only", () => {
    expect(sql).toContain("grant select, insert, update on public.storage_asset_variants to service_role");
    expect(sql).toContain("grant execute on function public.deactivate_storage_asset_variants(uuid) to service_role");
    expect(sql).toContain("grant execute on function public.fabric_render_worker_succeed");
    expect(sql).not.toMatch(
      /grant\s+[^;]+on\s+public\.storage_asset_variants\s+to\s+(anon|authenticated)/i,
    );
    expect(sql).not.toMatch(
      /grant\s+execute\s+on\s+function\s+public\.(deactivate_storage_asset_variants|fabric_render_worker_succeed)[^;]+to\s+(anon|authenticated)/i,
    );
  });
});
