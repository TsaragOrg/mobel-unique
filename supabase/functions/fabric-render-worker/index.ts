import {
  buildGeminiGenerateContentRequest,
  buildGeminiRestRequestBody,
  classifyGeminiProviderError,
  extractGeminiImage,
} from "./gemini.ts";
import { readImageDimensions } from "./image-metadata.ts";
import { normalizeGeneratedOutput } from "./image-normalization.ts";
import {
  buildFabricRenderCandidateOutputPath,
  validateFabricRenderJobInputs,
} from "./job.ts";
import {
  buildFabricRenderPrompt,
  buildFabricRenderRefinePrompt,
} from "./prompt.ts";
import {
  base64ToUint8Array,
  downloadStorageObject,
  uint8ArrayToBase64,
  uploadStorageObject,
} from "./storage.ts";
import {
  prepareFabricRenderScratch,
  recordFabricRenderScratchFailure,
  recordFabricRenderScratchSuccess,
  type ScratchFileSystem,
} from "./scratch.ts";

type WorkerResponse = {
  status?: string;
  job_id?: string;
  queue_name?: string;
  output_path?: string;
  error?: string;
};

type ClaimedJob = {
  status?: string;
  job_id?: string;
  queue_name?: string;
  error?: string;
};

type ResolvedAsset = {
  bucket_id: string;
  object_path: string;
  content_type: string;
  byte_size?: number | null;
  width_px: number;
  height_px: number;
};

type ResolvedJob = {
  status?: string;
  job_id: string;
  sofa_id: string;
  fabric_id: string;
  visual_matrix_column_id: string;
  render_cell_id: string;
  generation_mode: "initial" | "refine";
  prompt_note?: string | null;
  refine_prompt?: string | null;
  provider_name?: string | null;
  provider_model?: string | null;
  prompt_version?: string | null;
  target_sofa: ResolvedAsset;
  fabric_reference: ResolvedAsset;
  refinement_source?: ResolvedAsset | null;
};

type ProviderName = "mock" | "gemini";

type WorkerProviderConfig = {
  providerModel: string;
  providerName: ProviderName;
};

const GENERATED_BUCKET = "catalog-private-assets";
const MOCK_INPUT_IMAGE_BASE64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==";
const MOCK_OUTPUT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

const denoScratchFs: ScratchFileSystem = {
  mkdir: (path, options) => Deno.mkdir(path, options),
  remove: (path) => Deno.remove(path),
  writeFile: (path, data) => Deno.writeFile(path, data),
  writeTextFile: (path, text) => Deno.writeTextFile(path, text),
};

