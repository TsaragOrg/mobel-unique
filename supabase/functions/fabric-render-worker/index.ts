import {
  buildGeminiGenerateContentRequest,
  buildGeminiRestRequestBody,
  classifyGeminiProviderError,
  extractGeminiImage
} from "./gemini.ts";
import { readImageDimensions } from "./image-metadata.ts";
import {
  buildFabricRenderCandidateOutputPath,
  validateFabricRenderJobInputs
} from "./job.ts";
import { buildFabricRenderPrompt } from "./prompt.ts";
import {
  base64ToUint8Array,
  downloadStorageObject,
  uint8ArrayToBase64,
  uploadStorageObject
} from "./storage.ts";
import {
  prepareFabricRenderScratch,
  recordFabricRenderScratchFailure,
  recordFabricRenderScratchSuccess,
  type ScratchFileSystem
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
  provider_name?: string | null;
  provider_model?: string | null;
  prompt_version?: string | null;
  target_sofa: ResolvedAsset;
  fabric_reference: ResolvedAsset;
  refinement_source?: ResolvedAsset | null;
};

type ProviderName = "mock" | "gemini";

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
  writeTextFile: (path, text) => Deno.writeTextFile(path, text)
};

function jsonResponse(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function callRpc<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "apikey": serviceRoleKey
    },
    method: "POST"
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${functionName} returned HTTP ${response.status}: ${responseText}`
    );
  }

  return (responseText ? JSON.parse(responseText) : {}) as T;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestedProvider = readRequestedProvider(request);
  if (!requestedProvider) {
    return jsonResponse({ error: "Unsupported fabric render provider" }, 501);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let geminiApiKey: string | undefined;

  try {
    supabaseUrl = requiredEnv("SUPABASE_URL");
    serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (requestedProvider === "gemini") {
      geminiApiKey = requiredEnv("GEMINI_API_KEY");
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }

  const queueName = Deno.env.get("FABRIC_RENDER_QUEUE_NAME") ?? "local_fabric_render_jobs";
  const claimTtlSeconds = parsePositiveInteger(
    Deno.env.get("FABRIC_RENDER_CLAIM_TTL_SECONDS"),
    300
  );
  const appEnv = Deno.env.get("APP_ENV") ?? "local";

  try {
    if (
      appEnv === "local" &&
      request.headers.get("x-fabric-render-seed-mock-job") === "1"
    ) {
      await callRpc(supabaseUrl, serviceRoleKey, "fabric_render_worker_seed_mock_job", {
        queue_name: queueName
      });
    }

    const claimedJob = await callRpc<ClaimedJob>(
      supabaseUrl,
      serviceRoleKey,
      "fabric_render_worker_claim_next",
      {
        claim_ttl_seconds: claimTtlSeconds,
        queue_name: queueName,
        worker_id: `fabric-render-worker-${crypto.randomUUID()}`
      }
    );

    if (claimedJob.status === "empty") {
      return new Response(null, { status: 204 });
    }

    if (claimedJob.status !== "processing" || !claimedJob.job_id) {
      return jsonResponse(
        {
          error: claimedJob.error ?? "No claimable fabric render job",
          queue_name: queueName,
          status: claimedJob.status ?? "skipped"
        },
        409
      );
    }

    return await processClaimedJob({
      geminiApiKey,
      jobId: claimedJob.job_id,
      provider: requestedProvider,
      queueName,
      serviceRoleKey,
      supabaseUrl
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

function readRequestedProvider(request: Request): ProviderName | null {
  const provider =
    request.headers.get("x-fabric-render-provider") ??
    Deno.env.get("FABRIC_RENDER_PROVIDER") ??
    "mock";

  return provider === "mock" || provider === "gemini" ? provider : null;
}

async function processClaimedJob(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  queueName: string;
  jobId: string;
  provider: ProviderName;
  geminiApiKey?: string;
}): Promise<Response> {
  const resolvedJob = await callRpc<ResolvedJob>(
    input.supabaseUrl,
    input.serviceRoleKey,
    "fabric_render_worker_resolve_inputs",
    {
      job_id: input.jobId
    }
  );
  const scratchDir = buildScratchDir(input.jobId);

  try {
    validateFabricRenderJobInputs({
      fabricReference: {
        heightPx: resolvedJob.fabric_reference.height_px,
        widthPx: resolvedJob.fabric_reference.width_px
      },
      generationMode: resolvedJob.generation_mode,
      refinementSource: resolvedJob.refinement_source
        ? {
            heightPx: resolvedJob.refinement_source.height_px,
            widthPx: resolvedJob.refinement_source.width_px
          }
        : null,
      targetSofa: {
        heightPx: resolvedJob.target_sofa.height_px,
        widthPx: resolvedJob.target_sofa.width_px
      }
    });

    const providerInputBytes = await materializeProviderInputBytes({
      provider: input.provider,
      resolvedJob,
      serviceRoleKey: input.serviceRoleKey,
      supabaseUrl: input.supabaseUrl
    });

    await prepareFabricRenderScratch({
      fabricReferenceBytes: providerInputBytes.fabricReferenceBytes,
      fs: denoScratchFs,
      generationMode: resolvedJob.generation_mode,
      refineSourceBytes: providerInputBytes.refineSourceBytes,
      scratchDir,
      targetSofaBytes: providerInputBytes.targetSofaBytes
    });

    const outputPath = buildFabricRenderCandidateOutputPath({
      fabricId: resolvedJob.fabric_id,
      jobId: input.jobId,
      sofaId: resolvedJob.sofa_id,
      visualMatrixColumnId: resolvedJob.visual_matrix_column_id
    });
    const generatedImage =
      input.provider === "mock"
        ? {
            contentType: "image/png",
            outputBytes: base64ToUint8Array(MOCK_OUTPUT_PNG_BASE64)
          }
        : await runGeminiProvider({
            fabricReference: resolvedJob.fabric_reference,
            fabricReferenceBytes: providerInputBytes.fabricReferenceBytes,
            geminiApiKey: input.geminiApiKey,
            generationMode: resolvedJob.generation_mode,
            promptNote: resolvedJob.prompt_note,
            refineSource: resolvedJob.refinement_source,
            refineSourceBytes: providerInputBytes.refineSourceBytes,
            targetSofa: resolvedJob.target_sofa,
            targetSofaBytes: providerInputBytes.targetSofaBytes
          });

    await recordFabricRenderScratchSuccess({
      fs: denoScratchFs,
      outputBytes: generatedImage.outputBytes,
      scratchDir
    });

    const outputDimensions = readImageDimensions(
      generatedImage.outputBytes,
      generatedImage.contentType
    );

    await uploadStorageObject({
      body: generatedImage.outputBytes,
      bucketId: GENERATED_BUCKET,
      contentType: generatedImage.contentType,
      fetchImpl: (url, init) => fetch(url, init),
      objectPath: outputPath,
      serviceRoleKey: input.serviceRoleKey,
      supabaseUrl: input.supabaseUrl
    });

    await callRpc(input.supabaseUrl, input.serviceRoleKey, "fabric_render_worker_succeed", {
      job_id: input.jobId,
      output_byte_size: generatedImage.outputBytes.byteLength,
      output_content_type: generatedImage.contentType,
      output_height_px: outputDimensions.heightPx,
      output_path: outputPath,
      output_width_px: outputDimensions.widthPx
    });

    return jsonResponse({
      job_id: input.jobId,
      output_path: outputPath,
      queue_name: input.queueName,
      status: "succeeded"
    });
  } catch (error) {
    const providerFailure =
      input.provider === "gemini" ? classifyGeminiProviderError(error) : null;
    const message =
      providerFailure?.message ??
      (error instanceof Error ? error.message : String(error));

    await recordFabricRenderScratchFailure({
      errorMessage: message,
      fs: denoScratchFs,
      scratchDir
    });

    if (providerFailure) {
      await callRpc(input.supabaseUrl, input.serviceRoleKey, "fabric_render_worker_fail", {
        error_message: message,
        job_id: input.jobId,
        retryable: providerFailure.retryable
      });
    } else {
      await callRpc(input.supabaseUrl, input.serviceRoleKey, "fabric_render_worker_fail", {
        error_message: message,
        job_id: input.jobId,
        retryable: false
      });
    }

    return jsonResponse(
      {
        error: message,
        job_id: input.jobId,
        queue_name: input.queueName,
        status: "failed"
      },
      500
    );
  }
}

async function downloadResolvedAsset(
  supabaseUrl: string,
  serviceRoleKey: string,
  asset: ResolvedAsset
): Promise<Uint8Array> {
  return await downloadStorageObject({
    bucketId: asset.bucket_id,
    fetchImpl: (url, init) => fetch(url, init),
    objectPath: asset.object_path,
    serviceRoleKey,
    supabaseUrl
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
      refineSourceBytes: input.resolvedJob.refinement_source ? mockInputBytes : null,
      targetSofaBytes: mockInputBytes
    };
  }

  return {
    fabricReferenceBytes: await downloadResolvedAsset(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.resolvedJob.fabric_reference
    ),
    refineSourceBytes: input.resolvedJob.refinement_source
      ? await downloadResolvedAsset(
          input.supabaseUrl,
          input.serviceRoleKey,
          input.resolvedJob.refinement_source
        )
      : null,
    targetSofaBytes: await downloadResolvedAsset(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.resolvedJob.target_sofa
    )
  };
}

async function runGeminiProvider(input: {
  geminiApiKey?: string;
  generationMode: "initial" | "refine";
  promptNote?: string | null;
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

  const prompt = buildFabricRenderPrompt({
    generationMode: input.generationMode,
    promptNote: input.promptNote,
    targetHeightPx: input.targetSofa.height_px,
    targetWidthPx: input.targetSofa.width_px
  });
  const geminiRequest = buildGeminiGenerateContentRequest({
    fabricReference: {
      dataBase64: uint8ArrayToBase64(input.fabricReferenceBytes),
      mimeType: input.fabricReference.content_type
    },
    prompt,
    refineSource:
      input.generationMode === "refine" && input.refineSource && input.refineSourceBytes
        ? {
            dataBase64: uint8ArrayToBase64(input.refineSourceBytes),
            mimeType: input.refineSource.content_type
          }
        : null,
    targetSofa: {
      dataBase64: uint8ArrayToBase64(input.targetSofaBytes),
      mimeType: input.targetSofa.content_type
    }
  });
  const response = await fetch(
    `${GEMINI_API_BASE_URL}/v1beta/models/${encodeURIComponent(geminiRequest.model)}:generateContent`,
    {
      body: JSON.stringify(buildGeminiRestRequestBody(geminiRequest)),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.geminiApiKey
      },
      method: "POST"
    }
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw {
      message: `Gemini returned HTTP ${response.status}: ${responseText}`,
      status: response.status
    };
  }

  const generated = extractGeminiImage(responseText ? JSON.parse(responseText) : {});

  return {
    contentType: generated.mimeType,
    outputBytes: base64ToUint8Array(generated.dataBase64)
  };
}

function buildScratchDir(jobId: string): string {
  const root = Deno.env.get("FABRIC_RENDER_TMP_DIR") ?? "/tmp";
  return `${root.replace(/\/+$/, "")}/fabric-render/${jobId}`;
}
