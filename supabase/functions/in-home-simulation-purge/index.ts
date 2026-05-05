// SPEC-0007 PLAN-0012 in-home simulation retention purge.
//
// This Edge Function lists in-home simulation jobs whose
// `retention_deadline` has passed, deletes every object under each
// job's storage prefix in `simulation-private-artifacts`, and marks the
// row as `expired`. It also performs the SPEC-0007 orphan upload
// cleanup: room upload objects under `simulations/{job_id}/inputs/...`
// whose owning job does not exist and that are older than the orphan
// age threshold are deleted.
//
// The function is idempotent: missing objects count as already deleted
// and jobs that are already `expired` are a clean no-op.
//
// Trigger via `pnpm sim:purge` locally or via a scheduled cron in
// production. The visitor-facing API never calls this function.

import {
  extractJobIdFromUploadPath
} from "../in-home-simulation-worker/lib/orphan-paths.ts";

const FUNCTION_NAME = "in-home-simulation-purge";
const STORAGE_BUCKET = "simulation-private-artifacts";
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_ORPHAN_MIN_AGE_HOURS = 1;

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
  orphans_deleted?: number;
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

  const results: PurgeResult[] = [];
  for (const job of jobs) {
    results.push(await purgeJob(supabaseUrl, serviceRoleKey, job));
  }

  const orphansDeleted = await deleteOrphanUploads(
    supabaseUrl,
    serviceRoleKey
  );

  if (jobs.length === 0 && orphansDeleted === 0) {
    return jsonResponse({
      function_name: FUNCTION_NAME,
      status: "noop",
      processed: 0,
      results: [],
      orphans_deleted: 0
    });
  }

  const allOk = results.every((r) => r.marked_expired && !r.error);
  return jsonResponse({
    function_name: FUNCTION_NAME,
    status: allOk ? "ok" : "partial",
    processed: results.filter((r) => r.marked_expired).length,
    results,
    orphans_deleted: orphansDeleted
  });
});

async function deleteOrphanUploads(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<number> {
  const minAgeHours = parsePositiveInt(
    "IN_HOME_SIMULATION_ORPHAN_MIN_AGE_HOURS",
    DEFAULT_ORPHAN_MIN_AGE_HOURS
  );
  const cutoffMs = Date.now() - minAgeHours * 3600 * 1000;

  let allObjects: Array<{ name: string; lastModifiedMs: number }>;
  try {
    const raw = await listAllUploadObjects(supabaseUrl, serviceRoleKey);
    allObjects = raw;
  } catch (_error) {
    return 0;
  }

  const candidates = allObjects.filter((o) => {
    if (o.lastModifiedMs > cutoffMs) return false;
    return extractJobIdFromUploadPath(o.name) !== null;
  });

  if (candidates.length === 0) return 0;

  const candidateJobIds = Array.from(
    new Set(
      candidates
        .map((o) => extractJobIdFromUploadPath(o.name))
        .filter((id): id is string => id !== null)
    )
  );

  let existingJobIds: Set<string>;
  try {
    existingJobIds = await fetchExistingJobIds(
      supabaseUrl,
      serviceRoleKey,
      candidateJobIds
    );
  } catch (_error) {
    return 0;
  }

  let deleted = 0;
  for (const obj of candidates) {
    const jobId = extractJobIdFromUploadPath(obj.name);
    if (jobId && existingJobIds.has(jobId)) continue;
    try {
      const ok = await deleteStorageObject(
        supabaseUrl,
        serviceRoleKey,
        obj.name
      );
      if (ok) deleted += 1;
    } catch (_error) {
      /* swallow individual delete errors */
    }
  }
  return deleted;
}

async function listAllUploadObjects(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<Array<{ name: string; lastModifiedMs: number }>> {
  const collected: Array<{ name: string; lastModifiedMs: number }> = [];
  // Walk down by listing simulations/, then for each subdir list its
  // inputs/ folder. Folder entries appear with id = null in Supabase
  // storage list responses.
  const root = await rawList(supabaseUrl, serviceRoleKey, "simulations");
  for (const entry of root) {
    if (entry.id !== null && entry.id !== undefined) continue;
    const jobPrefix = `simulations/${entry.name}`;
    const inputsList = await rawList(
      supabaseUrl,
      serviceRoleKey,
      `${jobPrefix}/inputs`
    );
    for (const obj of inputsList) {
      if (obj.id === null || obj.id === undefined) continue;
      const lastModified = obj.updated_at ?? obj.created_at ?? null;
      const ms = lastModified ? Date.parse(lastModified) : Date.now();
      collected.push({
        name: `${jobPrefix}/inputs/${obj.name}`,
        lastModifiedMs: Number.isFinite(ms) ? ms : Date.now()
      });
    }
  }
  return collected;
}

async function rawList(
  supabaseUrl: string,
  serviceRoleKey: string,
  prefix: string
): Promise<
  Array<{
    name: string;
    id: string | null;
    updated_at?: string;
    created_at?: string;
  }>
> {
  const collected: Array<{
    name: string;
    id: string | null;
    updated_at?: string;
    created_at?: string;
  }> = [];
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
          prefix,
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`storage list failed: HTTP ${response.status}`);
    }
    const rows = (await response.json()) as Array<{
      name: string;
      id: string | null;
      updated_at?: string;
      created_at?: string;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) break;
    collected.push(...rows);
    if (rows.length < 100) break;
    offset += rows.length;
  }
  return collected;
}

async function fetchExistingJobIds(
  supabaseUrl: string,
  serviceRoleKey: string,
  candidateJobIds: string[]
): Promise<Set<string>> {
  if (candidateJobIds.length === 0) return new Set();
  const inList = candidateJobIds
    .map((id) => `"${id}"`)
    .join(",");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=in.(${inList})&select=id`,
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
    throw new Error(`job lookup failed: HTTP ${response.status}`);
  }
  const rows = (await response.json()) as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}