function jsonResponse(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function callRpc<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
    },
    method: "POST",
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${functionName} returned HTTP ${response.status}: ${responseText}`,
    );
  }

  return (responseText ? JSON.parse(responseText) : {}) as T;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const invocationError = validateWorkerInvocation(request);
  if (invocationError) {
    return invocationError;
  }

  const providerConfig = resolveWorkerProviderConfig();
  if (!providerConfig) {
    return jsonResponse({ error: "Unsupported fabric render provider" }, 501);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let geminiApiKey: string | undefined;

  try {
    supabaseUrl = requiredEnv("SUPABASE_URL");
    serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (providerConfig.providerName === "gemini") {
      geminiApiKey = requiredEnv("GEMINI_API_KEY");
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }

  const queueName =
    Deno.env.get("FABRIC_RENDER_QUEUE_NAME") ?? "local_fabric_render_jobs";
  const claimTtlSeconds = parsePositiveInteger(
    Deno.env.get("FABRIC_RENDER_CLAIM_TTL_SECONDS"),
    300,
  );
  const appEnv = Deno.env.get("APP_ENV") ?? "local";

  try {
    if (
      appEnv === "local" &&
      request.headers.get("x-fabric-render-seed-mock-job") === "1"
    ) {
      await callRpc(
        supabaseUrl,
        serviceRoleKey,
        "fabric_render_worker_seed_mock_job",
        {
          queue_name: queueName,
        },
      );
    }

    const claimedJob = await callRpc<ClaimedJob>(
      supabaseUrl,
      serviceRoleKey,
      "fabric_render_worker_claim_next",
      {
        claim_ttl_seconds: claimTtlSeconds,
        claim_provider_model: providerConfig.providerModel,
        claim_provider_name: providerConfig.providerName,
        queue_name: queueName,
        worker_id: `fabric-render-worker-${crypto.randomUUID()}`,
      },
    );

    if (claimedJob.status === "empty") {
      return new Response(null, { status: 204 });
    }

    if (claimedJob.status !== "processing" || !claimedJob.job_id) {
      return jsonResponse(
        {
          error: claimedJob.error ?? "No claimable fabric render job",
          queue_name: queueName,
          status: claimedJob.status ?? "skipped",
        },
        409,
      );
    }

    return await processClaimedJob({
      geminiApiKey,
      jobId: claimedJob.job_id,
      providerConfig,
      queueName,
      serviceRoleKey,
      supabaseUrl,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

function validateWorkerInvocation(request: Request): Response | null {
  const expectedSecret = Deno.env.get("FABRIC_RENDER_WORKER_INVOKE_SECRET");

  if (!expectedSecret) {
    if (isLocalWorkerEnvironment()) {
      return null;
    }

    return jsonResponse(
      {
        error:
          "Missing required environment variable: FABRIC_RENDER_WORKER_INVOKE_SECRET",
      },
      500,
    );
  }

  if (request.headers.get("x-fabric-render-worker-secret") !== expectedSecret) {
    return jsonResponse(
      { error: "Fabric render worker invocation is unauthorized" },
      401,
    );
  }

  return null;
}

function isLocalWorkerEnvironment(): boolean {
  const appEnv = Deno.env.get("APP_ENV");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  return (
    appEnv === "local" ||
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost")
  );
}

function resolveWorkerProviderConfig(): WorkerProviderConfig | null {
  const isLocalEnvironment = isLocalWorkerEnvironment();
  const defaultProviderName = isLocalEnvironment ? "mock" : "gemini";
  const provider =
    Deno.env.get("FABRIC_RENDER_PROVIDER") ?? defaultProviderName;

  if (provider !== "mock" && provider !== "gemini") {
    return null;
  }

  if (provider === "mock" && !isLocalEnvironment) {
    return null;
  }

  return {
    providerModel:
      Deno.env.get("FABRIC_RENDER_PROVIDER_MODEL") ??
      (provider === "gemini"
        ? "gemini-3-pro-image-preview"
        : "mock-fabric-render-v1"),
    providerName: provider,
  };
}

async function processClaimedJob(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  queueName: string;
  jobId: string;
  providerConfig: WorkerProviderConfig;
  geminiApiKey?: string;
}): Promise<Response> {
  const resolvedJob = await callRpc<ResolvedJob>(
    input.supabaseUrl,
    input.serviceRoleKey,
    "fabric_render_worker_resolve_inputs",
    {
      job_id: input.jobId,
    },
  );
  const scratchDir = buildScratchDir(input.jobId);

  try {
    validateFabricRenderJobInputs({
      fabricReference: {
        heightPx: resolvedJob.fabric_reference.height_px,
        widthPx: resolvedJob.fabric_reference.width_px,
      },
      generationMode: resolvedJob.generation_mode,
      refinementSource: resolvedJob.refinement_source
        ? {
            heightPx: resolvedJob.refinement_source.height_px,
            widthPx: resolvedJob.refinement_source.width_px,
          }
        : null,
      targetSofa: {
        heightPx: resolvedJob.target_sofa.height_px,
        widthPx: resolvedJob.target_sofa.width_px,
      },
    });

    const providerInputBytes = await materializeProviderInputBytes({
      provider: input.providerConfig.providerName,
      resolvedJob,
      serviceRoleKey: input.serviceRoleKey,
      supabaseUrl: input.supabaseUrl,
    });

    await prepareFabricRenderScratch({
      fabricReferenceBytes: providerInputBytes.fabricReferenceBytes,
      fs: denoScratchFs,
      generationMode: resolvedJob.generation_mode,
      refineSourceBytes: providerInputBytes.refineSourceBytes,
      scratchDir,
      targetSofaBytes: providerInputBytes.targetSofaBytes,
    });

    const outputPath = buildFabricRenderCandidateOutputPath({
      fabricId: resolvedJob.fabric_id,
      jobId: input.jobId,
      sofaId: resolvedJob.sofa_id,
      visualMatrixColumnId: resolvedJob.visual_matrix_column_id,
    });
    const generatedImage =
      input.providerConfig.providerName === "mock"
        ? {
            contentType: "image/png",
            outputBytes: base64ToUint8Array(MOCK_OUTPUT_PNG_BASE64),
          }
        : await runGeminiProvider({
            fabricReference: resolvedJob.fabric_reference,
            fabricReferenceBytes: providerInputBytes.fabricReferenceBytes,
            geminiApiKey: input.geminiApiKey,
            generationMode: resolvedJob.generation_mode,
            providerModel: input.providerConfig.providerModel,
            promptNote: resolvedJob.prompt_note,
            refinePrompt: resolvedJob.refine_prompt,
            refineSource: resolvedJob.refinement_source,
            refineSourceBytes: providerInputBytes.refineSourceBytes,
            targetSofa: resolvedJob.target_sofa,
            targetSofaBytes: providerInputBytes.targetSofaBytes,
          });
    const normalizationTarget = selectNormalizationTarget(resolvedJob);
    const normalizedImage =
      input.providerConfig.providerName === "gemini"
        ? await normalizeGeneratedOutput({
            outputBytes: generatedImage.outputBytes,
            outputContentType: generatedImage.contentType,
            targetHeightPx: normalizationTarget.height_px,
            targetWidthPx: normalizationTarget.width_px,
          })
        : preserveGeneratedImage(generatedImage);

    await recordFabricRenderScratchSuccess({
      fs: denoScratchFs,
      outputBytes: normalizedImage.outputBytes,
      scratchDir,
    });

    const outputDimensions = readImageDimensions(
      normalizedImage.outputBytes,
      normalizedImage.contentType,
    );
    if (
      outputDimensions.widthPx !== normalizedImage.normalizedWidthPx ||
      outputDimensions.heightPx !== normalizedImage.normalizedHeightPx
    ) {
      throw new Error("normalized output metadata did not match image bytes");
    }

    await uploadStorageObject({
      body: normalizedImage.outputBytes,
      bucketId: GENERATED_BUCKET,
      contentType: normalizedImage.contentType,
      fetchImpl: (url, init) => fetch(url, init),
      objectPath: outputPath,
      serviceRoleKey: input.serviceRoleKey,
      supabaseUrl: input.supabaseUrl,
    });

    await callRpc(
      input.supabaseUrl,
      input.serviceRoleKey,
      "fabric_render_worker_succeed",
      {
        job_id: input.jobId,
        output_byte_size: normalizedImage.outputBytes.byteLength,
        output_content_type: normalizedImage.contentType,
        output_height_px: normalizedImage.normalizedHeightPx,
        output_path: outputPath,
        output_width_px: normalizedImage.normalizedWidthPx,
      },
    );

    return jsonResponse({
      job_id: input.jobId,
      output_path: outputPath,
      queue_name: input.queueName,
      status: "succeeded",
    });
  } catch (error) {
    const providerFailure =
      input.providerConfig.providerName === "gemini"
        ? classifyGeminiProviderError(error)
        : null;
    const message =
      providerFailure?.message ??
      (error instanceof Error ? error.message : String(error));

    await recordFabricRenderScratchFailure({
      errorMessage: message,
      fs: denoScratchFs,
      scratchDir,
    });

    if (providerFailure) {
      await callRpc(
        input.supabaseUrl,
        input.serviceRoleKey,
        "fabric_render_worker_fail",
        {
          error_message: message,
          job_id: input.jobId,
          retryable: providerFailure.retryable,
        },
      );
    } else {
      await callRpc(
        input.supabaseUrl,
        input.serviceRoleKey,
        "fabric_render_worker_fail",
        {
          error_message: message,
          job_id: input.jobId,
          retryable: false,
        },
      );
    }

    return jsonResponse(
      {
        error: message,
        job_id: input.jobId,
        queue_name: input.queueName,
        status: "failed",
      },
      500,
    );
  }
}

async function downloadResolvedAsset(
  supabaseUrl: string,
  serviceRoleKey: string,
  asset: ResolvedAsset,
): Promise<Uint8Array> {
  return await downloadStorageObject({
    bucketId: asset.bucket_id,
    fetchImpl: (url, init) => fetch(url, init),
    objectPath: asset.object_path,
    serviceRoleKey,
    supabaseUrl,
  });
}

async function materializeProviderInputBytes(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  provider: ProviderName;
  resolvedJob: ResolvedJob;
}): Promise<{
  fabricReferenceBytes: Uint8Array;
  targetSofaBytes: Uint8Array;
  refineSourceBytes: Uint8Array | null;
}> {
  if (input.provider === "mock") {
    const mockInputBytes = base64ToUint8Array(MOCK_INPUT_IMAGE_BASE64);

    return {
      fabricReferenceBytes: mockInputBytes,
      refineSourceBytes: input.resolvedJob.refinement_source
        ? mockInputBytes
        : null,
      targetSofaBytes: mockInputBytes,
    };
  }

  return {
    fabricReferenceBytes: await downloadResolvedAsset(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.resolvedJob.fabric_reference,
    ),
    refineSourceBytes: input.resolvedJob.refinement_source
      ? await downloadResolvedAsset(
          input.supabaseUrl,
          input.serviceRoleKey,
          input.resolvedJob.refinement_source,
        )
      : null,
    targetSofaBytes: await downloadResolvedAsset(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.resolvedJob.target_sofa,
    ),
  };
}

async function runGeminiProvider(input: {
  geminiApiKey?: string;
  generationMode: "initial" | "refine";
  providerModel: string;
  promptNote?: string | null;
  refinePrompt?: string | null;
  fabricReference: ResolvedAsset;
  fabricReferenceBytes: Uint8Array;
  targetSofa: ResolvedAsset;
  targetSofaBytes: Uint8Array;
  refineSource?: ResolvedAsset | null;
  refineSourceBytes?: Uint8Array | null;
}): Promise<{ contentType: string; outputBytes: Uint8Array }> {
  if (!input.geminiApiKey) {
    throw new Error("Missing required environment variable: GEMINI_API_KEY");
  }

  const geminiRequest =
    input.generationMode === "initial"
      ? buildGeminiGenerateContentRequest({
          fabricReference: {
            dataBase64: uint8ArrayToBase64(input.fabricReferenceBytes),
            mimeType: input.fabricReference.content_type,
          },
          generationMode: "initial",
          model: input.providerModel,
          prompt: buildFabricRenderPrompt({
            generationMode: "initial",
            promptNote: input.promptNote,
          }),
          targetHeightPx: input.targetSofa.height_px,
          targetSofa: {
            dataBase64: uint8ArrayToBase64(input.targetSofaBytes),
            mimeType: input.targetSofa.content_type,
          },
          targetWidthPx: input.targetSofa.width_px,
        })
      : buildGeminiGenerateContentRequest({
          generationMode: "refine",
          model: input.providerModel,
          prompt: buildFabricRenderRefinePrompt({
            refinePrompt: input.refinePrompt ?? "",
          }),
          refineSource: {
            dataBase64: uint8ArrayToBase64(requireRefineSourceBytes(input)),
            mimeType: requireRefineSource(input).content_type,
          },
          targetHeightPx: requireRefineSource(input).height_px,
          targetWidthPx: requireRefineSource(input).width_px,
        });
  const response = await fetch(
    `${GEMINI_API_BASE_URL}/v1beta/models/${encodeURIComponent(geminiRequest.model)}:generateContent`,
    {
      body: JSON.stringify(buildGeminiRestRequestBody(geminiRequest)),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.geminiApiKey,
      },
      method: "POST",
    },
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw {
      message: `Gemini returned HTTP ${response.status}: ${responseText}`,
      status: response.status,
    };
  }

  const generated = extractGeminiImage(
    responseText ? JSON.parse(responseText) : {},
  );

  return {
    contentType: generated.mimeType,
    outputBytes: base64ToUint8Array(generated.dataBase64),
  };
}

function buildScratchDir(jobId: string): string {
  const root = Deno.env.get("FABRIC_RENDER_TMP_DIR") ?? "/tmp";
  return `${root.replace(/\/+$/, "")}/fabric-render/${jobId}`;
}

function selectNormalizationTarget(resolvedJob: ResolvedJob): ResolvedAsset {
  if (resolvedJob.generation_mode === "refine") {
    if (!resolvedJob.refinement_source) {
      throw new Error("refinement source is required for refine mode");
    }

    return resolvedJob.refinement_source;
  }

  return resolvedJob.target_sofa;
}

function preserveGeneratedImage(input: {
  contentType: string;
  outputBytes: Uint8Array;
}) {
  const dimensions = readImageDimensions(input.outputBytes, input.contentType);

  return {
    contentType: "image/png" as const,
    crop: null,
    cropApplied: false,
    normalizedHeightPx: dimensions.heightPx,
    normalizedWidthPx: dimensions.widthPx,
    outputBytes: input.outputBytes,
    resizeApplied: false,
    sourceHeightPx: dimensions.heightPx,
    sourceWidthPx: dimensions.widthPx,
  };
}

function requireRefineSource(input: {
  refineSource?: ResolvedAsset | null;
}): ResolvedAsset {
  if (!input.refineSource) {
    throw new Error("refinement source is required for refine mode");
  }

  return input.refineSource;
}

function requireRefineSourceBytes(input: {
  refineSourceBytes?: Uint8Array | null;
}): Uint8Array {
  if (!input.refineSourceBytes) {
    throw new Error("refine source bytes are required for refine mode");
  }

  return input.refineSourceBytes;
}
