#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { extname, basename } from "node:path";
import { randomUUID } from "node:crypto";

const SUPPORTED_EXTENSIONS = new Map([
  [".jpg", { contentType: "image/jpeg", normalized: "jpg" }],
  [".jpeg", { contentType: "image/jpeg", normalized: "jpeg" }],
  [".png", { contentType: "image/png", normalized: "png" }],
  [".webp", { contentType: "image/webp", normalized: "webp" }],
  [".heic", { contentType: "image/heic", normalized: "heic" }],
  [".heif", { contentType: "image/heif", normalized: "heif" }]
]);

const STORAGE_BUCKET = "simulation-private-artifacts";

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:enqueue:stage1: ${message}`);
  process.exit(exitCode);
}

function info(message) {
  console.log(message);
}

function parseArgs(argv) {
  const args = { photo: null, queue: null, retentionHours: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--photo") {
      args.photo = argv[++i];
    } else if (value === "--queue") {
      args.queue = argv[++i];
    } else if (value === "--retention-hours") {
      args.retentionHours = Number.parseInt(argv[++i], 10);
    } else if (value.startsWith("--")) {
      fail(`unknown flag: ${value}`, 2);
    } else {
      positional.push(value);
    }
  }
  if (!args.photo && positional.length > 0) {
    args.photo = positional[0];
  }
  return args;
}

function ensureLocalSupabaseUrl(url) {
  if (!url) {
    fail("SUPABASE_URL is required", 2);
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url) && !url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
    fail(
      `SUPABASE_URL must point at a local Supabase instance (got ${url}). Refusing to seed against DEV or PROD.`,
      2
    );
  }
}

function pickExtension(photoPath) {
  const lower = extname(photoPath).toLowerCase();
  const meta = SUPPORTED_EXTENSIONS.get(lower);
  if (!meta) {
    fail(
      `unsupported photo extension: ${lower || "<none>"}. Supported: ${[...SUPPORTED_EXTENSIONS.keys()].join(", ")}`,
      2
    );
  }
  return meta;
}

async function uploadPhoto({
  supabaseUrl,
  serviceRoleKey,
  storagePath,
  body,
  contentType
}) {
  const url = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    fail(`storage upload failed: HTTP ${response.status} ${text}`);
  }
}

async function callRpc({ supabaseUrl, serviceRoleKey, name, body }) {
  const url = `${supabaseUrl}/rest/v1/rpc/${name}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    fail(`rpc ${name} failed: HTTP ${response.status} ${text}`);
  }
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`rpc ${name} returned non-JSON response: ${text}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.photo) {
    fail(
      "missing --photo argument. Usage: pnpm sim:enqueue:stage1 -- --photo /path/to/room.jpg",
      2
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  ensureLocalSupabaseUrl(supabaseUrl);

  if (!serviceRoleKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is required", 2);
  }

  const queueName =
    args.queue ??
    process.env.IN_HOME_SIMULATION_QUEUE_NAME ??
    "local_in_home_simulation_jobs";
  const retentionHours =
    args.retentionHours ??
    Number.parseInt(process.env.SIMULATION_RETENTION_HOURS ?? "24", 10);

  if (!Number.isFinite(retentionHours) || retentionHours <= 0 || retentionHours > 24) {
    fail("retention hours must be a positive integer no greater than 24", 2);
  }

  const photoStat = await stat(args.photo).catch(() => null);
  if (!photoStat || !photoStat.isFile()) {
    fail(`photo file not found or not a regular file: ${args.photo}`, 2);
  }

  const ext = pickExtension(args.photo);
  const photoBytes = await readFile(args.photo);
  const jobId = randomUUID();
  const storagePath = `simulations/${jobId}/inputs/room.${ext.normalized}`;

  info(`Uploading ${basename(args.photo)} (${photoBytes.length} bytes) to ${STORAGE_BUCKET}/${storagePath}`);
  await uploadPhoto({
    supabaseUrl,
    serviceRoleKey,
    storagePath,
    body: photoBytes,
    contentType: ext.contentType
  });

  info("Seeding local test catalog fixtures and simulation job");
  const seededJobId = await callRpc({
    supabaseUrl,
    serviceRoleKey,
    name: "seed_in_home_simulation_local_test_job",
    body: {
      customer_room_original_path: storagePath,
      job_id_override: jobId,
      retention_hours: retentionHours
    }
  });

  if (seededJobId !== jobId) {
    fail(
      `seed function returned a different job id (${seededJobId}) than the upload path uses (${jobId})`
    );
  }

  info(`Enqueueing room-prep work message on queue ${queueName}`);
  const msgId = await callRpc({
    supabaseUrl,
    serviceRoleKey,
    name: "enqueue_in_home_simulation_room_prep_message",
    body: { job_id: jobId, queue_name: queueName }
  });

  info("");
  info(`PASS sim:enqueue:stage1: job_id=${jobId} queue=${queueName} msg_id=${msgId}`);
  info("");
  info("Next steps:");
  info(`  pnpm supabase:functions:serve   # serve in-home-simulation-worker locally`);
  info(`  curl -X POST $(pnpm -s supabase:status | grep API | awk '{print $3}')/functions/v1/in-home-simulation-worker`);
  info(`  pnpm sim:status -- ${jobId}`);
}

await main();
