import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const functionPath = "supabase/functions/fabric-render-worker/index.ts";

describe("fabric render worker Edge Function", () => {
  it("claims, completes, and fails jobs through the expected RPC helpers", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("fabric_render_worker_seed_mock_job");
    expect(source).toContain("fabric_render_worker_claim_next");
    expect(source).toContain("fabric_render_worker_succeed");
    expect(source).toContain("fabric_render_worker_fail");
  });

  it("stores deterministic mock output as a private generated PNG artifact", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("catalog-private-assets");
    expect(source).toContain("fabric-render/${jobId}/output.png");
    expect(source).toContain("image/png");
    expect(source).toContain("MOCK_OUTPUT_PNG_BASE64");
  });
});
