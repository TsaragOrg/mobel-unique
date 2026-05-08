import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import {
  convertHeicBytesToJpeg,
  shouldConvertHeic
} from "./lib/heic.ts";
import {
  COMPRESSED_JPEG_QUALITY,
  NORMALIZED_JPEG_QUALITY,
  computeResizedDimensions,
  parseMaxEdge,
  shouldCompress
} from "./lib/normalize.ts";
import {
  selectStage1Providers,
  selectStage2Providers,
  type SceneMode
} from "./lib/providers.ts";
import { decideStageFailureAction } from "./lib/retry.ts";
import {
  validateSuppliedBackWallDimensions,
  validateSuppliedCornerDimensions
} from "./lib/dimensions.ts";
import {
  errorArtifactObjectPath,
  formatErrorArtifactBody
} from "./lib/error-artifact.ts";
import {
  buildSubStepEvent,
  IN_HOME_SIMULATION_JOB_TYPE,
  type WorkerJobEventRow
} from "./lib/events.ts";
import {
  classifyDots,
  detectYellowDots,
  drawDimensionLines
} from "./lib/lines.ts";
import {
  chargeForRole,
  makeSupabaseCostMeterClient,
  parseDailyCapCents,
  type CostMeterClient,
  type ProviderRole
} from "./lib/cost-meter.ts";
import { supabaseFetchWithTimeout } from "./lib/supabase-fetch.ts";

declare const EdgeRuntime:
  | { waitUntil?: (promise: Promise<unknown>) => void }
  | undefined;

type StageOutcome = "noop" | "claimed" | "completed" | "failed" | "mixed";

type WorkerMode = "dispatch" | "checkpoint";

type SimulationCheckpointKey =
  | "room_validation"
  | "room_cleaning"
  | "room_corners"
  | "dimension_guide"
  | "awaiting_dimensions"
  | "placement_generation"
  | "placement_measurement"
  | "placement_finalize"
  | "completed"
  | "failed"
  | "expired";

type ParsedWorkerRequest =
  | { mode: "dispatch" }
  | {
      mode: "checkpoint";
      checkpointKey?: SimulationCheckpointKey;
      jobId?: string;
    };

type WorkerResponse = {
  status: StageOutcome;
  function_name: string;
  stage: "stage_1" | "stage_2" | "unknown";
  active_processing?: number;
  checkpoint_id?: string;
  checkpoint_key?: SimulationCheckpointKey;
  job_id?: string;
  job_status?: string;
  max_active_checkpoints?: number;
  mode?: WorkerMode;
  processed: number;
  recovered_checkpoints?: number;
  requeued_dispatches?: number;
  results?: Array<{
    job_id?: string;
    msg_id?: number;
    outcome: "completed" | "failed" | "skipped";
    job_status?: string;
    error?: string;
  }>;
  started_count?: number;
  worker_paused?: boolean;
  queued?: number;
  error?: string;
};

type RoomPrepClaimRow = {
  job_id: string;
  storage_prefix: string;
  customer_room_original_path: string | null;
  room_geometry_mode: "back_wall" | "corner";
  retention_deadline: string;
  room_prep_attempt_count: number;
  max_attempts_per_stage: number;
  claim_expires_at: string;
};

type PlacementClaimRow = {
  job_id: string;
  storage_prefix: string;
  room_cleaned_path: string | null;
  room_geometry_mode: "back_wall" | "corner";
  room_geometry_points: Record<string, unknown> | null;
  supplied_dimensions: Record<string, number> | null;
  prepared_sofa_asset_id: string | null;
  prepared_sofa_path: string | null;
  reserved_generation_index: number | null;
  generated_output_count: number;
  retention_deadline: string;
  placement_attempt_count: number;
  max_attempts_per_stage: number;
  claim_expires_at: string;
};

type CheckpointClaimRow = {
  checkpoint_id: string;
  job_id: string;
  checkpoint_key: SimulationCheckpointKey;
  attempt_number: number;
  max_attempts: number;
  generation_index: number | null;
  storage_prefix: string;
  customer_room_original_path: string | null;
  room_geometry_mode: "back_wall" | "corner" | null;
  room_cleaned_path: string | null;
  room_geometry_points: Record<string, unknown> | null;
  supplied_dimensions: Record<string, number> | null;
  prepared_sofa_asset_id: string | null;
  prepared_sofa_path: string | null;
  reserved_generation_index: number | null;
  generated_output_count: number;
  retention_deadline: string;
  claim_expires_at: string;
};

type CheckpointDispatchRow = {
  dispatch_id: string;
  checkpoint_id: string;
  job_id: string;
  checkpoint_key: SimulationCheckpointKey;
  attempt_count: number;
  max_attempts: number;
  generation_index: number | null;
  lock_expires_at: string;
};

type StorageAssetObjectRow = {
  bucket_id: string;
  object_path: string;
};

type CheckpointCompletion = {
  kind: "checkpoint";
  checkpointId: string;
  nextCheckpointKey: SimulationCheckpointKey;
  progressStepOrdinal?: number;
  progressTotalSteps?: number;
};

const FUNCTION_NAME = "in-home-simulation-worker";
const STORAGE_BUCKET = "simulation-private-artifacts";
// PLAN-0057: 180s claim TTL gives the watchdog cron enough margin
// after the Edge Functions 150s wall-clock to recover stuck claims
// inside ~3-4 minutes. Was 600s in PLAN-0010, which left jobs
// stranded for up to 11 minutes when the isolate died mid-fetch.
const DEFAULT_CLAIM_TTL_SECONDS = 180;
const DEFAULT_MAX_ACTIVE_CHECKPOINTS = 1;
const DEFAULT_DISPATCH_BATCH_SIZE = 10;
const DEFAULT_DISPATCH_LOCK_TTL_SECONDS = 60;
const DEFAULT_WORKER_INVOCATION_TIMEOUT_MS = 130_000;

