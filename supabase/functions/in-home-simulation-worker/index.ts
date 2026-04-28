import { decode, Image } from "npm:imagescript@1.2.16";

import {
  dimensionGuideArrowsForBackWall,
  isHeicLikeExtension,
  type GuideArrow
} from "./lib/geometry.ts";
import {
  COMPRESSED_JPEG_QUALITY,
  NORMALIZED_JPEG_QUALITY,
  computeResizedDimensions,
  parseMaxEdge,
  shouldCompress
} from "./lib/normalize.ts";
import {
  type GeometryResult,
  selectStage1Providers,
  selectStage2Providers
} from "./lib/providers.ts";
import { decideStageFailureAction } from "./lib/retry.ts";
import { validateBackWallGeometry } from "./lib/sanity.ts";
import {
  validateSuppliedBackWallDimensions,
  validateSuppliedCornerDimensions
} from "./lib/dimensions.ts";
import {
  errorArtifactObjectPath,
  formatErrorArtifactBody
} from "./lib/error-artifact.ts";
import {
  buildStageTransitionEvent,
  buildSubStepEvent,
  type WorkerJobEventRow
} from "./lib/events.ts";

const DEFAULT_MAX_GEOMETRY_ATTEMPTS = 3;

type StageOutcome = "noop" | "claimed" | "completed" | "failed" | "mixed";

type WorkerResponse = {
  status: StageOutcome;
  function_name: string;
  stage: "stage_1" | "stage_2" | "unknown";
  processed: number;
  results?: Array<{
    job_id?: string;
    msg_id?: number;
    outcome: "completed" | "failed" | "skipped";
    job_status?: string;
    error?: string;
  }>;
  error?: string;
};

type RoomPrepClaimRow = {
  job_id: string;
  storage_prefix: string;
  customer_room_original_path: string | null;
  retention_deadline: string;
  room_prep_attempt_count: number;
  max_attempts_per_stage: number;
  claim_expires_at: string;
};

