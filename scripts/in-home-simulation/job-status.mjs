#!/usr/bin/env node

const STORAGE_BUCKET = "simulation-private-artifacts";
const SIGNED_URL_TTL_SECONDS = 600;

const TRACKED_PATH_FIELDS = [
  "customer_room_original_path",
  "room_normalized_path",
  "room_compressed_path",
  "room_cleaned_path",
  "dimension_guide_overlay_path",
  "prepared_sofa_path",
  "worker_error_path"
];

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:status: ${message}`);
  process.exit(exitCode);
}

function info(message) {
  console.log(message);
}

function ensureLocalSupabaseUrl(url) {
  if (!url) {
    fail("SUPABASE_URL is required", 2);
  }
  if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
    fail(
      `SUPABASE_URL must point at a local Supabase instance (got ${url}). Refusing to inspect DEV or PROD.`,
      2
    );
  }
}

function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value ?? ""
  );
}

async function fetchJob({ supabaseUrl, serviceRoleKey, jobId }) {
  const url = `${supabaseUrl}/rest/v1/in_home_simulation_jobs?id=eq.${jobId}&select=*`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Accept": "application/json"
    }
  });
  if (!response.ok) {
    const text = await response.text();
    fail(`job lookup failed: HTTP ${response.status} ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    fail(`job not found: ${jobId}`);
  }
  return rows[0];
}

async function fetchOutputs({ supabaseUrl, serviceRoleKey, jobId }) {
  const url = `${supabaseUrl}/rest/v1/simulation_generated_outputs?in_home_simulation_job_id=eq.${jobId}&order=generation_index.asc`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Accept": "application/json"
    }
  });
  if (!response.ok) {
    return [];
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function signedUrlFor({ supabaseUrl, serviceRoleKey, path }) {
  if (!path) {
    return null;
  }
  const url = `${supabaseUrl}/storage/v1/object/sign/${STORAGE_BUCKET}/${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS })
  });
  if (!response.ok) {
    return `(signed URL failed: HTTP ${response.status})`;
  }
  const body = await response.json();
  return body?.signedURL ? `${supabaseUrl}/storage/v1${body.signedURL}` : null;
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    fail("missing job id. Usage: pnpm sim:status -- <job_id>", 2);
  }
  if (!isLikelyUuid(jobId)) {
    fail(`job id is not a valid UUID: ${jobId}`, 2);
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  ensureLocalSupabaseUrl(supabaseUrl);

  if (!serviceRoleKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is required", 2);
  }

  const job = await fetchJob({ supabaseUrl, serviceRoleKey, jobId });
  const outputs = await fetchOutputs({ supabaseUrl, serviceRoleKey, jobId });

  info("");
  info(`Job ${job.id}`);
  info(`  status:                 ${job.status}`);
  info(`  storage_prefix:         ${job.storage_prefix}`);
  info(`  retention_deadline:     ${job.retention_deadline}`);
  info(`  room_prep_attempts:     ${job.room_prep_attempt_count} / ${job.max_attempts_per_stage}`);
  info(`  placement_attempts:     ${job.placement_attempt_count} / ${job.max_attempts_per_stage}`);
  info(`  generated_outputs:      ${job.generated_output_count} (latest_index=${job.latest_generated_output_index ?? "-"})`);
  info(`  reserved_index:         ${job.reserved_generation_index ?? "-"}`);
  info(`  room_geometry_mode:     ${job.room_geometry_mode ?? "-"}`);
  info(`  claimed_by:             ${job.claimed_by ?? "-"}`);
  info(`  claim_expires_at:       ${job.claim_expires_at ?? "-"}`);
  info(`  last_error_message:     ${job.last_error_message ?? "-"}`);
  info(`  last_regeneration_err:  ${job.last_regeneration_error_message ?? "-"}`);
  info("");
  info("Persisted artifacts (signed URLs valid for 10 minutes):");

  for (const field of TRACKED_PATH_FIELDS) {
    const path = job[field];
    if (!path) {
      info(`  ${field}: -`);
      continue;
    }
    const signed = await signedUrlFor({ supabaseUrl, serviceRoleKey, path });
    info(`  ${field}: ${path}`);
    if (signed) {
      info(`    signed: ${signed}`);
    }
  }

  if (outputs.length > 0) {
    info("");
    info("Generated output artifacts:");
    for (const row of outputs) {
      const signed = await signedUrlFor({
        supabaseUrl,
        serviceRoleKey,
        path: row.object_path
      });
      info(`  output[${row.generation_index}]: ${row.object_path}`);
      info(`    provider=${row.provider_name}/${row.provider_model} prompt=${row.prompt_version}`);
      if (signed) {
        info(`    signed: ${signed}`);
      }
    }
  }
}

await main();
