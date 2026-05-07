import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOG_STORAGE_ASSET_KINDS,
  CATALOG_TABLES,
  generateSnapshotSql,
} from "./export-dev-catalog-snapshot.mjs";
import {
  validateSnapshotFile,
  validateSnapshotText,
} from "./validate-dev-catalog-snapshot.mjs";

const workflowSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(".github/workflows/dev-catalog-snapshot.yml", "utf8"),
);

describe("DEV catalog snapshot export", () => {
  it("keeps the export scope to catalog tables and catalog asset kinds", () => {
    const tableNames = CATALOG_TABLES.map((table) => table.name);

    expect(tableNames).toEqual([
      "storage_assets",
      "storage_asset_variants",
      "public_tags",
      "fabrics",
      "sofas",
      "sofa_fabrics",
      "sofa_tags",
      "visual_matrix_columns",
      "sofa_source_photos",
      "sofa_render_cells",
      "fabric_render_jobs",
      "fabric_render_candidates",
      "sofa_render_exports",
    ]);
    expect(tableNames).not.toContain("admin_trusted_devices");
    expect(tableNames).not.toContain("simulation_sessions");
    expect(tableNames).not.toContain("in_home_simulation_jobs");
    expect(CATALOG_STORAGE_ASSET_KINDS).toEqual(
      expect.arrayContaining([
        "fabric_ai_reference",
        "fabric_render_candidate",
        "fabric_render_private",
        "fabric_swatch_public",
        "manual_render",
        "published_sofa_render",
        "sofa_source_photo",
      ]),
    );
  });

  it("exports variant rows after storage assets and deletes them before originals", () => {
    const rowsByTable = new Map(
      CATALOG_TABLES.map((table) => [table.name, []]),
    );
    rowsByTable.set("storage_assets", [
      {
        asset_kind: "published_sofa_render",
        bucket_id: "catalog-public-assets",
        byte_size: 100,
        checksum_sha256: null,
        content_type: "image/png",
        created_at: "2026-05-04T00:00:00.000Z",
        deleted_at: null,
        height_px: 1200,
        id: "00000000-0000-4000-8000-000000000101",
        lifecycle_state: "active",
        object_path: "catalog/original.png",
        purged_at: null,
        visibility: "public",
        width_px: 1600,
      },
      {
        asset_kind: "published_sofa_render_variant",
        bucket_id: "catalog-public-assets",
        byte_size: 80,
        checksum_sha256: null,
        content_type: "image/jpeg",
        created_at: "2026-05-04T00:00:00.000Z",
        deleted_at: null,
        height_px: 960,
        id: "00000000-0000-4000-8000-000000000102",
        lifecycle_state: "active",
        object_path: "variants/original/medium/variant.jpg",
        purged_at: null,
        visibility: "public",
        width_px: 1280,
      },
    ]);
    rowsByTable.set("storage_asset_variants", [
      {
        created_at: "2026-05-04T00:00:00.000Z",
        generation_kind: "stored",
        original_asset_id: "00000000-0000-4000-8000-000000000101",
        updated_at: "2026-05-04T00:00:00.000Z",
        variant_asset_id: "00000000-0000-4000-8000-000000000102",
        variant_kind: "medium",
      },
    ]);

    const sql = generateSnapshotSql(
      rowsByTable,
      new Date("2026-05-04T00:00:00.000Z"),
    );

    expect(sql).toContain("delete from public.storage_asset_variants;");
    expect(sql.indexOf("delete from public.storage_asset_variants")).toBeLessThan(
      sql.indexOf("delete from public.storage_assets"),
    );
    expect(sql.indexOf("insert into public.storage_assets")).toBeLessThan(
      sql.indexOf("insert into public.storage_asset_variants"),
    );
    expect(sql).toContain("variant_kind, variant_asset_id, generation_kind");
  });

  it("generates SQL that defers cyclic catalog links until referenced rows exist", () => {
    const rowsByTable = new Map(
      CATALOG_TABLES.map((table) => [table.name, []]),
    );
    rowsByTable.set("visual_matrix_columns", [
      {
        id: "00000000-0000-4000-8000-000000000001",
        sofa_id: "00000000-0000-4000-8000-000000000002",
        sequence: 1,
        admin_label: "View 1",
        public_label: "View 1",
        current_source_photo_id: "00000000-0000-4000-8000-000000000003",
        deleted_at: null,
        created_at: "2026-05-04T00:00:00.000Z",
        updated_at: "2026-05-04T00:00:00.000Z",
      },
    ]);
    rowsByTable.set("sofa_render_cells", [
      {
        id: "00000000-0000-4000-8000-000000000004",
        sofa_id: "00000000-0000-4000-8000-000000000002",
        fabric_id: "00000000-0000-4000-8000-000000000005",
        visual_matrix_column_id: "00000000-0000-4000-8000-000000000001",
        current_private_asset_id: null,
        current_public_asset_id: null,
        source_type: "generated",
        source_photo_id: null,
        accepted_fabric_render_candidate_id:
          "00000000-0000-4000-8000-000000000006",
        updated_at: "2026-05-04T00:00:00.000Z",
      },
    ]);

    const sql = generateSnapshotSql(
      rowsByTable,
      new Date("2026-05-04T00:00:00.000Z"),
    );

    expect(sql).toContain(
      "insert into public.visual_matrix_columns (id, sofa_id, sequence, admin_label, public_label, current_source_photo_id",
    );
    expect(sql).toContain("'View 1', 'View 1', null");
    expect(sql).toContain(
      "set current_source_photo_id = source.current_source_photo_id",
    );
    expect(sql).toContain(
      "set accepted_fabric_render_candidate_id = source.accepted_fabric_render_candidate_id",
    );
    expect(
      validateSnapshotText(
        sql,
        "supabase/catalog-snapshots/dev/catalog-data.sql",
      ),
    ).toEqual([]);
  });
});

