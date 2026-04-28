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

const GENERATED_BUCKET = "catalog-private-assets";
const MOCK_OUTPUT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
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

async function uploadMockOutput(
  supabaseUrl: string,
  serviceRoleKey: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${GENERATED_BUCKET}/${outputPath}`,
    {
      body: decodeBase64(MOCK_OUTPUT_PNG_BASE64),
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "image/png",
        "apikey": serviceRoleKey,
        "x-upsert": "true"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(
      `storage upload returned HTTP ${response.status}: ${await response.text()}`
    );
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestedProvider = request.headers.get("x-fabric-render-provider") ?? "mock";
  if (requestedProvider !== "mock") {
    return jsonResponse(
      {
        error:
          "Only the mock fabric render provider is implemented in PLAN-0006 foundation"
      },
      501
    );
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;

  try {
    supabaseUrl = requiredEnv("SUPABASE_URL");
    serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
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

    const jobId = claimedJob.job_id;
    const outputPath = `fabric-render/${jobId}/output.png`;

    try {
      await uploadMockOutput(supabaseUrl, serviceRoleKey, outputPath);
      await callRpc(supabaseUrl, serviceRoleKey, "fabric_render_worker_succeed", {
        job_id: jobId,
        output_path: outputPath
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await callRpc(supabaseUrl, serviceRoleKey, "fabric_render_worker_fail", {
        error_message: message,
        job_id: jobId,
        retryable: false
      });

      return jsonResponse(
        {
          error: message,
          job_id: jobId,
          queue_name: queueName,
          status: "failed"
        },
        500
      );
    }

    return jsonResponse({
      job_id: jobId,
      output_path: outputPath,
      queue_name: queueName,
      status: "succeeded"
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
