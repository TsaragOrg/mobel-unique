import { decode, Image } from "npm:imagescript@1.2.16";

import {
  dimensionGuideArrowsForBackWall,
  isHeicLikeExtension,
  placeholderBackWallGeometry,
  type GuideArrow
} from "./lib/geometry.ts";

type StageOutcome = "noop" | "claimed" | "completed" | "failed";

type WorkerResponse = {
  status: StageOutcome;
  function_name: string;
  stage: "stage_1" | "stage_2" | "unknown";
  processed: number;
  job_id?: string;
  job_status?: string;
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

const FUNCTION_NAME = "in-home-simulation-worker";
const STORAGE_BUCKET = "simulation-private-artifacts";
const DEFAULT_CLAIM_TTL_SECONDS = 600;
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

function failedResponse(error: string, status = 500): Response {
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

function parseClaimTtlSeconds(): number {
  const raw = Deno.env.get("IN_HOME_SIMULATION_CLAIM_TTL_SECONDS");
  if (!raw) return DEFAULT_CLAIM_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CLAIM_TTL_SECONDS;
  }
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

async function claimRoomPrepJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claimTtlSeconds: number
): Promise<RoomPrepClaimRow | null> {
  const rows = await callRpc<RoomPrepClaimRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "claim_in_home_simulation_room_prep_job",
    {
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
  // Render the head as a small square at each endpoint as a deterministic
  // marker. A polished arrow head will replace this in a follow-up slice.
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

async function drawLabel(
  image: Image,
  arrow: GuideArrow
): Promise<void> {
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

async function processStage1(
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
    const message =
      error instanceof Error ? error.message : String(error);
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

  for (const arrow of arrows) {
    drawArrow(image, arrow);
  }
  for (const arrow of arrows) {
    await drawLabel(image, arrow);
  }

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
    return failedResponse("Missing local Supabase function environment", 500);
  }

  const claimTtlSeconds = parseClaimTtlSeconds();
  const workerIdentifier = buildWorkerIdentifier();

  let claim: RoomPrepClaimRow | null;
  try {
    claim = await claimRoomPrepJob(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      claimTtlSeconds
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedResponse(message, 502);
  }

  if (claim === null) {
    return jsonResponse({
      status: "noop",
      function_name: FUNCTION_NAME,
      stage: "stage_1",
      processed: 0
    });
  }

  try {
    await processStage1(supabaseUrl, serviceRoleKey, workerIdentifier, claim);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(
      {
        status: "failed",
        function_name: FUNCTION_NAME,
        stage: "stage_1",
        processed: 0,
        job_id: claim.job_id,
        job_status: "failed",
        error: message
      },
      502
    );
  }

  return jsonResponse({
    status: "completed",
    function_name: FUNCTION_NAME,
    stage: "stage_1",
    processed: 1,
    job_id: claim.job_id,
    job_status: "awaiting_dimensions"
  });
});
