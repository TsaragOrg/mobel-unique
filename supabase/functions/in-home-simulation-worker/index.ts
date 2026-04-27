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

async function claimRoomPrepJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  workerIdentifier: string,
  claimTtlSeconds: number
): Promise<RoomPrepClaimRow | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/claim_in_home_simulation_room_prep_job`,
    {
      body: JSON.stringify({
        worker_identifier: workerIdentifier,
        claim_ttl_seconds: claimTtlSeconds
      }),
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "apikey": serviceRoleKey
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `claim_in_home_simulation_room_prep_job rpc failed: HTTP ${response.status} ${body}`
    );
  }

  const rows = (await response.json()) as RoomPrepClaimRow[] | null;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0];
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

  return jsonResponse({
    status: "claimed",
    function_name: FUNCTION_NAME,
    stage: "stage_1",
    processed: 1,
    job_id: claim.job_id,
    job_status: "room_prep_processing"
  });
});