function jsonResponse(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

function failedEnvelope(error: string, status = 500): Response {
  return jsonResponse(
    {
      status: "failed",
      function_name: FUNCTION_NAME,
      stage: "stage_1",
      processed: 0,
      error
    },
    status
  );
}

function logWorkerStep(
  event: string,
  details: Record<string, unknown> = {}
): void {
  console.info(JSON.stringify({
    event,
    function_name: FUNCTION_NAME,
    scope: "in_home_simulation_worker",
    timestamp: new Date().toISOString(),
    ...details
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSimulationCheckpointKey(
  value: unknown
): value is SimulationCheckpointKey {
  return value === "room_validation" ||
    value === "room_cleaning" ||
    value === "room_corners" ||
    value === "dimension_guide" ||
    value === "awaiting_dimensions" ||
    value === "placement_generation" ||
    value === "placement_measurement" ||
    value === "placement_finalize" ||
    value === "completed" ||
    value === "failed" ||
    value === "expired";
}

async function parseWorkerRequestBody(
  request: Request
): Promise<ParsedWorkerRequest | Response> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return failedEnvelope("In-home simulation worker request body is invalid", 400);
  }

  if (text.trim().length === 0) {
    return { mode: "dispatch" };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failedEnvelope(
      "In-home simulation worker request body must be JSON",
      400
    );
  }

  if (!isRecord(body)) {
    return failedEnvelope(
      "In-home simulation worker request body must be an object",
      400
    );
  }

  const mode = body.mode;
  if (mode === undefined || mode === null) {
    return { mode: "dispatch" };
  }

  if (mode === "dispatch") {
    return { mode: "dispatch" };
  }

  if (mode === "checkpoint") {
    const parsed: ParsedWorkerRequest = { mode: "checkpoint" };
    if (typeof body.job_id === "string" && body.job_id.trim().length > 0) {
      parsed.jobId = body.job_id.trim();
    }
    if (body.checkpoint_key !== undefined && body.checkpoint_key !== null) {
      if (!isSimulationCheckpointKey(body.checkpoint_key)) {
        return failedEnvelope(
          "In-home simulation worker checkpoint_key is invalid",
          400
        );
      }
      parsed.checkpointKey = body.checkpoint_key;
    }
    return parsed;
  }

  return failedEnvelope("In-home simulation worker mode is invalid", 400);
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function buildWorkerIdentifier(): string {
  const prefix = Deno.env.get("IN_HOME_SIMULATION_WORKER_ID_PREFIX") ?? "edge";
  return `${prefix}-${crypto.randomUUID()}`;
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

function validateWorkerInvocation(request: Request): Response | null {
  const expectedSecret = Deno.env.get(
    "IN_HOME_SIMULATION_WORKER_INVOKE_SECRET"
  );

  if (isLocalWorkerEnvironment()) {
    return null;
  }

  if (!expectedSecret) {
    return failedEnvelope(
      "Missing required environment variable: IN_HOME_SIMULATION_WORKER_INVOKE_SECRET",
      500
    );
  }

  if (
    request.headers.get("x-in-home-simulation-worker-secret") !== expectedSecret
  ) {
    return failedEnvelope(
      "In-home simulation worker invocation is unauthorized",
      401
    );
  }

  return null;
}

async function callRpc<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/${name}`,
    {
      body: JSON.stringify(body),
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey
      },
      method: "POST"
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name} rpc failed: HTTP ${response.status} ${text}`);
  }
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function claimCheckpointJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claimTtlSeconds: number,
  maxActiveCheckpoints: number,
  options: {
    checkpointKey?: SimulationCheckpointKey;
    jobId?: string;
  } = {}
): Promise<CheckpointClaimRow | null> {
  const rpcName = options.jobId || options.checkpointKey
    ? "claim_specific_in_home_simulation_checkpoint"
    : "claim_in_home_simulation_checkpoint";
  const body = options.jobId || options.checkpointKey
    ? {
        p_simulation_job_id: options.jobId ?? null,
        p_checkpoint_key: options.checkpointKey ?? null,
        p_worker_identifier: workerIdentifier,
        p_claim_ttl_seconds: claimTtlSeconds,
        p_max_active_checkpoints: maxActiveCheckpoints
      }
    : {
        p_worker_identifier: workerIdentifier,
        p_claim_ttl_seconds: claimTtlSeconds,
        p_max_active_checkpoints: maxActiveCheckpoints
      };
  const rows = await callRpc<CheckpointClaimRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    rpcName,
    body
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function claimCheckpointDispatches(
  supabaseUrl: string,
  serviceRoleKey: string,
  dispatcherIdentifier: string,
  lockTtlSeconds: number,
  batchSize: number,
  maxActiveCheckpoints: number
): Promise<CheckpointDispatchRow[]> {
  const rows = await callRpc<CheckpointDispatchRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "claim_in_home_simulation_checkpoint_dispatches",
    {
      p_dispatcher_identifier: dispatcherIdentifier,
      p_lock_ttl_seconds: lockTtlSeconds,
      p_batch_size: batchSize,
      p_max_active_checkpoints: maxActiveCheckpoints
    }
  );
  return Array.isArray(rows) ? rows : [];
}

async function recoverStaleCheckpointClaims(
  supabaseUrl: string,
  serviceRoleKey: string,
  limit: number
): Promise<number> {
  const recovered = await callRpc<number | null>(
    supabaseUrl,
    serviceRoleKey,
    "recover_stale_in_home_simulation_checkpoints",
    { p_limit: limit }
  );
  return typeof recovered === "number" ? recovered : 0;
}

async function requeueStaleCheckpointDispatches(
  supabaseUrl: string,
  serviceRoleKey: string,
  limit: number
): Promise<number> {
  const requeued = await callRpc<number | null>(
    supabaseUrl,
    serviceRoleKey,
    "requeue_stale_in_home_simulation_checkpoint_dispatches",
    { p_limit: limit }
  );
  return typeof requeued === "number" ? requeued : 0;
}

async function markCheckpointDispatchDispatched(
  supabaseUrl: string,
  serviceRoleKey: string,
  dispatcherIdentifier: string,
  dispatchId: string
): Promise<void> {
  await callRpc<unknown>(
    supabaseUrl,
    serviceRoleKey,
    "mark_in_home_simulation_checkpoint_dispatch_dispatched",
    {
      p_dispatch_id: dispatchId,
      p_dispatcher_identifier: dispatcherIdentifier
    }
  );
}

async function markCheckpointDispatchRetryable(
  supabaseUrl: string,
  serviceRoleKey: string,
  dispatcherIdentifier: string,
  input: {
    dispatchId: string;
    errorCode: string;
    errorMessage: string;
  }
): Promise<void> {
  await callRpc<unknown>(
    supabaseUrl,
    serviceRoleKey,
    "mark_in_home_simulation_checkpoint_dispatch_retryable",
    {
      p_dispatch_id: input.dispatchId,
      p_dispatcher_identifier: dispatcherIdentifier,
      p_error_code: input.errorCode,
      p_error_message: input.errorMessage,
      p_next_attempt_at: null
    }
  );
}

async function completeCheckpointClaim(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  input: {
    checkpointId: string;
    nextCheckpointKey: SimulationCheckpointKey;
    progressStepOrdinal?: number;
    progressTotalSteps?: number;
  }
): Promise<void> {
  await callRpc<unknown>(
    supabaseUrl,
    serviceRoleKey,
    "complete_in_home_simulation_checkpoint_claim",
    {
      p_checkpoint_id: input.checkpointId,
      p_worker_identifier: workerIdentifier,
      p_next_checkpoint_key: input.nextCheckpointKey,
      p_next_generation_index: null,
      p_progress_step_key: input.nextCheckpointKey,
      p_progress_step_ordinal: input.progressStepOrdinal ?? null,
      p_progress_total_steps: input.progressTotalSteps ?? null
    }
  );
}

async function releaseCheckpointClaim(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  input: {
    checkpointId: string;
    retryable: boolean;
    safeErrorCode: string;
    safeErrorMessage: string;
  }
): Promise<void> {
  await callRpc<unknown>(
    supabaseUrl,
    serviceRoleKey,
    "release_in_home_simulation_checkpoint_claim",
    {
      p_checkpoint_id: input.checkpointId,
      p_worker_identifier: workerIdentifier,
      p_safe_error_code: input.safeErrorCode,
      p_safe_error_message: input.safeErrorMessage,
      p_retryable: input.retryable
    }
  );
}

async function downloadStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  storagePath: string
): Promise<Uint8Array> {
  return await downloadStorageObjectFromBucket(
    supabaseUrl,
    serviceRoleKey,
    STORAGE_BUCKET,
    storagePath
  );
}

async function downloadStorageObjectFromBucket(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  storagePath: string
): Promise<Uint8Array> {
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/storage/v1/object/${bucketId}/${storagePath}`,
    {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey
      }
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `storage download failed for ${bucketId}/${storagePath}: HTTP ${response.status} ${text}`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function fetchStorageAssetObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  assetId: string
): Promise<StorageAssetObjectRow | null> {
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/storage_assets?id=eq.${assetId}&select=bucket_id,object_path,lifecycle_state`,
    {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey
      }
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `storage asset lookup failed for ${assetId}: HTTP ${response.status} ${text}`
    );
  }
  const rows = await response.json() as Array<
    StorageAssetObjectRow & { lifecycle_state?: string }
  >;
  const row = rows[0];
  if (!row || row.lifecycle_state !== "active") {
    return null;
  }
  return {
    bucket_id: row.bucket_id,
    object_path: row.object_path
  };
}

async function uploadStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  storagePath: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const body: ArrayBuffer = new Uint8Array(bytes).buffer;
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `storage upload failed for ${storagePath}: HTTP ${response.status} ${text}`
    );
  }
}

async function persistErrorArtifact(
  supabaseUrl: string,
  serviceRoleKey: string,
  storagePrefix: string,
  jobId: string,
  stage: string,
  errorCode: string,
  errorMessage: string
): Promise<string | null> {
  try {
    const path = errorArtifactObjectPath(storagePrefix);
    const body = formatErrorArtifactBody({
      jobId,
      stage,
      errorCode,
      errorMessage
    });
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      path,
      new TextEncoder().encode(body),
      "text/plain; charset=utf-8"
    );
    return path;
  } catch (_error) {
    // Best-effort persistence: a failed worker_error.txt upload must
    // not mask the original failure on the job row.
    return null;
  }
}

async function recordWorkerEvent(
  supabaseUrl: string,
  serviceRoleKey: string,
  event: WorkerJobEventRow
): Promise<void> {
  // Best-effort observability write. A failed event insert must not
  // mask the real success or failure on the job row.
  try {
    await supabaseFetchWithTimeout(
      `${supabaseUrl}/rest/v1/worker_job_events`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(event)
      }
    );
  } catch (_error) {
    /* swallow */
  }
}