type DequeuedMessage = {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: { job_id?: string; type?: string; generation_index?: number };
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

const FUNCTION_NAME = "in-home-simulation-worker";
const STORAGE_BUCKET = "simulation-private-artifacts";
const DEFAULT_CLAIM_TTL_SECONDS = 600;
const DEFAULT_QUEUE_NAME = "local_in_home_simulation_jobs";
const DEFAULT_BATCH_SIZE = 1;
const ARROW_COLOR = 0xff3b30ff;
const ARROW_WIDTH_PX = 6;
const LABEL_BACKING_COLOR = 0x000000c0;
const LABEL_TEXT_COLOR = 0xffffffff;

const BACK_WALL_LABELS = {
  wallWidth: "Largeur mur",
  wallHeight: "Hauteur mur"
};

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

async function callRpc<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "apikey": serviceRoleKey
    },
    method: "POST"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name} rpc failed: HTTP ${response.status} ${text}`);
  }
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function dequeueRoomPrepMessages(
  supabaseUrl: string,
  serviceRoleKey: string,
  queueName: string,
  visibilitySeconds: number,
  batchSize: number
): Promise<DequeuedMessage[]> {
  const rows = await callRpc<DequeuedMessage[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "dequeue_in_home_simulation_room_prep_messages",
    {
      queue_name: queueName,
      visibility_seconds: visibilitySeconds,
      batch_size: batchSize
    }
  );
  return Array.isArray(rows) ? rows : [];
}

async function deleteRoomPrepMessage(
  supabaseUrl: string,
  serviceRoleKey: string,
  queueName: string,
  msgId: number
): Promise<void> {
  await callRpc<boolean>(
    supabaseUrl,
    serviceRoleKey,
    "delete_in_home_simulation_room_prep_message",
    { queue_name: queueName, msg_id: msgId }
  );
}

async function claimSpecificRoomPrepJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  workerIdentifier: string,
  claimTtlSeconds: number
): Promise<RoomPrepClaimRow | null> {
  const rows = await callRpc<RoomPrepClaimRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "claim_specific_in_home_simulation_room_prep_job",
    {
      job_id: jobId,
      worker_identifier: workerIdentifier,
      claim_ttl_seconds: claimTtlSeconds
    }
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function claimSpecificPlacementJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  workerIdentifier: string,
  claimTtlSeconds: number
): Promise<PlacementClaimRow | null> {
  const rows = await callRpc<PlacementClaimRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "claim_specific_in_home_simulation_placement_job",
    {
      job_id: jobId,
      worker_identifier: workerIdentifier,
      claim_ttl_seconds: claimTtlSeconds
    }
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function downloadStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  storagePath: string
): Promise<Uint8Array> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
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
      `storage download failed for ${storagePath}: HTTP ${response.status} ${text}`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function uploadStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  storagePath: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: bytes
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
    await fetch(`${supabaseUrl}/rest/v1/worker_job_events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(event)
    });
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

  const response = await fetch(
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

function drawArrow(image: Image, arrow: GuideArrow): void {
  const headSize = Math.max(10, Math.round(ARROW_WIDTH_PX * 4));
  image.drawBox(
    Math.min(arrow.from.x, arrow.to.x),
    Math.min(arrow.from.y, arrow.to.y),
    Math.max(1, Math.abs(arrow.to.x - arrow.from.x) || ARROW_WIDTH_PX),
    Math.max(1, Math.abs(arrow.to.y - arrow.from.y) || ARROW_WIDTH_PX),
    ARROW_COLOR
  );
  image.drawBox(
    Math.max(0, arrow.from.x - headSize / 2),
    Math.max(0, arrow.from.y - headSize / 2),
    headSize,
    headSize,
    ARROW_COLOR
  );
  image.drawBox(
    Math.max(0, arrow.to.x - headSize / 2),
    Math.max(0, arrow.to.y - headSize / 2),
    headSize,
    headSize,
    ARROW_COLOR
  );
}

let cachedFont: Uint8Array | null = null;
async function defaultFont(): Promise<Uint8Array> {
  if (cachedFont) return cachedFont;
  const url =
    "https://raw.githubusercontent.com/matmen/ImageScript/master/tests/fonts/Roboto-Regular.ttf";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not load default font: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  cachedFont = new Uint8Array(buffer);
  return cachedFont;
}

async function drawLabel(image: Image, arrow: GuideArrow): Promise<void> {
  const midX = Math.round((arrow.from.x + arrow.to.x) / 2);
  const midY = Math.round((arrow.from.y + arrow.to.y) / 2);
  let labelImage: Image;
  try {
    const fontSize = Math.max(20, Math.round(image.height * 0.025));
    labelImage = await Image.renderText(
      await defaultFont(),
      fontSize,
      arrow.label,
      LABEL_TEXT_COLOR
    );
  } catch (_error) {
    return;
  }

  const padding = 6;
  const boxWidth = labelImage.width + padding * 2;
  const boxHeight = labelImage.height + padding * 2;
  const boxX = Math.max(0, midX - Math.round(boxWidth / 2));
  const boxY = Math.max(0, midY - Math.round(boxHeight / 2));

  image.drawBox(boxX, boxY, boxWidth, boxHeight, LABEL_BACKING_COLOR);
  image.composite(labelImage, boxX + padding, boxY + padding);
}

async function createScratchDir(jobId: string): Promise<string> {
  const root =
    Deno.env.get("IN_HOME_SIMULATION_TMP_DIR") ??
    (await Deno.makeTempDir({ prefix: "in-home-simulation-" }));
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

async function processClaimedJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: RoomPrepClaimRow
): Promise<void> {
  if (!claim.customer_room_original_path) {
    throw new Error(
      "customer_room_original_path is null on the claimed job; refusing to process"
    );
  }

  if (isHeicLikeExtension(claim.customer_room_original_path)) {
    await failJobNonRetryable(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id,
      "unsupported_format",
      "HEIC/HEIF input is not supported yet. Convert the photo to JPEG or PNG and re-enqueue.",
      { storagePrefix: claim.storage_prefix, stage: "stage_1" }
    );
    throw new Error(
      "HEIC/HEIF input is not supported yet; job marked as failed"
    );
  }

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage1Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );
  const maxGeometryAttempts = parsePositiveInt(
    "IN_HOME_SIMULATION_MAX_GEOMETRY_ATTEMPTS",
    DEFAULT_MAX_GEOMETRY_ATTEMPTS
  );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    const sourceBytes = await downloadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      claim.customer_room_original_path
    );
    await Deno.writeFile(`${scratchDir}/room_original.bin`, sourceBytes);

    let decoded: Image;
    try {
      decoded = (await decode(sourceBytes)) as Image;
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

    // Normalization: re-encode as JPEG so the persisted artifact has a
    // consistent format and stripped EXIF metadata. imagescript already
    // applies EXIF orientation during decode.
    const normalizedBytes = await decoded.encodeJPEG(NORMALIZED_JPEG_QUALITY);
    await Deno.writeFile(`${scratchDir}/room_normalized.jpg`, normalizedBytes);

    // Validation via the configured provider. The mock always passes; a
    // live provider may reject obviously unusable photos with a readable
    // failure code.
    const validationResult = await providers.validation.validateRoom(
      normalizedBytes
    );
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

    // Optional compression: shrink the longest edge to the worker max if
    // the source exceeds it, then re-encode as JPEG at a lower quality.
    const maxEdge = parseMaxEdge(
      Deno.env.get("IN_HOME_SIMULATION_MAX_EDGE_PX")
    );
    let compressedImage: Image = decoded;
    if (shouldCompress({ width: decoded.width, height: decoded.height }, maxEdge)) {
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

    // Cleaning via the configured provider. The mock returns the input
    // bytes unchanged. The cleaned artifact is whatever PNG bytes the
    // cleaning provider produces, decoded so geometry and overlay can
    // operate on consistent pixel dimensions.
    const cleanedRawBytes = await providers.cleaning.cleanRoom(compressedBytes);
    let cleanedImage: Image;
    try {
      cleanedImage = (await decode(cleanedRawBytes)) as Image;
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

    // Geometry detection via the configured provider with sanity
    // validation and a worker-defined attempt limit. Currently only
    // back_wall mode is enforced by the sanity validator; corner mode
    // sanity will be wired in once corner detection is implemented.
    let geometryResult: GeometryResult | null = null;
    let geometryFailures: string[] = [];
    for (let attempt = 1; attempt <= maxGeometryAttempts; attempt++) {
      const candidate = await providers.geometry.detectGeometry(
        cleanedBytes,
        cleanedImage.width,
        cleanedImage.height
      );
      if ("failureReason" in candidate) {
        geometryFailures.push(`attempt ${attempt}: ${candidate.failureReason}`);
        continue;
      }
      if (candidate.mode === "back_wall") {
        const sanity = validateBackWallGeometry(
          candidate,
          cleanedImage.width,
          cleanedImage.height
        );
        if (!sanity.ok) {
          geometryFailures.push(
            `attempt ${attempt} sanity: ${sanity.failureReason}`
          );
          continue;
        }
      }
      geometryResult = candidate;
      break;
    }

    if (!geometryResult || "failureReason" in geometryResult) {
      const reason = geometryFailures.join("; ") ||
        ("failureReason" in (geometryResult ?? { failureReason: "unknown" })
          ? (geometryResult as { failureReason: string }).failureReason
          : "geometry detection exhausted attempts");
      await failJobNonRetryable(
        supabaseUrl,
        serviceRoleKey,
        claim.job_id,
        "geometry_detection_failed",
        reason,
        { storagePrefix: claim.storage_prefix, stage: "stage_1" }
      );
      throw new Error(`geometry detection failed: ${reason}`);
    }

    const geometryForPersist = {
      mode: geometryResult.mode,
      points: geometryResult.points
    };
    const geometryBytes = new TextEncoder().encode(
      JSON.stringify(geometryForPersist, null, 2)
    );
    await Deno.writeFile(`${scratchDir}/room_geometry.json`, geometryBytes);

    // Overlay rendering on the cleaned image.
    const overlayImage = cleanedImage.clone() as Image;
    const arrows = geometryResult.mode === "back_wall"
      ? dimensionGuideArrowsForBackWall(
        { mode: "back_wall", points: geometryResult.points },
        overlayImage.width,
        overlayImage.height,
        BACK_WALL_LABELS
      )
      : [];
    for (const arrow of arrows) drawArrow(overlayImage, arrow);
    for (const arrow of arrows) await drawLabel(overlayImage, arrow);
    const overlayBytes = await overlayImage.encode(0);
    await Deno.writeFile(`${scratchDir}/room_guides.png`, overlayBytes);

    const normalizedPath = `${claim.storage_prefix}/room_normalized.jpg`;
    const compressedPath = `${claim.storage_prefix}/room_compressed.jpg`;
    const cleanedPath = `${claim.storage_prefix}/room_cleaned.png`;
    const guidesPath = `${claim.storage_prefix}/room_guides.png`;

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
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      cleanedPath,
      cleanedBytes,
      "image/png"
    );
    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      guidesPath,
      overlayBytes,
      "image/png"
    );

    await callRpc<void>(
      supabaseUrl,
      serviceRoleKey,
      "complete_in_home_simulation_room_prep_stage",
      {
        job_id: claim.job_id,
        worker_identifier: workerIdentifier,
        room_normalized_path: normalizedPath,
        room_compressed_path: compressedPath,
        room_cleaned_path: cleanedPath,
        dimension_guide_overlay_path: guidesPath,
        room_geometry_mode: geometryResult.mode,
        room_geometry_points: geometryForPersist,
        room_geometry_confidence: geometryResult.confidence ?? null
      }
    );
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
  claim: PlacementClaimRow
): Promise<void> {
  if (!claim.room_cleaned_path) {
    throw new Error(
      `job ${claim.job_id} has no room_cleaned_path; refusing Stage 2`
    );
  }

  const providerMode = Deno.env.get("IN_HOME_SIMULATION_PROVIDER_MODE");
  const providers = selectStage2Providers(
    providerMode,
    (name) => Deno.env.get(name) ?? undefined
  );

  const scratchDir = await createScratchDir(claim.job_id);
  try {
    const cleanedRawBytes = await downloadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      claim.room_cleaned_path
    );

    let cleanedImage: Image;
    try {
      cleanedImage = (await decode(cleanedRawBytes)) as Image;
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
    if (claim.prepared_sofa_path) {
      try {
        preparedSofaBytes = await downloadStorageObject(
          supabaseUrl,
          serviceRoleKey,
          claim.prepared_sofa_path
        );
      } catch (_error) {
        // The mock placement provider does not require the prepared
        // sofa bytes; real providers must, and will fail fast at
        // their own boundary when the asset is missing.
        preparedSofaBytes = null;
      }
    }

    const geometry = (claim.room_geometry_points ?? {}) as Record<
      string,
      unknown
    >;
    const suppliedDimensions = (claim.supplied_dimensions ?? {}) as Record<
      string,
      number
    >;

    const dimensionsCheck = claim.room_geometry_mode === "back_wall"
      ? validateSuppliedBackWallDimensions(suppliedDimensions)
      : validateSuppliedCornerDimensions(suppliedDimensions);
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

    const placementResult = await providers.placement.placeSofa({
      cleanedRoomBytes: cleanedRawBytes,
      cleanedRoomWidth: cleanedImage.width,
      cleanedRoomHeight: cleanedImage.height,
      preparedSofaBytes,
      // The provider interface accepts BackWall or Corner geometry; the
      // mock ignores the contents.
      geometry: geometry as never,
      suppliedDimensions
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
      outputImage = stampSofaRectangle(cleanedImage, claim.room_geometry_points);
    } else {
      try {
        outputImage = (await decode(placementResult.pngBytes)) as Image;
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

    await uploadStorageObject(
      supabaseUrl,
      serviceRoleKey,
      outputPath,
      outputBytes,
      "image/png"
    );

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
  } finally {
    await removeScratchDir(scratchDir);
  }
}

function aggregateOutcome(
  results: Array<{ outcome: "completed" | "failed" | "skipped" }>
): StageOutcome {
  if (results.length === 0) return "noop";
  const allCompleted = results.every((r) => r.outcome === "completed");
  if (allCompleted) return "completed";
  const allFailed = results.every((r) => r.outcome === "failed");
  if (allFailed) return "failed";
  return "mixed";
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return failedEnvelope("Missing local Supabase function environment", 500);
  }

  const claimTtlSeconds = parsePositiveInt(
    "IN_HOME_SIMULATION_CLAIM_TTL_SECONDS",
    DEFAULT_CLAIM_TTL_SECONDS
  );
  const queueName =
    Deno.env.get("IN_HOME_SIMULATION_QUEUE_NAME") ?? DEFAULT_QUEUE_NAME;
  const batchSize = parsePositiveInt(
    "IN_HOME_SIMULATION_MAX_CONCURRENT_JOBS",
    DEFAULT_BATCH_SIZE
  );
  const workerIdentifier = buildWorkerIdentifier();

  let messages: DequeuedMessage[];
  try {
    messages = await dequeueRoomPrepMessages(
      supabaseUrl,
      serviceRoleKey,
      queueName,
      claimTtlSeconds,
      batchSize
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedEnvelope(message, 502);
  }

  if (messages.length === 0) {
    return jsonResponse({
      status: "noop",
      function_name: FUNCTION_NAME,
      stage: "stage_1",
      processed: 0,
      results: []
    });
  }

  const results: Array<{
    job_id?: string;
    msg_id?: number;
    outcome: "completed" | "failed" | "skipped";
    job_status?: string;
    error?: string;
  }> = [];

  for (const msg of messages) {
    const jobId = msg.message?.job_id;
    if (!jobId) {
      // Malformed message: drop it so it does not loop.
      try {
        await deleteRoomPrepMessage(
          supabaseUrl,
          serviceRoleKey,
          queueName,
          msg.msg_id
        );
      } catch (_error) { /* fall through */ }
      results.push({
        msg_id: msg.msg_id,
        outcome: "skipped",
        error: "queue message missing job_id"
      });
      continue;
    }

    const messageType = msg.message?.type;

    if (messageType === "in_home_simulation_placement") {
      let placementClaim: PlacementClaimRow | null;
      try {
        placementClaim = await claimSpecificPlacementJob(
          supabaseUrl,
          serviceRoleKey,
          jobId,
          workerIdentifier,
          claimTtlSeconds
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          job_id: jobId,
          msg_id: msg.msg_id,
          outcome: "failed",
          error: message
        });
        continue;
      }

      if (placementClaim === null) {
        try {
          await deleteRoomPrepMessage(
            supabaseUrl,
            serviceRoleKey,
            queueName,
            msg.msg_id
          );
        } catch (_error) { /* fall through */ }
        results.push({
          job_id: jobId,
          msg_id: msg.msg_id,
          outcome: "skipped",
          error: "job is not in placement_queued state"
        });
        continue;
      }

      try {
        await processPlacementJob(
          supabaseUrl,
          serviceRoleKey,
          workerIdentifier,
          placementClaim
        );
        await recordWorkerEvent(supabaseUrl, serviceRoleKey,
          buildStageTransitionEvent({
            jobId,
            fromStatus: "placement_processing",
            toStatus: "succeeded",
            message: `worker ${workerIdentifier} completed Stage 2`
          })
        );
        try {
          await deleteRoomPrepMessage(
            supabaseUrl,
            serviceRoleKey,
            queueName,
            msg.msg_id
          );
        } catch (_error) { /* fall through */ }
        results.push({
          job_id: jobId,
          msg_id: msg.msg_id,
          outcome: "completed",
          job_status: "succeeded"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const action = decideStageFailureAction(error, {
          stage: "stage_2",
          attemptCount: placementClaim.placement_attempt_count,
          maxAttempts: placementClaim.max_attempts_per_stage
        });

        if (action.kind === "release") {
          try {
            await callRpc<void>(
              supabaseUrl,
              serviceRoleKey,
              "release_in_home_simulation_placement_claim",
              {
                job_id: placementClaim.job_id,
                worker_identifier: workerIdentifier,
                error_code: "transient",
                error_message: message
              }
            );
          } catch (_error) { /* fall through */ }
          // Do not delete the pgmq message; the visibility timeout
          // makes it visible again so a future invocation can retry.
          results.push({
            job_id: jobId,
            msg_id: msg.msg_id,
            outcome: "failed",
            job_status: "placement_queued",
            error: `retryable (${action.reason}): ${message}`
          });
        } else {
          try {
            await deleteRoomPrepMessage(
              supabaseUrl,
              serviceRoleKey,
              queueName,
              msg.msg_id
            );
          } catch (_error) { /* fall through */ }
          results.push({
            job_id: jobId,
            msg_id: msg.msg_id,
            outcome: "failed",
            job_status: "failed",
            error: message
          });
        }
      }
      continue;
    }

    let claim: RoomPrepClaimRow | null;
    try {
      claim = await claimSpecificRoomPrepJob(
        supabaseUrl,
        serviceRoleKey,
        jobId,
        workerIdentifier,
        claimTtlSeconds
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        job_id: jobId,
        msg_id: msg.msg_id,
        outcome: "failed",
        error: message
      });
      continue;
    }

    if (claim === null) {
      // Job is not in queued state any more (already processing,
      // succeeded, failed, or expired). Drop the message and move on
      // per SPEC-0007 worker reload rule.
      try {
        await deleteRoomPrepMessage(
          supabaseUrl,
          serviceRoleKey,
          queueName,
          msg.msg_id
        );
      } catch (_error) { /* fall through */ }
      results.push({
        job_id: jobId,
        msg_id: msg.msg_id,
        outcome: "skipped",
        error: "job is not in queued state"
      });
      continue;
    }

    try {
      await processClaimedJob(
        supabaseUrl,
        serviceRoleKey,
        workerIdentifier,
        claim
      );
      await recordWorkerEvent(supabaseUrl, serviceRoleKey,
        buildStageTransitionEvent({
          jobId,
          fromStatus: "room_prep_processing",
          toStatus: "awaiting_dimensions",
          message: `worker ${workerIdentifier} completed Stage 1`
        })
      );
      try {
        await deleteRoomPrepMessage(
          supabaseUrl,
          serviceRoleKey,
          queueName,
          msg.msg_id
        );
      } catch (_error) { /* fall through */ }
      results.push({
        job_id: jobId,
        msg_id: msg.msg_id,
        outcome: "completed",
        job_status: "awaiting_dimensions"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const action = decideStageFailureAction(error, {
        stage: "stage_1",
        attemptCount: claim.room_prep_attempt_count,
        maxAttempts: claim.max_attempts_per_stage
      });

      if (action.kind === "release") {
        try {
          await callRpc<void>(
            supabaseUrl,
            serviceRoleKey,
            "release_in_home_simulation_room_prep_claim",
            {
              job_id: claim.job_id,
              worker_identifier: workerIdentifier,
              error_code: "transient",
              error_message: message
            }
          );
        } catch (_error) { /* fall through */ }
        // Do not delete the pgmq message; the visibility timeout
        // makes it visible again so a future invocation can retry.
        results.push({
          job_id: jobId,
          msg_id: msg.msg_id,
          outcome: "failed",
          job_status: "queued",
          error: `retryable (${action.reason}): ${message}`
        });
        continue;
      }

      try {
        await deleteRoomPrepMessage(
          supabaseUrl,
          serviceRoleKey,
          queueName,
          msg.msg_id
        );
      } catch (_error) { /* fall through */ }
      results.push({
        job_id: jobId,
        msg_id: msg.msg_id,
        outcome: "failed",
        job_status: "failed",
        error: message
      });
    }
  }

  return jsonResponse({
    status: aggregateOutcome(results),
    function_name: FUNCTION_NAME,
    stage: "stage_1",
    processed: results.filter((r) => r.outcome === "completed").length,
    results
  });
});
