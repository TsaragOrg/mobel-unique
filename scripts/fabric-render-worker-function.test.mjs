import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const functionPath = "supabase/functions/fabric-render-worker/index.ts";

describe("fabric render worker Edge Function", () => {
  it("claims, completes, and fails jobs through the expected RPC helpers", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("fabric_render_worker_seed_mock_job");
    expect(source).toContain("fabric_render_worker_claim_next");
    expect(source).toContain("fabric_render_worker_resolve_inputs");
    expect(source).toContain("fabric_render_worker_succeed");
    expect(source).toContain("fabric_render_worker_fail");
  });

  it("stores deterministic mock output as a private generated PNG artifact", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("catalog-private-assets");
    expect(source).toContain("buildFabricRenderCandidateOutputPath");
    expect(source).toContain("output_path: outputPath");
    expect(source).toContain("image/png");
    expect(source).toContain("MOCK_INPUT_IMAGE_BASE64");
    expect(source).toContain("MOCK_OUTPUT_PNG_BASE64");
    expect(source).toContain("materializeProviderInputBytes");
  });

  it("wires Gemini provider helpers, scratch artifacts, and retry classification", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("./prompt.ts");
    expect(source).toContain("./gemini.ts");
    expect(source).toContain("./storage.ts");
    expect(source).toContain("./scratch.ts");
    expect(source).toContain("./image-metadata.ts");
    expect(source).toContain("./job.ts");
    expect(source).toContain('requiredEnv("GEMINI_API_KEY")');
    expect(source).toContain("buildFabricRenderPrompt");
    expect(source).toContain("buildGeminiGenerateContentRequest");
    expect(source).toContain("buildGeminiRestRequestBody");
    expect(source).toContain("extractGeminiImage");
    expect(source).toContain("classifyGeminiProviderError");
    expect(source).toContain("prepareFabricRenderScratch");
    expect(source).toContain("recordFabricRenderScratchSuccess");
    expect(source).toContain("recordFabricRenderScratchFailure");
    expect(source).toContain("readImageDimensions");
    expect(source).toContain("retryable: providerFailure.retryable");
    expect(source).toContain("retryable: false");
  });

  it("does not accept generated candidates or publish public assets from the worker", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).not.toContain("accepted_fabric_render_candidate_id");
    expect(source).not.toContain("current_public_asset_id");
    expect(source).not.toContain("catalog-public-assets");
  });
});
