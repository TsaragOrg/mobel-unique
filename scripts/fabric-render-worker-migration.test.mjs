import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260427000300_fabric_render_worker_foundation.sql";

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
});
