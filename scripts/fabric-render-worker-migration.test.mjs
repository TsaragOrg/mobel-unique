import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260427000300_fabric_render_worker_foundation.sql";
const geminiProviderMigrationPath =
  "supabase/migrations/20260427000400_fabric_render_gemini_provider.sql";

describe("fabric render worker foundation migration", () => {
  it("defines the required local queue, job table, and worker helper functions", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("local_fabric_render_jobs");
    expect(sql).toContain("public.fabric_render_jobs");
    expect(sql).toContain("public.fabric_render_candidates");
    expect(sql).toContain("catalog-private-assets");
    expect(sql).toContain("fabric_render_worker_seed_mock_job");
    expect(sql).toContain("fabric_render_worker_claim_next");
    expect(sql).toContain("fabric_render_worker_succeed");
    expect(sql).toContain("fabric_render_worker_fail");
  });

  it("keeps the required SPEC-0006 defaults visible in the schema", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("'mock'");
    expect(sql).toContain("'mock-fabric-render-v1'");
    expect(sql).toContain("'v007'");
    expect(sql).toContain("'queued'");
  });

  it("defines real provider input resolution and private unaccepted candidate persistence", async () => {
    const sql = await readFile(geminiProviderMigrationPath, "utf8");

    expect(sql).toContain("public.fabric_render_worker_resolve_inputs");
    expect(sql).toContain(
      "drop function if exists public.fabric_render_worker_succeed(uuid, text)"
    );
    expect(sql).toContain("output_byte_size");
    expect(sql).toContain("output_width_px");
    expect(sql).toContain("output_height_px");
    expect(sql).toContain("asset.visibility <> 'private'");
    expect(sql).toContain("asset.lifecycle_state <> 'active'");
    expect(sql).toContain("greatest(asset.width_px, asset.height_px) <= 2048");
    expect(sql).toContain(
      "renders/{sofa_id}/{fabric_id}/{visual_matrix_column_id}/candidates/{job_id}/output.png"
    );
    expect(sql).toContain("accepted_at");
    expect(sql).not.toContain("accepted_fabric_render_candidate_id =");
    expect(sql).not.toContain("current_private_asset_id =");
  });
});
