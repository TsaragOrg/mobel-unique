// SPEC-0007 PLAN-0012 in-home simulation retention purge.
//
// This Edge Function lists in-home simulation jobs whose
// `retention_deadline` has passed, deletes every object under each
// job's storage prefix in `simulation-private-artifacts`, and marks the
// row as `expired`. The function is idempotent: a missing object
// counts as already deleted, and a job that is already `expired` is a
// clean no-op.
//
// Trigger via `pnpm sim:purge` locally or via a scheduled cron in
// production. The visitor-facing API never calls this function.

const FUNCTION_NAME = "in-home-simulation-purge";
const STORAGE_BUCKET = "simulation-private-artifacts";
const DEFAULT_BATCH_SIZE = 50;

type ExpiredJobRow = {
  job_id: string;
  storage_prefix: string;
  status: string;
  retention_deadline: string;
};

type StorageObject = {
  name: string;
  id: string;
};

type PurgeResult = {
  job_id: string;
  storage_prefix: string;
  objects_deleted: number;
  marked_expired: boolean;
  error?: string;
};

type PurgeResponse = {
  function_name: string;
  status: "noop" | "ok" | "partial" | "failed";
  processed: number;
  results: PurgeResult[];
  error?: string;
};

function jsonResponse(body: PurgeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

function failed(error: string, status = 500): Response {
  return jsonResponse(
    {
      function_name: FUNCTION_NAME,
      status: "failed",
      processed: 0,
      results: [],
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

async function listExpiredJobs(
  supabaseUrl: string,
  serviceRoleKey: string,
  batchSize: number
): Promise<ExpiredJobRow[]> {
  const rows = await callRpc<ExpiredJobRow[] | null>(
    supabaseUrl,
    serviceRoleKey,
    "list_expired_in_home_simulation_jobs",
    { batch_size: batchSize }
  );
  return Array.isArray(rows) ? rows : [];
}

async function listStorageObjects(
  supabaseUrl: string,
  serviceRoleKey: string,
  prefix: string
): Promise<StorageObject[]> {
  const collected: StorageObject[] = [];
  const queue: string[] = [prefix];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    let offset = 0;
    while (true) {
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/list/${STORAGE_BUCKET}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            "apikey": serviceRoleKey
          },
          body: JSON.stringify({
            prefix: current,
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" }
          })
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `storage list failed for ${current}: HTTP ${response.status} ${text}`
        );
      }
      const rows = (await response.json()) as Array<
        StorageObject & { metadata?: { size?: number } | null }
      >;
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const row of rows) {
        const fullPath = current ? `${current}/${row.name}` : row.name;
        if (row.id === null || row.id === undefined) {
          // Folder-like entry, descend into it.
          queue.push(fullPath);
        } else {
          collected.push({ ...row, name: fullPath });
        }
      }
      if (rows.length < 100) break;
      offset += rows.length;
    }
  }
  return collected;
}

async function deleteStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string
): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey
      }
    }
  );
  if (response.status === 404 || response.status === 200) {
    return true;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `storage delete failed for ${path}: HTTP ${response.status} ${text}`
    );
  }
  return true;
}

async function purgeJob(
  supabaseUrl: string,
  serviceRoleKey: string,
  job: ExpiredJobRow
): Promise<PurgeResult> {
  const result: PurgeResult = {
    job_id: job.job_id,
    storage_prefix: job.storage_prefix,
    objects_deleted: 0,
    marked_expired: false
  };
  try {
    const objects = await listStorageObjects(
      supabaseUrl,
      serviceRoleKey,
      job.storage_prefix
    );
    for (const obj of objects) {
      const ok = await deleteStorageObject(supabaseUrl, serviceRoleKey, obj.name);
      if (ok) result.objects_deleted += 1;
    }
    await callRpc<void>(
      supabaseUrl,
      serviceRoleKey,
      "mark_in_home_simulation_job_purged",
      { job_id: job.job_id }
    );
    result.marked_expired = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return failed("Method not allowed", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return failed("Missing local Supabase function environment", 500);
  }

  const batchSize = parsePositiveInt(
    "IN_HOME_SIMULATION_PURGE_BATCH_SIZE",
    DEFAULT_BATCH_SIZE
  );

  let jobs: ExpiredJobRow[];
  try {
    jobs = await listExpiredJobs(supabaseUrl, serviceRoleKey, batchSize);
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : String(error),
      502
    );
  }

  if (jobs.length === 0) {
    return jsonResponse({
      function_name: FUNCTION_NAME,
      status: "noop",
      processed: 0,
      results: []
    });
  }

  const results: PurgeResult[] = [];
  for (const job of jobs) {
    results.push(await purgeJob(supabaseUrl, serviceRoleKey, job));
  }

  const allOk = results.every((r) => r.marked_expired && !r.error);
  return jsonResponse({
    function_name: FUNCTION_NAME,
    status: allOk ? "ok" : "partial",
    processed: results.filter((r) => r.marked_expired).length,
    results
  });
});