async function failJobNonRetryable(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  errorCode: string,
  errorMessage: string,
  options: { storagePrefix?: string; stage?: string } = {}
): Promise<void> {
  let workerErrorPath: string | null = null;
  if (options.storagePrefix) {
    workerErrorPath = await persistErrorArtifact(
      supabaseUrl,
      serviceRoleKey,
      options.storagePrefix,
      jobId,
      options.stage ?? "stage_1",
      errorCode,
      errorMessage
    );
  }

  const patch: Record<string, unknown> = {
    status: "failed",
    last_error_code: errorCode,
    last_error_message: errorMessage,
    claim_expires_at: null,
    updated_at: new Date().toISOString()
  };
  if (workerErrorPath) {
    patch.worker_error_path = workerErrorPath;
  }

  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=eq.${jobId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(patch)
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `failed-status update on job ${jobId} did not apply: HTTP ${response.status} ${text}`
    );
  }
}

type InHomeSimulationJobCheckpointRow = {
  room_normalized_path: string | null;
  room_compressed_path: string | null;
  room_cleaned_path: string | null;
  room_geometry_points: unknown | null;
};

async function fetchInHomeSimulationJobRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string
): Promise<InHomeSimulationJobCheckpointRow> {
  const select = [
    "room_normalized_path",
    "room_compressed_path",
    "room_cleaned_path",
    "room_geometry_points"
  ].join(",");
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=eq.${jobId}&select=${select}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Accept": "application/json"
      }
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `fetch in_home_simulation_jobs row ${jobId} failed: HTTP ${response.status} ${text}`
    );
  }
  const rows = (await response.json()) as InHomeSimulationJobCheckpointRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      `in_home_simulation_jobs row ${jobId} not found while resolving checkpoint state`
    );
  }
  return rows[0];
}

async function persistValidateCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  paths: {
    roomNormalizedPath: string;
    roomCompressedPath: string;
  }
): Promise<void> {
  const patch = {
    room_normalized_path: paths.roomNormalizedPath,
    room_compressed_path: paths.roomCompressedPath,
    updated_at: new Date().toISOString()
  };
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=eq.${jobId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(patch)
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `validate checkpoint persist failed for job ${jobId}: HTTP ${response.status} ${text}`
    );
  }
}

