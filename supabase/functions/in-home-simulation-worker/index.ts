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

type GeometryPoint = { x: number; y: number };

const FUNCTION_NAME = "in-home-simulation-worker";
const DEFAULT_CLAIM_TTL_SECONDS = 600;

function jsonResponse(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
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
  if (!raw) {
    return DEFAULT_CLAIM_TTL_SECONDS;
  }
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

function placeholderBackWallPoints(
  width: number,
  height: number
): GeometryPoint[] {
  // Order: bottom-left, bottom-right, top-right, top-left
  // Insets the four corners by 10 percent of the matching dimension to act
  // as a deterministic placeholder until real geometry detection lands.
  const insetX = Math.round(width * 0.1);
  const insetY = Math.round(height * 0.1);
  return [
    { x: insetX, y: height - insetY },
    { x: width - insetX, y: height - insetY },
    { x: width - insetX, y: insetY },
    { x: insetX, y: insetY }
  ];
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
    throw new Error(
      `${name} rpc failed: HTTP ${response.status} ${text}`
    );
  }
  const text = await response.text();
  if (!text) {
    return null as T;
  }
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
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0];
}

async function completeRoomPrepStage(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claim: RoomPrepClaimRow
): Promise<void> {
  // Placeholder Stage 1 implementation. The persisted artifact paths reuse
  // the customer room original path so downstream code can find a real
  // object in storage. Real normalization, cleaning, geometry detection,
  // and overlay rendering replace these placeholders in subsequent
  // commits without changing this RPC contract.
  const sourcePath =
    claim.customer_room_original_path ??
    `${claim.storage_prefix}/inputs/room.jpg`;
  const placeholderPoints = placeholderBackWallPoints(1024, 768);

  await callRpc<void>(
    supabaseUrl,
    serviceRoleKey,
    "complete_in_home_simulation_room_prep_stage",
    {
      job_id: claim.job_id,
      worker_identifier: workerIdentifier,
      room_normalized_path: sourcePath,
      room_compressed_path: sourcePath,
      room_cleaned_path: sourcePath,
      dimension_guide_overlay_path: sourcePath,
      room_geometry_mode: "back_wall",
      room_geometry_points: { mode: "back_wall", points: placeholderPoints },
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
    await completeRoomPrepStage(
      supabaseUrl,
      serviceRoleKey,
      workerIdentifier,
      claim
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedResponse(message, 502);
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
