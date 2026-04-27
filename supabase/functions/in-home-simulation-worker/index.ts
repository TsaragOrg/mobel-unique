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

const FUNCTION_NAME = "in-home-simulation-worker";

function jsonResponse(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

function missingEnvResponse(): Response {
  return jsonResponse(
    {
      status: "failed",
      function_name: FUNCTION_NAME,
      stage: "unknown",
      processed: 0,
      error: "Missing local Supabase function environment"
    },
    500
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
    return missingEnvResponse();
  }

  return jsonResponse({
    status: "noop",
    function_name: FUNCTION_NAME,
    stage: "stage_1",
    processed: 0
  });
});
