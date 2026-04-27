import { decode, Image } from "npm:imagescript@1.2.16";

import {
  dimensionGuideArrowsForBackWall,
  isHeicLikeExtension,
  placeholderBackWallGeometry,
  type GuideArrow
} from "./lib/geometry.ts";

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
  message: { job_id?: string; type?: string };
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

async function failJobNonRetryable(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
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
      body: JSON.stringify({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage,
        claim_expires_at: null,
        updated_at: new Date().toISOString()
      })
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
      "HEIC/HEIF input is not supported yet. Convert the photo to JPEG or PNG and re-enqueue."
    );
    throw new Error(
      "HEIC/HEIF input is not supported yet; job marked as failed"
    );
  }

  const sourceBytes = await downloadStorageObject(
    supabaseUrl,
    serviceRoleKey,
    claim.customer_room_original_path
  );

  let image: Image;
  try {
    image = (await decode(sourceBytes)) as Image;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJobNonRetryable(
      supabaseUrl,
      serviceRoleKey,
      claim.job_id,
      "decode_failed",
      `Could not decode the customer room photo: ${message}`
    );
    throw new Error(`decode failed: ${message}`);
  }

  const geometry = placeholderBackWallGeometry(image.width, image.height);
  const arrows = dimensionGuideArrowsForBackWall(
    geometry,
    image.width,
    image.height,
    BACK_WALL_LABELS
  );

  for (const arrow of arrows) drawArrow(image, arrow);
  for (const arrow of arrows) await drawLabel(image, arrow);

  const overlayBytes = await image.encode(0);
  const guidesPath = `${claim.storage_prefix}/room_guides.png`;
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
      room_normalized_path: claim.customer_room_original_path,
      room_compressed_path: claim.customer_room_original_path,
      room_cleaned_path: claim.customer_room_original_path,
      dimension_guide_overlay_path: guidesPath,
      room_geometry_mode: "back_wall",
      room_geometry_points: geometry,
      room_geometry_confidence: null
    }
  );
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
      // Job-level failure was already recorded inside processClaimedJob
      // when applicable. Delete the message so non-retryable failures do
      // not loop in the queue.
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
