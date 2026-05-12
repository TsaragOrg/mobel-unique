import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260512000200_fabric_swatch_small_delivery.sql";
const sql = readFileSync(migrationPath, "utf8");

describe("PLAN-0083 fabric swatch small delivery migration", () => {
  it("allows swatch_small variant links", () => {
    expect(sql).toContain("storage_asset_variants_kind_check");
    expect(sql).toContain(
      "check (variant_kind in ('small', 'medium', 'swatch_small'))",
    );
  });

  it("exposes original and small swatch metadata through public_sofa_fabrics", () => {
    expect(sql).toContain("drop view if exists public.public_sofa_fabrics");
    expect(sql).toContain("create or replace view public.public_sofa_fabrics");

    for (const column of [
      "public_swatch_object_path",
      "public_swatch_content_type",
      "public_swatch_width_px",
      "public_swatch_height_px",
      "public_swatch_small_asset_id",
      "public_swatch_small_object_path",
      "public_swatch_small_content_type",
      "public_swatch_small_width_px",
      "public_swatch_small_height_px",
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("requires active public original and swatch_small assets in the public bucket", () => {
    expect(sql).toContain("swatch_small_variant.variant_kind = 'swatch_small'");
    expect(sql).toContain("swatch_small_variant.original_asset_id = swatch_asset.id");
    expect(sql).toContain("swatch_small_asset.id = swatch_small_variant.variant_asset_id");

    for (const alias of ["swatch_asset", "swatch_small_asset"]) {
      expect(sql).toContain(`${alias}.visibility = 'public'`);
      expect(sql).toContain(`${alias}.lifecycle_state = 'active'`);
      expect(sql).toContain(`${alias}.bucket_id = 'catalog-public-assets'`);
    }
  });
});
