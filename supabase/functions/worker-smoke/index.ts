type WorkerSmokeResponse = {
  status?: string;
  job_id?: string;
  queue_name?: string;
  error?: string;
};

function jsonResponse(body: WorkerSmokeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const queueName = Deno.env.get("WORKER_SMOKE_QUEUE_NAME") ?? "local_worker_smoke_jobs";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing local Supabase function environment" }, 500);
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/worker_smoke_run`, {
    body: JSON.stringify({ queue_name: queueName }),
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "apikey": serviceRoleKey
    },
    method: "POST"
  });

  const responseText = await rpcResponse.text();

  return new Response(responseText, {
    headers: {
      "Content-Type": rpcResponse.headers.get("Content-Type") ?? "application/json"
    },
    status: rpcResponse.status
  });
});