describe("DEV catalog snapshot validation", () => {
  it("rejects forbidden schemas and non-catalog public tables", () => {
    const errors = validateSnapshotText(
      `
      -- Mobel Unique DEV catalog snapshot
      begin;
      delete from auth.users;
      delete from public.admin_trusted_devices;
      commit;
      `,
      "supabase/catalog-snapshots/dev/catalog-data.sql",
    );

    expect(errors.join("\n")).toContain("forbidden SQL pattern");
  });

  it("rejects snapshot files outside the committed DEV snapshot directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "dev-catalog-snapshot-"));
    const path = join(directory, "catalog-data.sql");
    writeFileSync(
      path,
      "-- Mobel Unique DEV catalog snapshot\nbegin;\ncommit;\n",
    );

    expect(validateSnapshotFile(path).join("\n")).toContain(
      "snapshot path must stay inside the repository",
    );
  });

  it("rejects variant rows that do not point at inserted storage assets", () => {
    const errors = validateSnapshotText(
      `
      -- Mobel Unique DEV catalog snapshot
      begin;
      insert into public.storage_asset_variants (original_asset_id, variant_kind, variant_asset_id, generation_kind, created_at, updated_at) values
        ('00000000-0000-4000-8000-000000000101', 'small', '00000000-0000-4000-8000-000000000102', 'stored', null, null);
      commit;
      `,
      "supabase/catalog-snapshots/dev/catalog-data.sql",
    );

    expect(errors.join("\n")).toContain(
      "storage_asset_variants references storage asset ids missing from the snapshot",
    );
  });

  it("rejects variant rows that point an original asset at itself", () => {
    const errors = validateSnapshotText(
      `
      -- Mobel Unique DEV catalog snapshot
      begin;
      insert into public.storage_assets (id) values
        ('00000000-0000-4000-8000-000000000101');
      insert into public.storage_asset_variants (original_asset_id, variant_kind, variant_asset_id, generation_kind, created_at, updated_at) values
        ('00000000-0000-4000-8000-000000000101', 'small', '00000000-0000-4000-8000-000000000101', 'stored', null, null);
      commit;
      `,
      "supabase/catalog-snapshots/dev/catalog-data.sql",
    );

    expect(errors.join("\n")).toContain(
      "storage_asset_variants must not point an original asset at itself",
    );
  });
});

describe("manual DEV catalog snapshot workflow", () => {
  it("is manually triggered and requires an explicit destructive confirmation", () => {
    expect(workflowSource).toContain("workflow_dispatch:");
    expect(workflowSource).toContain("REPLACE_DEV_CATALOG");
    expect(workflowSource).toContain("dry_run");
  });

  it("targets only Supabase DEV secrets and validates the snapshot before apply", () => {
    expect(workflowSource).toContain(
      "SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_DEV_PROJECT_ID }}",
    );
    expect(workflowSource).toContain(
      "SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DEV_DB_PASSWORD }}",
    );
    expect(workflowSource).not.toContain("SUPABASE_PROD");
    expect(workflowSource).toContain(
      "node scripts/validate-dev-catalog-snapshot.mjs",
    );
    expect(workflowSource).toContain(
      'pnpm exec supabase db query --linked --file "${SNAPSHOT_PATH}"',
    );
  });
});
