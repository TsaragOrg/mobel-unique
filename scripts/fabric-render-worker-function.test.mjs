import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const functionPath = "supabase/functions/fabric-render-worker/index.ts";

describe("fabric render worker Edge Function", () => {
  it("claims, completes, and fails request-scoped jobs through the expected RPC helpers", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("fabric_render_worker_seed_mock_job");
    expect(source).toContain("fabric_render_worker_request_status");
    expect(source).toContain("fabric_render_worker_claim_one_for_request");
    expect(source).toContain("fabric_render_worker_resolve_inputs");
    expect(source).toContain("fabric_render_worker_succeed");
    expect(source).toContain("fabric_render_worker_fail");
    expect(source).not.toContain("fabric_render_worker_claim_next");
  });

  it("parses explicit pump and job invocation bodies with request_id", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("parseWorkerRequestBody");
    expect(source).toContain('mode: "pump"');
    expect(source).toContain('mode: "job"');
    expect(source).toContain("request_id");
    expect(source).toContain("requestId");
    expect(source).toContain("Fabric render worker mode is required");
    expect(source).toContain("Fabric render request_id is required");
  });

  it("uses pump mode only for bounded request orchestration", async () => {
    const source = await readFile(functionPath, "utf8");
    const pumpIndex = source.indexOf("async function handlePumpMode");
    const jobIndex = source.indexOf("async function handleJobMode");
    const pumpSource = source.slice(pumpIndex, jobIndex);

    expect(pumpIndex).toBeGreaterThan(-1);
    expect(jobIndex).toBeGreaterThan(pumpIndex);
    expect(pumpSource).toContain("fabric_render_worker_request_status");
    expect(pumpSource).toContain("resolveMaxConcurrentJobs");
    expect(pumpSource).toContain("resolveCapacityScope");
    expect(pumpSource).toContain("p_capacity_scope");
    expect(pumpSource).toContain("active_processing");
    expect(source).toContain("FABRIC_RENDER_MAX_CONCURRENT_JOBS");
    expect(pumpSource).toContain("Math.min");
    expect(pumpSource).toContain("invokeWorkerJob");
    expect(pumpSource).toContain("started_count");
    expect(pumpSource).not.toContain("processClaimedJob");
  });

  it("uses job mode to claim one request job and re-invoke pump after completion", async () => {
    const source = await readFile(functionPath, "utf8");
    const jobIndex = source.indexOf("async function handleJobMode");
    const processIndex = source.indexOf("async function processClaimedJob");
    const jobSource = source.slice(jobIndex, processIndex);

    expect(jobIndex).toBeGreaterThan(-1);
    expect(processIndex).toBeGreaterThan(jobIndex);
    expect(jobSource).toContain("fabric_render_worker_claim_one_for_request");
    expect(jobSource).toContain("p_max_concurrent_jobs");
    expect(jobSource).toContain("p_capacity_scope");
    expect(jobSource).toContain("processClaimedJob");
    expect(jobSource).toContain("invokeNextWorkerPump");
    expect(jobSource).toContain("finally");
    expect(jobSource).toContain('status === "capacity_full"');
  });

  it("continues the next queued request when local global capacity frees up", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("async function invokeNextWorkerPump");
    expect(source).toContain("fabric_render_worker_next_queued_request_id");
    expect(source).toContain("readNextRequestId");
    expect(source).toContain("capacityScope === \"global\"");
    expect(source).toContain("return nextRequestId");
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
    expect(source).toContain("./image-normalization.ts");
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
    expect(source).not.toContain("retryable: providerFailure.retryable");
    expect(source).toContain("retryable: false");
  });

  it("persists input-resolution failures on claimed jobs", async () => {
    const source = await readFile(functionPath, "utf8");
    const processIndex = source.indexOf("async function processClaimedJob");
    const resolveIndex = source.indexOf(
      "fabric_render_worker_resolve_inputs",
      processIndex,
    );
    const tryIndex = source.indexOf("try {", processIndex);
    const catchIndex = source.indexOf("} catch (error) {", processIndex);
    const failIndex = source.indexOf("fabric_render_worker_fail", catchIndex);

    expect(processIndex).toBeGreaterThan(-1);
    expect(tryIndex).toBeGreaterThan(processIndex);
    expect(resolveIndex).toBeGreaterThan(tryIndex);
    expect(resolveIndex).toBeLessThan(catchIndex);
    expect(failIndex).toBeGreaterThan(catchIndex);
  });

  it("requires a worker invocation secret for non-local requests", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("validateWorkerInvocation");
    expect(source).toContain("FABRIC_RENDER_WORKER_INVOKE_SECRET");
    expect(source).toContain("x-fabric-render-worker-secret");
    expect(source).toContain("Fabric render worker invocation is unauthorized");
    expect(source).toContain(
      "Missing required environment variable: FABRIC_RENDER_WORKER_INVOKE_SECRET",
    );
  });

  it("does not self-invoke a local Edge Function through host loopback", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("isLocalLoopbackUrl");
    expect(source).toContain('parsedUrl.hostname === "127.0.0.1"');
    expect(source).toContain('parsedUrl.hostname === "localhost"');
    expect(source).toContain(
      "!(isLocalWorkerEnvironment() && isLocalLoopbackUrl(configuredUrl))",
    );
  });

  it("owns provider and model selection inside the worker", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("resolveWorkerProviderConfig");
    expect(source).toContain("FABRIC_RENDER_PROVIDER");
    expect(source).toContain("FABRIC_RENDER_PROVIDER_MODEL");
    expect(source).toContain(
      "claim_provider_name: providerConfig.providerName",
    );
    expect(source).toContain(
      "claim_provider_model: providerConfig.providerModel",
    );
    expect(source).toContain("p_max_concurrent_jobs: maxConcurrentJobs");
    expect(source).toContain("function resolveMaxConcurrentJobs");
    expect(source).toContain("function resolveCapacityScope");
    expect(source).toContain('providerConfig?.providerName === "gemini"');
    expect(source).toContain('return "global"');
    expect(source).toContain('return "request"');
    expect(source).toContain("? 1");
    expect(source).toContain(
      "providerModel: input.providerConfig.providerModel",
    );
    expect(source).not.toContain(
      'request.headers.get("x-fabric-render-provider")',
    );
  });

  it("uses refine_prompt for refine jobs without falling back to prompt_note", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain("refinePrompt: resolvedJob.refine_prompt");
    expect(source).not.toContain("input.refinePrompt ?? input.promptNote");
    expect(source).toContain("buildFabricRenderRefinePrompt");
  });

  it("defaults worker provider to Gemini outside local environments", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).toContain(
      "const isLocalEnvironment = isLocalWorkerEnvironment();",
    );
    expect(source).toContain(
      'const defaultProviderName = isLocalEnvironment ? "mock" : "gemini";',
    );
    expect(source).toContain(
      'Deno.env.get("FABRIC_RENDER_PROVIDER") ?? defaultProviderName',
    );
    expect(source).toContain('provider === "mock" && !isLocalEnvironment');
  });

  it("normalizes Gemini output before scratch, upload, and succeed metadata", async () => {
    const source = await readFile(functionPath, "utf8");
    const generatedImageIndex = source.indexOf("const generatedImage");
    const normalizationIndex = source.indexOf("normalizeGeneratedOutput({");
    const localNormalizationIndex = source.indexOf(
      "shouldNormalizeGeneratedOutput",
    );
    const scratchSuccessIndex = source.indexOf(
      "recordFabricRenderScratchSuccess({",
    );
    const dimensionReadIndex = source.indexOf("readImageDimensions(");
    const uploadIndex = source.indexOf("uploadStorageObject({");
    const succeedIndex = source.indexOf("fabric_render_worker_succeed");

    expect(normalizationIndex).toBeGreaterThan(generatedImageIndex);
    expect(localNormalizationIndex).toBeGreaterThan(generatedImageIndex);
    expect(normalizationIndex).toBeLessThan(scratchSuccessIndex);
    expect(normalizationIndex).toBeLessThan(dimensionReadIndex);
    expect(normalizationIndex).toBeLessThan(uploadIndex);
    expect(normalizationIndex).toBeLessThan(succeedIndex);
    expect(source).toContain("FABRIC_RENDER_OUTPUT_NORMALIZATION");
    expect(source).toContain('"preserve-provider-output"');
    expect(source).toContain("selectNormalizationTarget");
    expect(source).toContain("resolvedJob.target_sofa");
    expect(source).toContain("resolvedJob.refinement_source");
    expect(source).toContain("outputBytes: normalizedImage.outputBytes");
    expect(source).toContain("body: normalizedImage.outputBytes");
    expect(source).toContain(
      "output_byte_size: normalizedImage.outputBytes.byteLength",
    );
    expect(source).toContain(
      "output_content_type: normalizedImage.contentType",
    );
    expect(source).toContain(
      "output_height_px: normalizedImage.normalizedHeightPx",
    );
    expect(source).toContain(
      "output_width_px: normalizedImage.normalizedWidthPx",
    );
  });

  it("does not accept generated candidates or publish public assets from the worker", async () => {
    const source = await readFile(functionPath, "utf8");

    expect(source).not.toContain("accepted_fabric_render_candidate_id");
    expect(source).not.toContain("current_public_asset_id");
    expect(source).not.toContain("catalog-public-assets");
  });
});