async function persistCleaningCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  paths: {
    roomCleanedPath: string;
  }
): Promise<void> {
  const patch = {
    room_cleaned_path: paths.roomCleanedPath,
    updated_at: new Date().toISOString()
  };
  const response = await supabaseFetchWithTimeout(
    `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=eq.${jobId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(patch)
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `cleaning checkpoint persist failed for job ${jobId}: HTTP ${response.status} ${text}`
    );
  }
}

async function createScratchDir(jobId: string): Promise<string> {
  const envRoot = Deno.env.get("IN_HOME_SIMULATION_TMP_DIR");
  const root = envRoot && envRoot.length > 0
    ? envRoot
    : await Deno.makeTempDir({ prefix: "in-home-simulation-" });
  const jobDir = `${root}/${jobId}`;
  await Deno.mkdir(jobDir, { recursive: true });
  return jobDir;
}

async function removeScratchDir(jobDir: string): Promise<void> {
  try {
    await Deno.remove(jobDir, { recursive: true });
  } catch (_error) {
    // Best-effort cleanup. A leaked scratch folder is recoverable through
    // the Edge Function host's tmp cleanup and is not a hard error.
  }
}

async function runValidateCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: RoomPrepClaimRow,
  completion: CheckpointCompletion
): Promise<void> {
  if (!claim.customer_room_original_path) {
    throw new Error(
      "customer_room_original_path is null on the claimed job; refusing to process"
    );
  }

  // PLAN-0058 observability: emit start event before any provider call.
  await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: claim.job_id,
    fabric_render_job_id: null,
    from_status: null,
    to_status: null,
    event_type: "stage_1_validate_checkpoint_started",
    message: `worker ${workerIdentifier} entered validate checkpoint`,
    metadata: {
      worker_identifier: workerIdentifier,
      attempt: claim.room_prep_attempt_count,
      room_geometry_mode: claim.room_geometry_mode
    }
  });
  logWorkerStep("room_validation_started", {
    attempt: claim.room_prep_attempt_count,
    job_id: claim.job_id,
    room_geometry_mode: claim.room_geometry_mode,
    worker_identifier: workerIdentifier
  });

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage1Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );

  const costMeter = makeSupabaseCostMeterClient({
    supabaseUrl,
    serviceRoleKey
  });
  const dailyCapCents = parseDailyCapCents(
    Deno.env.get("SIMULATION_DAILY_COST_CAP_USD")
  );
  const chargeMeter = (role: ProviderRole) =>
    chargeForRole(costMeter, role, dailyCapCents, (message) =>
      console.warn(message)
    );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    logWorkerStep("room_validation_download_original_started", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    const sourceBytes = await downloadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      claim.customer_room_original_path
    );
    logWorkerStep("room_validation_download_original_completed", {
      byte_length: sourceBytes.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    await Deno.writeFile(`${scratchDir}/room_original.bin`, sourceBytes);

    let bytesForDecode = sourceBytes;
    if (shouldConvertHeic(sourceBytes, claim.customer_room_original_path)) {
      try {
        logWorkerStep("room_validation_heic_conversion_started", {
          job_id: claim.job_id,
          worker_identifier: workerIdentifier
        });
        const conversion = await convertHeicBytesToJpeg(
          sourceBytes,
          NORMALIZED_JPEG_QUALITY,
          {
            encodeJpeg: async (rgba, width, height, quality) => {
              const image = new Image(width, height);
              image.bitmap.set(rgba);
              return await image.encodeJPEG(quality);
            }
          }
        );
        bytesForDecode = conversion.jpegBytes;
        logWorkerStep("room_validation_heic_conversion_completed", {
          byte_length: bytesForDecode.length,
          job_id: claim.job_id,
          worker_identifier: workerIdentifier
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logWorkerStep("room_validation_heic_conversion_failed", {
          error_message: message,
          job_id: claim.job_id,
          worker_identifier: workerIdentifier
        });
        await failJobNonRetryable(
          supabaseUrl,
          serviceRoleKey,
          claim.job_id,
          "unsupported_format",
          `Could not convert HEIC/HEIF input: ${message}`,
          { storagePrefix: claim.storage_prefix, stage: "stage_1" }
        );
        throw new Error(`heic conversion failed: ${message}`);
      }
    }

    let decoded: Image;
    try {
      logWorkerStep("room_validation_decode_started", {
        byte_length: bytesForDecode.length,
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      decoded = (await decode(bytesForDecode)) as Image;
      logWorkerStep("room_validation_decode_completed", {
        height: decoded.height,
        job_id: claim.job_id,
        width: decoded.width,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "decode_failed",
        `Could not decode the customer room photo: ${message}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`decode failed: ${message}`);
    }

    const normalizedBytes = await decoded.encodeJPEG(NORMALIZED_JPEG_QUALITY);
    await Deno.writeFile(`${scratchDir}/room_normalized.jpg`, normalizedBytes);

    logWorkerStep("room_validation_provider_started", {
      job_id: claim.job_id,
      provider_name: providers.validation.name,
      worker_identifier: workerIdentifier
    });
    const validationResult = await providers.validation.validateRoom(
      normalizedBytes
    );
    await chargeMeter("validation");
    logWorkerStep("room_validation_provider_completed", {
      job_id: claim.job_id,
      ok: validationResult.ok,
      provider_name: providers.validation.name,
      worker_identifier: workerIdentifier
    });
    if (!validationResult.ok) {
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "validation_rejected",
        `Validation provider rejected the room photo: ${validationResult.failureReason}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(
        `validation rejected: ${validationResult.failureReason}`
      );
    }

    const maxEdge = parseMaxEdge(
      Deno.env.get("IN_HOME_SIMULATION_MAX_EDGE_PX")
    );
    let compressedImage: Image = decoded;
    if (
      shouldCompress(
        { width: decoded.width, height: decoded.height },
        maxEdge
      )
    ) {
      const target = computeResizedDimensions(
        { width: decoded.width, height: decoded.height },
        maxEdge
      );
      compressedImage = (decoded.clone() as Image).resize(
        target.width,
        target.height
      );
    }
    const compressedBytes = await compressedImage.encodeJPEG(
      COMPRESSED_JPEG_QUALITY
    );
    await Deno.writeFile(`${scratchDir}/room_compressed.jpg`, compressedBytes);

    const normalizedPath = `${claim.storage_prefix}/room_normalized.jpg`;
    const compressedPath = `${claim.storage_prefix}/room_compressed.jpg`;

    logWorkerStep("room_validation_upload_artifacts_started", {
      compressed_byte_length: compressedBytes.length,
      job_id: claim.job_id,
      normalized_byte_length: normalizedBytes.length,
      worker_identifier: workerIdentifier
    });
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      normalizedPath,
      normalizedBytes,
      "image/jpeg"
    );
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      compressedPath,
      compressedBytes,
      "image/jpeg"
    );
    logWorkerStep("room_validation_upload_artifacts_completed", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await persistValidateCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id,
      {
        roomNormalizedPath: normalizedPath,
        roomCompressedPath: compressedPath
      }
    );
    logWorkerStep("room_validation_persisted", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await completeCheckpointClaim(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      completion
    );
    logWorkerStep("room_validation_next_checkpoint_ready", {
      job_id: claim.job_id,
      next_checkpoint_key: completion.nextCheckpointKey,
      worker_identifier: workerIdentifier
    });

    await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
      job_type: IN_HOME_SIMULATION_JOB_TYPE,
      in_home_simulation_job_id: claim.job_id,
      fabric_render_job_id: null,
      from_status: null,
      to_status: null,
      event_type: "stage_1_validate_checkpoint_completed",
      message: `worker ${workerIdentifier} completed validate checkpoint; cleaning checkpoint enqueued`,
      metadata: {
        room_normalized_path: normalizedPath,
        room_compressed_path: compressedPath
      }
    });
  } finally {
    await removeScratchDir(scratchDir);
  }
}

async function runCleaningCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: RoomPrepClaimRow,
  checkpoint: InHomeSimulationJobCheckpointRow,
  completion: CheckpointCompletion
): Promise<void> {
  if (!checkpoint.room_compressed_path) {
    throw new Error(
      "runCleaningCheckpoint called without a persisted room_compressed_path"
    );
  }

  // PLAN-0056 observability: emit start event before the long
  // OpenAI cleaning fetch. Without it the timeline is blank when
  // the isolate dies inside `cleanRoom`.
  await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: claim.job_id,
    fabric_render_job_id: null,
    from_status: null,
    to_status: null,
    event_type: "stage_1_cleaning_checkpoint_started",
    message: `worker ${workerIdentifier} entered cleaning checkpoint`,
    metadata: {
      worker_identifier: workerIdentifier,
      attempt: claim.room_prep_attempt_count,
      room_geometry_mode: claim.room_geometry_mode
    }
  });
  logWorkerStep("room_cleaning_started", {
    attempt: claim.room_prep_attempt_count,
    job_id: claim.job_id,
    room_geometry_mode: claim.room_geometry_mode,
    worker_identifier: workerIdentifier
  });

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage1Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );

  const costMeter = makeSupabaseCostMeterClient({
    supabaseUrl,
    serviceRoleKey
  });
  const dailyCapCents = parseDailyCapCents(
    Deno.env.get("SIMULATION_DAILY_COST_CAP_USD")
  );
  const chargeMeter = (role: ProviderRole) =>
    chargeForRole(costMeter, role, dailyCapCents, (message) =>
      console.warn(message)
    );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    logWorkerStep("room_cleaning_download_compressed_started", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    const compressedBytes = await downloadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      checkpoint.room_compressed_path
    );
    logWorkerStep("room_cleaning_download_compressed_completed", {
      byte_length: compressedBytes.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    let cleanedRawBytes: Uint8Array;
    try {
      logWorkerStep("room_cleaning_provider_started", {
        job_id: claim.job_id,
        provider_name: providers.cleaning.name,
        worker_identifier: workerIdentifier
      });
      cleanedRawBytes = await providers.cleaning.cleanRoom(compressedBytes);
      await chargeMeter("cleaning");
      logWorkerStep("room_cleaning_provider_completed", {
        byte_length: cleanedRawBytes.length,
        job_id: claim.job_id,
        provider_name: providers.cleaning.name,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.toLowerCase().includes("no image data") ||
          message.toLowerCase().includes("zero bytes")
        ? "provider_no_image_data"
        : "cleaning_failed";
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        code,
        `Cleaning provider failed: ${message}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`${code}: ${message}`);
    }
    if (!cleanedRawBytes || cleanedRawBytes.length === 0) {
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "provider_no_image_data",
        "Cleaning provider returned no image data",
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(
        "provider_no_image_data: cleaning provider returned no image data"
      );
    }
    let cleanedImage: Image;
    try {
      logWorkerStep("room_cleaning_decode_started", {
        byte_length: cleanedRawBytes.length,
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      cleanedImage = (await decode(cleanedRawBytes)) as Image;
      logWorkerStep("room_cleaning_decode_completed", {
        height: cleanedImage.height,
        job_id: claim.job_id,
        width: cleanedImage.width,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "cleaning_decode_failed",
        `Could not decode the cleaned room artifact: ${message}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`cleaning decode failed: ${message}`);
    }
    const cleanedBytes = await cleanedImage.encode(0);
    await Deno.writeFile(`${scratchDir}/room_cleaned.png`, cleanedBytes);

    const cleanedPath = `${claim.storage_prefix}/room_cleaned.png`;

    logWorkerStep("room_cleaning_upload_artifact_started", {
      byte_length: cleanedBytes.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      cleanedPath,
      cleanedBytes,
      "image/png"
    );
    logWorkerStep("room_cleaning_upload_artifact_completed", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await persistCleaningCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id,
      { roomCleanedPath: cleanedPath }
    );
    logWorkerStep("room_cleaning_persisted", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await completeCheckpointClaim(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      completion
    );
    logWorkerStep("room_cleaning_next_checkpoint_ready", {
      job_id: claim.job_id,
      next_checkpoint_key: completion.nextCheckpointKey,
      worker_identifier: workerIdentifier
    });

    await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
      job_type: IN_HOME_SIMULATION_JOB_TYPE,
      in_home_simulation_job_id: claim.job_id,
      fabric_render_job_id: null,
      from_status: null,
      to_status: null,
      event_type: "stage_1_cleaning_checkpoint_completed",
      message: `worker ${workerIdentifier} completed cleaning checkpoint; corners checkpoint enqueued`,
      metadata: {
        room_cleaned_path: cleanedPath
      }
    });
  } finally {
    await removeScratchDir(scratchDir);
  }
}

async function runCornersCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: RoomPrepClaimRow,
  checkpoint: InHomeSimulationJobCheckpointRow,
  completion: CheckpointCompletion
): Promise<void> {
  if (!checkpoint.room_cleaned_path) {
    throw new Error(
      "runCornersCheckpoint called without a persisted room_cleaned_path"
    );
  }
  if (!checkpoint.room_normalized_path || !checkpoint.room_compressed_path) {
    throw new Error(
      "runCornersCheckpoint requires room_normalized_path and room_compressed_path on the job row"
    );
  }

  // PLAN-0056 observability: same rationale as the cleaning
  // checkpoint — emit a marker before the corners OpenAI fetch so the
  // timeline shows the corners step entered even when the isolate
  // later dies mid-fetch.
  await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: claim.job_id,
    fabric_render_job_id: null,
    from_status: null,
    to_status: null,
    event_type: "stage_1_corners_checkpoint_started",
    message:
      `worker ${workerIdentifier} entered corners checkpoint`,
    metadata: {
      worker_identifier: workerIdentifier,
      attempt: claim.room_prep_attempt_count,
      room_geometry_mode: claim.room_geometry_mode
    }
  });
  logWorkerStep("room_corners_started", {
    attempt: claim.room_prep_attempt_count,
    job_id: claim.job_id,
    room_geometry_mode: claim.room_geometry_mode,
    worker_identifier: workerIdentifier
  });

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage1Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );

  const costMeter = makeSupabaseCostMeterClient({
    supabaseUrl,
    serviceRoleKey
  });
  const dailyCapCents = parseDailyCapCents(
    Deno.env.get("SIMULATION_DAILY_COST_CAP_USD")
  );
  const chargeMeter = (role: ProviderRole) =>
    chargeForRole(costMeter, role, dailyCapCents, (message) =>
      console.warn(message)
    );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    let cleanedBytes: Uint8Array;
    try {
      logWorkerStep("room_corners_download_cleaned_started", {
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      cleanedBytes = await downloadStorageObject(
        supabaseUrl,
        serviceRoleKey,
        checkpoint.room_cleaned_path
      );
      logWorkerStep("room_corners_download_cleaned_completed", {
        byte_length: cleanedBytes.length,
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "cleaning_artifact_missing",
        `Cleaning checkpoint artifact missing in storage: ${message}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`cleaning_artifact_missing: ${message}`);
    }
    await Deno.writeFile(`${scratchDir}/room_cleaned.png`, cleanedBytes);

    const mode: "back_wall" | "corner" = claim.room_geometry_mode;
    const sceneConfidence: number | null = null;

    logWorkerStep("room_corners_provider_started", {
      job_id: claim.job_id,
      provider_name: providers.corners.name,
      room_geometry_mode: mode,
      worker_identifier: workerIdentifier
    });
    const cornersResult = await providers.corners.placeCornerDots(
      cleanedBytes,
      mode
    );
    await chargeMeter("corners");
    logWorkerStep("room_corners_provider_completed", {
      job_id: claim.job_id,
      ok: cornersResult.ok,
      provider_name: providers.corners.name,
      worker_identifier: workerIdentifier
    });
    if (!cornersResult.ok) {
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "corners_failed",
        `Corners provider failed: ${cornersResult.failureReason}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(
        `corners_failed: ${cornersResult.failureReason}`
      );
    }
    const annotatedBytes = cornersResult.pngBytes;
    await Deno.writeFile(`${scratchDir}/room_corners.png`, annotatedBytes);

    let annotatedImage: Image;
    try {
      logWorkerStep("room_corners_decode_started", {
        byte_length: annotatedBytes.length,
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      annotatedImage = (await decode(annotatedBytes)) as Image;
      logWorkerStep("room_corners_decode_completed", {
        height: annotatedImage.height,
        job_id: claim.job_id,
        width: annotatedImage.width,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "corners_decode_failed",
        `Could not decode the corners artifact: ${message}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`corners decode failed: ${message}`);
    }
    const detectedDots = detectYellowDots(annotatedImage);
    logWorkerStep("room_corners_dots_detected", {
      detected_dot_count: detectedDots.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    const classification = classifyDots(detectedDots);
    if (!classification.ok) {
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "dot_classification_failed",
        `Dot classification failed: ${classification.failureReason}`,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(
        `dot_classification_failed: ${classification.failureReason}`
      );
    }
    logWorkerStep("room_corners_dots_classified", {
      job_id: claim.job_id,
      mode: classification.corners.mode,
      worker_identifier: workerIdentifier
    });
    await drawDimensionLines(annotatedImage, classification.corners);
    const dimensionsBytes = await annotatedImage.encode(0);
    await Deno.writeFile(
      `${scratchDir}/room_dimensions.png`,
      dimensionsBytes
    );

    const geometryForPersist = {
      mode: classification.corners.mode,
      classified: classification.corners,
      detected_dots: detectedDots
    };

    const cornersPath = `${claim.storage_prefix}/room_corners.png`;
    const dimensionsPath = `${claim.storage_prefix}/room_dimensions.png`;

    logWorkerStep("room_corners_upload_artifacts_started", {
      corners_byte_length: annotatedBytes.length,
      dimensions_byte_length: dimensionsBytes.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      cornersPath,
      annotatedBytes,
      "image/png"
    );
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      dimensionsPath,
      dimensionsBytes,
      "image/png"
    );
    logWorkerStep("room_corners_upload_artifacts_completed", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await callRpc<void>(
      supabaseUrl,
      serviceRoleKey,
      "complete_in_home_simulation_room_prep_stage",
      {
        job_id: claim.job_id,
        worker_identifier: workerIdentifier,
        room_normalized_path: checkpoint.room_normalized_path,
        room_compressed_path: checkpoint.room_compressed_path,
        room_cleaned_path: checkpoint.room_cleaned_path,
        dimension_guide_overlay_path: dimensionsPath,
        room_geometry_mode: mode,
        room_geometry_points: geometryForPersist,
        room_geometry_confidence: sceneConfidence
      }
    );
    logWorkerStep("room_corners_persisted", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await completeCheckpointClaim(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      completion
    );
    logWorkerStep("room_corners_next_checkpoint_ready", {
      job_id: claim.job_id,
      next_checkpoint_key: completion.nextCheckpointKey,
      worker_identifier: workerIdentifier
    });
  } finally {
    await removeScratchDir(scratchDir);
  }
}

const SOFA_PLACEHOLDER_COLOR = 0x8b5a2bff;

function stampSofaRectangle(
  cleanedImage: Image,
  geometry: PlacementClaimRow["room_geometry_points"]
): Image {
  // Mock placement: stamp a brown rectangle that suggests where the
  // sofa would sit. Real placement replaces this with provider output.
  const stamped = cleanedImage.clone() as Image;
  const sofaWidth = Math.round(cleanedImage.width * 0.5);
  const sofaHeight = Math.round(cleanedImage.height * 0.18);
  const sofaX = Math.round((cleanedImage.width - sofaWidth) / 2);
  const sofaY = Math.round(cleanedImage.height * 0.6);
  stamped.drawBox(
    sofaX,
    sofaY,
    sofaWidth,
    sofaHeight,
    SOFA_PLACEHOLDER_COLOR
  );
  // Suppress unused-parameter warnings in Deno; geometry will be used
  // by real placement implementations to align the sofa with the
  // detected wall or corner.
  void geometry;
  return stamped;
}

async function processPlacementJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: PlacementClaimRow,
  completion: CheckpointCompletion
): Promise<void> {
  if (!claim.room_cleaned_path) {
    throw new Error(
      `job ${claim.job_id} has no room_cleaned_path; refusing Stage 2`
    );
  }

  // PLAN-0056 observability: emit a placement-started marker so the
  // job timeline shows Stage 2 entered even if the OpenAI fetch
  // exceeds the Edge Function wall-clock and the isolate dies inside
  // the placement loop.
  await recordWorkerEvent(supabaseUrl, serviceRoleKey, {
    job_type: IN_HOME_SIMULATION_JOB_TYPE,
    in_home_simulation_job_id: claim.job_id,
    fabric_render_job_id: null,
    from_status: null,
    to_status: null,
    event_type: "stage_2_placement_started",
    message: `worker ${workerIdentifier} entered placement`,
    metadata: {
      worker_identifier: workerIdentifier,
      attempt: claim.placement_attempt_count,
      room_geometry_mode: claim.room_geometry_mode
    }
  });
  logWorkerStep("placement_started", {
    attempt: claim.placement_attempt_count,
    generated_output_count: claim.generated_output_count,
    job_id: claim.job_id,
    reserved_generation_index: claim.reserved_generation_index,
    room_geometry_mode: claim.room_geometry_mode,
    worker_identifier: workerIdentifier
  });

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage2Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );

  const costMeter = makeSupabaseCostMeterClient({
    supabaseUrl,
    serviceRoleKey
  });
  const dailyCapCents = parseDailyCapCents(
    Deno.env.get("SIMULATION_DAILY_COST_CAP_USD")
  );
  const chargeMeter = (role: ProviderRole) =>
    chargeForRole(costMeter, role, dailyCapCents, (message) =>
      console.warn(message)
    );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    logWorkerStep("placement_download_cleaned_started", {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    const cleanedRawBytes = await downloadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      claim.room_cleaned_path
    );
    logWorkerStep("placement_download_cleaned_completed", {
      byte_length: cleanedRawBytes.length,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    let cleanedImage: Image;
    try {
      logWorkerStep("placement_decode_cleaned_started", {
        byte_length: cleanedRawBytes.length,
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      cleanedImage = (await decode(cleanedRawBytes)) as Image;
      logWorkerStep("placement_decode_cleaned_completed", {
        height: cleanedImage.height,
        job_id: claim.job_id,
        width: cleanedImage.width,
        worker_identifier: workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await callRpc<string>(
        supabaseUrl,
        serviceRoleKey,
        "record_in_home_simulation_placement_failure",
        {
          job_id: claim.job_id,
          worker_identifier: workerIdentifier,
          error_code: "cleaned_decode_failed",
          error_message: `Could not decode the cleaned room artifact: ${message}`
        }
      );
      throw new Error(`cleaned decode failed: ${message}`);
    }

    let preparedSofaBytes: Uint8Array | null = null;
    let preparedSofaObject: StorageAssetObjectRow | null = null;
    if (claim.prepared_sofa_path) {
      preparedSofaObject = {
        bucket_id: STORAGE_BUCKET,
        object_path: claim.prepared_sofa_path
      };
    } else if (claim.prepared_sofa_asset_id) {
      preparedSofaObject = await fetchStorageAssetObject(
        supabaseUrl,
        serviceRoleKey,
        claim.prepared_sofa_asset_id
      );
    }

    if (preparedSofaObject) {
      try {
        logWorkerStep("placement_download_prepared_sofa_started", {
          bucket_id: preparedSofaObject.bucket_id,
          job_id: claim.job_id,
          object_path: preparedSofaObject.object_path,
          worker_identifier: workerIdentifier
        });
        preparedSofaBytes = await downloadStorageObjectFromBucket(
          supabaseUrl,
          serviceRoleKey,
          preparedSofaObject.bucket_id,
          preparedSofaObject.object_path
        );
        logWorkerStep("placement_download_prepared_sofa_completed", {
          byte_length: preparedSofaBytes.length,
          job_id: claim.job_id,
          worker_identifier: workerIdentifier
        });
      } catch (_error) {
        // The mock placement provider does not require the prepared
        // sofa bytes; real providers must, and will fail fast at
        // their own boundary when the asset is missing.
        preparedSofaBytes = null;
        logWorkerStep("placement_download_prepared_sofa_failed_nonfatal", {
          job_id: claim.job_id,
          prepared_sofa_asset_id: claim.prepared_sofa_asset_id,
          worker_identifier: workerIdentifier
        });
      }
    }

    const suppliedDimensions = (claim.supplied_dimensions ?? {}) as Record<
      string,
      number
    >;

    const dimensionsCheck = claim.room_geometry_mode === "back_wall"
      ? validateSuppliedBackWallDimensions(suppliedDimensions)
      : validateSuppliedCornerDimensions(suppliedDimensions);
    logWorkerStep("placement_dimensions_validated", {
      job_id: claim.job_id,
      ok: dimensionsCheck.ok,
      room_geometry_mode: claim.room_geometry_mode,
      worker_identifier: workerIdentifier
    });
    if (!dimensionsCheck.ok) {
      await callRpc<string>(
        supabaseUrl,
        serviceRoleKey,
        "record_in_home_simulation_placement_failure",
        {
          job_id: claim.job_id,
          worker_identifier: workerIdentifier,
          error_code: "supplied_dimensions_invalid",
          error_message: dimensionsCheck.failureReason
        }
      );
      throw new Error(
        `supplied_dimensions_invalid: ${dimensionsCheck.failureReason}`
      );
    }

    const positionRaw = (claim.supplied_dimensions as
      | Record<string, unknown>
      | null)?.position;
    const position: "left" | "center" | "right" | undefined =
      positionRaw === "left" || positionRaw === "right" ||
        positionRaw === "center"
        ? positionRaw
        : undefined;

    logWorkerStep("placement_provider_started", {
      has_prepared_sofa_bytes: preparedSofaBytes !== null,
      job_id: claim.job_id,
      provider_name: providers.placement.name,
      room_geometry_mode: claim.room_geometry_mode,
      worker_identifier: workerIdentifier
    });
    const placementResult = await providers.placement.placeSofa({
      cleanedRoomBytes: cleanedRawBytes,
      cleanedRoomWidth: cleanedImage.width,
      cleanedRoomHeight: cleanedImage.height,
      preparedSofaBytes,
      mode: claim.room_geometry_mode,
      suppliedDimensions,
      position
    });
    await chargeMeter("placement");
    logWorkerStep("placement_provider_completed", {
      byte_length: placementResult.ok ? placementResult.pngBytes.length : 0,
      job_id: claim.job_id,
      ok: placementResult.ok,
      provider_name: providers.placement.name,
      worker_identifier: workerIdentifier
    });

    if (!placementResult.ok) {
      await callRpc<string>(
        supabaseUrl,
        serviceRoleKey,
        "record_in_home_simulation_placement_failure",
        {
          job_id: claim.job_id,
          worker_identifier: workerIdentifier,
          error_code: "placement_failed",
          error_message: placementResult.failureReason
        }
      );
      throw new Error(`placement failed: ${placementResult.failureReason}`);
    }

    let outputImage: Image;
    if (placementResult.pngBytes.length === 0) {
      logWorkerStep("placement_placeholder_output_used", {
        job_id: claim.job_id,
        worker_identifier: workerIdentifier
      });
      outputImage = stampSofaRectangle(cleanedImage, claim.room_geometry_points);
    } else {
      try {
        logWorkerStep("placement_decode_output_started", {
          byte_length: placementResult.pngBytes.length,
          job_id: claim.job_id,
          worker_identifier: workerIdentifier
        });
        outputImage = (await decode(placementResult.pngBytes)) as Image;
        logWorkerStep("placement_decode_output_completed", {
          height: outputImage.height,
          job_id: claim.job_id,
          width: outputImage.width,
          worker_identifier: workerIdentifier
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await callRpc<string>(
          supabaseUrl,
          serviceRoleKey,
          "record_in_home_simulation_placement_failure",
          {
            job_id: claim.job_id,
            worker_identifier: workerIdentifier,
            error_code: "placement_decode_failed",
            error_message: `Could not decode the placement output: ${message}`
          }
        );
        throw new Error(`placement decode failed: ${message}`);
      }
    }

    if (
      outputImage.width !== cleanedImage.width ||
      outputImage.height !== cleanedImage.height
    ) {
      outputImage = (outputImage.clone() as Image).resize(
        cleanedImage.width,
        cleanedImage.height
      );
    }

    const outputBytes = await outputImage.encode(0);
    await Deno.writeFile(`${scratchDir}/output.png`, outputBytes);

    const generationIndex = claim.reserved_generation_index ??
      claim.generated_output_count;
    const outputPath =
      `${claim.storage_prefix}/outputs/output-${generationIndex}.png`;

    logWorkerStep("placement_upload_output_started", {
      byte_length: outputBytes.length,
      generation_index: generationIndex,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      outputPath,
      outputBytes,
      "image/png"
    );
    logWorkerStep("placement_upload_output_completed", {
      generation_index: generationIndex,
      job_id: claim.job_id,
      worker_identifier: workerIdentifier
    });

    await callRpc<void>(
      supabaseUrl,
      serviceRoleKey,
      "complete_in_home_simulation_placement_stage",
      {
        job_id: claim.job_id,
        worker_identifier: workerIdentifier,
        generation_index: generationIndex,
        output_object_path: outputPath,
        output_content_type: "image/png",
        output_width_px: outputImage.width,
        output_height_px: outputImage.height,
        provider_name: providers.placement.name,
        provider_model: providers.placement.modelId,
        prompt_version: providers.placement.promptVersion,
        prepared_sofa_path: claim.prepared_sofa_path
      }
    );
    logWorkerStep("placement_persisted", {
      generation_index: generationIndex,
      job_id: claim.job_id,
      provider_name: providers.placement.name,
      worker_identifier: workerIdentifier
    });
    await completeCheckpointClaim(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      completion
    );
    logWorkerStep("placement_next_checkpoint_ready", {
      generation_index: generationIndex,
      job_id: claim.job_id,
      next_checkpoint_key: completion.nextCheckpointKey,
      worker_identifier: workerIdentifier
    });
  } finally {
    await removeScratchDir(scratchDir);
  }
}

function roomPrepClaimFromCheckpoint(
  claim: CheckpointClaimRow
): RoomPrepClaimRow {
  if (claim.room_geometry_mode !== "back_wall" && claim.room_geometry_mode !== "corner") {
    throw new Error(
      `checkpoint ${claim.checkpoint_id} has invalid room_geometry_mode`
    );
  }
  return {
    job_id: claim.job_id,
    storage_prefix: claim.storage_prefix,
    customer_room_original_path: claim.customer_room_original_path,
    room_geometry_mode: claim.room_geometry_mode,
    retention_deadline: claim.retention_deadline,
    room_prep_attempt_count: claim.attempt_number,
    max_attempts_per_stage: claim.max_attempts,
    claim_expires_at: claim.claim_expires_at
  };
}

function placementClaimFromCheckpoint(
  claim: CheckpointClaimRow
): PlacementClaimRow {
  if (claim.room_geometry_mode !== "back_wall" && claim.room_geometry_mode !== "corner") {
    throw new Error(
      `checkpoint ${claim.checkpoint_id} has invalid room_geometry_mode`
    );
  }
  return {
    job_id: claim.job_id,
    storage_prefix: claim.storage_prefix,
    room_cleaned_path: claim.room_cleaned_path,
    room_geometry_mode: claim.room_geometry_mode,
    room_geometry_points: claim.room_geometry_points,
    supplied_dimensions: claim.supplied_dimensions,
    prepared_sofa_asset_id: claim.prepared_sofa_asset_id,
    prepared_sofa_path: claim.prepared_sofa_path,
    reserved_generation_index: claim.reserved_generation_index,
    generated_output_count: claim.generated_output_count,
    retention_deadline: claim.retention_deadline,
    placement_attempt_count: claim.attempt_number,
    max_attempts_per_stage: claim.max_attempts,
    claim_expires_at: claim.claim_expires_at
  };
}

function stageForCheckpoint(
  checkpointKey: SimulationCheckpointKey
): "stage_1" | "stage_2" {
  return checkpointKey.startsWith("placement_") ? "stage_2" : "stage_1";
}

async function processClaimedCheckpoint(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: CheckpointClaimRow
): Promise<string> {
  logWorkerStep("checkpoint_processing_started", {
    checkpoint_id: claim.checkpoint_id,
    checkpoint_key: claim.checkpoint_key,
    generation_index: claim.generation_index,
    job_id: claim.job_id,
    worker_identifier: workerIdentifier
  });

  if (claim.checkpoint_key === "room_validation") {
    await runValidateCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      roomPrepClaimFromCheckpoint(claim),
      {
        kind: "checkpoint",
        checkpointId: claim.checkpoint_id,
        nextCheckpointKey: "room_cleaning",
        progressStepOrdinal: 1,
        progressTotalSteps: 4
      }
    );
    return "room_validation_completed";
  }

  if (claim.checkpoint_key === "room_cleaning") {
    const checkpoint = await fetchInHomeSimulationJobRow(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id
    );
    await runCleaningCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      roomPrepClaimFromCheckpoint(claim),
      checkpoint,
      {
        kind: "checkpoint",
        checkpointId: claim.checkpoint_id,
        nextCheckpointKey: "room_corners",
        progressStepOrdinal: 2,
        progressTotalSteps: 4
      }
    );
    return "room_cleaning_completed";
  }

  if (claim.checkpoint_key === "room_corners") {
    const checkpoint = await fetchInHomeSimulationJobRow(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id
    );
    await runCornersCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      roomPrepClaimFromCheckpoint(claim),
      checkpoint,
      {
        kind: "checkpoint",
        checkpointId: claim.checkpoint_id,
        nextCheckpointKey: "awaiting_dimensions",
        progressStepOrdinal: 3,
        progressTotalSteps: 4
      }
    );
    return "room_corners_completed";
  }

  if (claim.checkpoint_key === "placement_generation") {
    await processPlacementJob(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      placementClaimFromCheckpoint(claim),
      {
        kind: "checkpoint",
        checkpointId: claim.checkpoint_id,
        nextCheckpointKey: "completed",
        progressStepOrdinal: 4,
        progressTotalSteps: 4
      }
    );
    return "placement_generation_completed";
  }

  throw new Error(`unsupported checkpoint ${claim.checkpoint_key}`);
}

async function dispatchCheckpointFromOutbox(input: {
  dispatch: CheckpointDispatchRow;
  dispatcherIdentifier: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}): Promise<void> {
  logWorkerStep("dispatch_checkpoint_invocation_started", {
    checkpoint_id: input.dispatch.checkpoint_id,
    checkpoint_key: input.dispatch.checkpoint_key,
    dispatch_id: input.dispatch.dispatch_id,
    dispatcher_identifier: input.dispatcherIdentifier,
    job_id: input.dispatch.job_id,
    outbox_attempt_count: input.dispatch.attempt_count
  });

  try {
    const checkpointResponse = await invokeWorkerCheckpoint({
      checkpointKey: input.dispatch.checkpoint_key,
      jobId: input.dispatch.job_id,
      supabaseUrl: input.supabaseUrl
    });

    if (checkpointResponse.status === "noop") {
      logWorkerStep("dispatch_checkpoint_invocation_noop", {
        checkpoint_id: input.dispatch.checkpoint_id,
        checkpoint_key: input.dispatch.checkpoint_key,
        dispatch_id: input.dispatch.dispatch_id,
        job_id: input.dispatch.job_id
      });
      await markCheckpointDispatchRetryable(
        input.supabaseUrl,
        input.serviceRoleKey,
        input.dispatcherIdentifier,
        {
          dispatchId: input.dispatch.dispatch_id,
          errorCode: "checkpoint_not_claimed",
          errorMessage: "Checkpoint invocation returned noop before claiming durable work."
        }
      );
      return;
    }

    if (
      checkpointResponse.status === "failed" &&
      checkpointResponse.error?.startsWith("retryable ")
    ) {
      logWorkerStep("dispatch_checkpoint_invocation_retryable_failure", {
        checkpoint_id: input.dispatch.checkpoint_id,
        checkpoint_key: input.dispatch.checkpoint_key,
        dispatch_id: input.dispatch.dispatch_id,
        error: checkpointResponse.error,
        job_id: input.dispatch.job_id
      });
      await markCheckpointDispatchRetryable(
        input.supabaseUrl,
        input.serviceRoleKey,
        input.dispatcherIdentifier,
        {
          dispatchId: input.dispatch.dispatch_id,
          errorCode: "checkpoint_retryable_failure",
          errorMessage: checkpointResponse.error
        }
      );
      return;
    }

    await markCheckpointDispatchDispatched(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.dispatcherIdentifier,
      input.dispatch.dispatch_id
    );
    logWorkerStep("dispatch_checkpoint_invocation_marked_dispatched", {
      checkpoint_id: input.dispatch.checkpoint_id,
      checkpoint_key: input.dispatch.checkpoint_key,
      dispatch_id: input.dispatch.dispatch_id,
      job_id: input.dispatch.job_id,
      worker_status: checkpointResponse.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWorkerStep("dispatch_checkpoint_invocation_failed", {
      checkpoint_id: input.dispatch.checkpoint_id,
      checkpoint_key: input.dispatch.checkpoint_key,
      dispatch_id: input.dispatch.dispatch_id,
      error: message,
      job_id: input.dispatch.job_id
    });
    await markCheckpointDispatchRetryable(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.dispatcherIdentifier,
      {
        dispatchId: input.dispatch.dispatch_id,
        errorCode: "checkpoint_dispatch_failed",
        errorMessage: message
      }
    );
  }
}

async function handleDispatchMode(input: {
  dispatcherIdentifier: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}): Promise<Response> {
  const maxActiveCheckpoints = parsePositiveInt(
    "IN_HOME_SIMULATION_MAX_ACTIVE_CHECKPOINTS",
    DEFAULT_MAX_ACTIVE_CHECKPOINTS
  );
  const dispatchBatchSize = parsePositiveInt(
    "IN_HOME_SIMULATION_DISPATCH_BATCH_SIZE",
    DEFAULT_DISPATCH_BATCH_SIZE
  );
  const dispatchLockTtlSeconds = parsePositiveInt(
    "IN_HOME_SIMULATION_DISPATCH_LOCK_TTL_SECONDS",
    DEFAULT_DISPATCH_LOCK_TTL_SECONDS
  );
  logWorkerStep("dispatch_mode_started", {
    batch_size: dispatchBatchSize,
    dispatcher_identifier: input.dispatcherIdentifier,
    lock_ttl_seconds: dispatchLockTtlSeconds,
    max_active_checkpoints: maxActiveCheckpoints
  });
  const recoveredCheckpointCount = await recoverStaleCheckpointClaims(
    input.supabaseUrl,
    input.serviceRoleKey,
    dispatchBatchSize
  );
  const requeuedDispatchCount = await requeueStaleCheckpointDispatches(
    input.supabaseUrl,
    input.serviceRoleKey,
    dispatchBatchSize
  );
  logWorkerStep("dispatch_mode_recovered_stale_work", {
    dispatcher_identifier: input.dispatcherIdentifier,
    recovered_checkpoints: recoveredCheckpointCount,
    requeued_dispatches: requeuedDispatchCount
  });
  const dispatches = await claimCheckpointDispatches(
    input.supabaseUrl,
    input.serviceRoleKey,
    input.dispatcherIdentifier,
    dispatchLockTtlSeconds,
    dispatchBatchSize,
    maxActiveCheckpoints
  );
  logWorkerStep("dispatch_mode_claimed_outbox_rows", {
    claimed_count: dispatches.length,
    dispatcher_identifier: input.dispatcherIdentifier,
    dispatch_ids: dispatches.map((dispatch) => dispatch.dispatch_id)
  });

  for (const dispatch of dispatches) {
    deferWorkerInvocation(
      dispatchCheckpointFromOutbox({
        dispatch,
        dispatcherIdentifier: input.dispatcherIdentifier,
        serviceRoleKey: input.serviceRoleKey,
        supabaseUrl: input.supabaseUrl
      })
    );
  }

  return jsonResponse({
    function_name: FUNCTION_NAME,
    max_active_checkpoints: maxActiveCheckpoints,
    mode: "dispatch",
    processed: dispatches.length,
    recovered_checkpoints: recoveredCheckpointCount,
    requeued_dispatches: requeuedDispatchCount,
    queued: dispatches.length,
    stage: "stage_1",
    started_count: dispatches.length,
    status: dispatches.length > 0 ? "claimed" : "noop"
  });
}

async function handleCheckpointMode(input: {
  checkpointKey?: SimulationCheckpointKey;
  claimTtlSeconds: number;
  jobId?: string;
  serviceRoleKey: string;
  supabaseUrl: string;
  workerIdentifier: string;
}): Promise<Response> {
  const maxActiveCheckpoints = parsePositiveInt(
    "IN_HOME_SIMULATION_MAX_ACTIVE_CHECKPOINTS",
    DEFAULT_MAX_ACTIVE_CHECKPOINTS
  );
  logWorkerStep("checkpoint_mode_claim_started", {
    checkpoint_key: input.checkpointKey ?? null,
    job_id: input.jobId ?? null,
    max_active_checkpoints: maxActiveCheckpoints,
    worker_identifier: input.workerIdentifier
  });
  const claim = await claimCheckpointJob(
    input.supabaseUrl,
    input.serviceRoleKey,
    input.workerIdentifier,
    input.claimTtlSeconds,
    maxActiveCheckpoints,
    {
      checkpointKey: input.checkpointKey,
      jobId: input.jobId
    }
  );

  if (!claim) {
    logWorkerStep("checkpoint_mode_no_claim", {
      checkpoint_key: input.checkpointKey ?? null,
      job_id: input.jobId ?? null,
      worker_identifier: input.workerIdentifier
    });
    return jsonResponse({
      function_name: FUNCTION_NAME,
      mode: "checkpoint",
      processed: 0,
      stage: "stage_1",
      status: "noop"
    });
  }

  logWorkerStep("checkpoint_mode_claimed", {
    attempt_number: claim.attempt_number,
    checkpoint_id: claim.checkpoint_id,
    checkpoint_key: claim.checkpoint_key,
    generation_index: claim.generation_index,
    job_id: claim.job_id,
    max_attempts: claim.max_attempts,
    worker_identifier: input.workerIdentifier
  });

  try {
    const checkpointOutcome = await processClaimedCheckpoint(
      input.supabaseUrl,
      input.serviceRoleKey,
      input.workerIdentifier,
      claim
    );
    logWorkerStep("checkpoint_mode_completed", {
      checkpoint_id: claim.checkpoint_id,
      checkpoint_key: claim.checkpoint_key,
      job_id: claim.job_id,
      outcome: checkpointOutcome,
      worker_identifier: input.workerIdentifier
    });
    return jsonResponse({
      checkpoint_id: claim.checkpoint_id,
      checkpoint_key: claim.checkpoint_key,
      function_name: FUNCTION_NAME,
      job_id: claim.job_id,
      mode: "checkpoint",
      processed: 1,
      stage: stageForCheckpoint(claim.checkpoint_key),
      status: "completed"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = stageForCheckpoint(claim.checkpoint_key);
    const action = message.startsWith("unsupported checkpoint ")
      ? { kind: "fail" as const, reason: "unsupported_checkpoint" }
      : decideStageFailureAction(error, {
          stage,
          attemptCount: claim.attempt_number,
          maxAttempts: claim.max_attempts
        });
    const retryable = action.kind === "release";
    logWorkerStep("checkpoint_mode_failed", {
      checkpoint_id: claim.checkpoint_id,
      checkpoint_key: claim.checkpoint_key,
      error: message,
      job_id: claim.job_id,
      retryable,
      stage,
      worker_identifier: input.workerIdentifier
    });
    try {
      await releaseCheckpointClaim(
        input.supabaseUrl,
        input.serviceRoleKey,
        input.workerIdentifier,
        {
          checkpointId: claim.checkpoint_id,
          retryable,
          safeErrorCode: retryable ? "transient" : "checkpoint_failed",
          safeErrorMessage: message
        }
      );
    } catch (_releaseError) { /* fall through */ }

    return jsonResponse({
      checkpoint_id: claim.checkpoint_id,
      checkpoint_key: claim.checkpoint_key,
      error: retryable ? `retryable (${action.reason}): ${message}` : message,
      function_name: FUNCTION_NAME,
      job_id: claim.job_id,
      mode: "checkpoint",
      processed: 0,
      stage,
      status: "failed"
    });
  } finally {
    logWorkerStep("checkpoint_mode_dispatch_wakeup_scheduled", {
      checkpoint_id: claim.checkpoint_id,
      checkpoint_key: claim.checkpoint_key,
      job_id: claim.job_id,
      worker_identifier: input.workerIdentifier
    });
    deferWorkerInvocation(
      invokeWorkerDispatch({ supabaseUrl: input.supabaseUrl })
    );
  }
}

async function invokeWorkerCheckpoint(input: {
  checkpointKey?: SimulationCheckpointKey;
  jobId?: string;
  supabaseUrl: string;
}): Promise<WorkerResponse> {
  return await invokeWorker({
    checkpointKey: input.checkpointKey,
    jobId: input.jobId,
    mode: "checkpoint",
    supabaseUrl: input.supabaseUrl
  });
}

async function invokeWorkerDispatch(input: {
  supabaseUrl: string;
}): Promise<WorkerResponse> {
  return await invokeWorker({
    mode: "dispatch",
    supabaseUrl: input.supabaseUrl
  });
}

async function invokeWorker(input: {
  checkpointKey?: SimulationCheckpointKey;
  jobId?: string;
  mode: WorkerMode;
  supabaseUrl: string;
}): Promise<WorkerResponse> {
  const response = await supabaseFetchWithTimeout(
    resolveWorkerFunctionUrl(input.supabaseUrl),
    {
      body: JSON.stringify({
        checkpoint_key: input.checkpointKey,
        job_id: input.jobId,
        mode: input.mode
      }),
      headers: buildWorkerInvocationHeaders(),
      method: "POST"
    },
    {
      timeoutMs: parsePositiveInt(
        "IN_HOME_SIMULATION_WORKER_INVOCATION_TIMEOUT_MS",
        DEFAULT_WORKER_INVOCATION_TIMEOUT_MS
      )
    }
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `in-home-simulation-worker ${input.mode} invocation returned HTTP ${response.status}: ${responseText}`
    );
  }

  return JSON.parse(responseText) as WorkerResponse;
}

function resolveWorkerFunctionUrl(supabaseUrl: string): string {
  return (
    Deno.env.get("IN_HOME_SIMULATION_WORKER_FUNCTION_URL") ??
    `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/in-home-simulation-worker`
  );
}

function buildWorkerInvocationHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const invocationSecret = Deno.env.get(
    "IN_HOME_SIMULATION_WORKER_INVOKE_SECRET"
  );

  if (invocationSecret) {
    headers["x-in-home-simulation-worker-secret"] = invocationSecret;
  }

  return headers;
}

function deferWorkerInvocation(promise: Promise<unknown>): void {
  const handledPromise = promise.catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
  });

  if (
    typeof EdgeRuntime !== "undefined" &&
    typeof EdgeRuntime.waitUntil === "function"
  ) {
    EdgeRuntime.waitUntil(handledPromise);
    return;
  }

  void handledPromise;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        status: "failed",
        function_name: FUNCTION_NAME,
        stage: "unknown",
        processed: 0,
        error: "Method not allowed"
      },
      405
    );
  }

  const authError = validateWorkerInvocation(request);
  if (authError) {
    return authError;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return failedEnvelope("Missing local Supabase function environment", 500);
  }

  const claimTtlSeconds = parsePositiveInt(
    "IN_HOME_SIMULATION_CLAIM_TTL_SECONDS",
    DEFAULT_CLAIM_TTL_SECONDS
  );
  const workerIdentifier = buildWorkerIdentifier();
  const parsedRequest = await parseWorkerRequestBody(request);
  if (parsedRequest instanceof Response) {
    return parsedRequest;
  }

  logWorkerStep("worker_request_received", {
    mode: parsedRequest.mode,
    worker_identifier: workerIdentifier
  });

  if (parsedRequest.mode === "dispatch") {
    try {
      return await handleDispatchMode({
        dispatcherIdentifier: workerIdentifier,
        serviceRoleKey,
        supabaseUrl
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failedEnvelope(message, 502);
    }
  }

  if (parsedRequest.mode === "checkpoint") {
    try {
      return await handleCheckpointMode({
        checkpointKey: parsedRequest.checkpointKey,
        claimTtlSeconds,
        jobId: parsedRequest.jobId,
        serviceRoleKey,
        supabaseUrl,
        workerIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failedEnvelope(message, 502);
    }
  }

  return failedEnvelope("In-home simulation worker mode is invalid", 400);
});
