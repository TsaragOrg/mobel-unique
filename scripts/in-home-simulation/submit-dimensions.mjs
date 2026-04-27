#!/usr/bin/env node

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:dimensions:submit: ${message}`);
  process.exit(exitCode);
}

function info(message) {
  console.log(message);
}

function ensureLocalSupabaseUrl(url) {
  if (!url) fail("SUPABASE_URL is required", 2);
  if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
    fail(
      `SUPABASE_URL must point at a local Supabase instance (got ${url}). Refusing DEV or PROD.`,
      2
    );
  }
}

function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value ?? ""
  );
}

function parseArgs(argv) {
  const args = {
    jobId: null,
    wallWidth: null,
    wallHeight: null,
    leftWallWidth: null,
    rightWallWidth: null,
    roomHeight: null
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--wall-width") args.wallWidth = Number.parseFloat(argv[++i]);
    else if (value === "--wall-height") args.wallHeight = Number.parseFloat(argv[++i]);
    else if (value === "--left-wall") args.leftWallWidth = Number.parseFloat(argv[++i]);
    else if (value === "--right-wall") args.rightWallWidth = Number.parseFloat(argv[++i]);
    else if (value === "--room-height") args.roomHeight = Number.parseFloat(argv[++i]);
    else if (value.startsWith("--")) fail(`unknown flag: ${value}`, 2);
    else positional.push(value);
  }
  if (positional[0]) args.jobId = positional[0];
  return args;
}

async function callRpc({ supabaseUrl, serviceRoleKey, name, body }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) fail(`${name} failed: HTTP ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.jobId) {
    fail(
      "missing job id. Usage: pnpm sim:dimensions:submit -- <job_id> --wall-width N --wall-height N",
      2
    );
  }
  if (!isLikelyUuid(args.jobId)) fail(`job id is not a valid UUID: ${args.jobId}`, 2);

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  ensureLocalSupabaseUrl(supabaseUrl);
  if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required", 2);

  const queueName =
    process.env.IN_HOME_SIMULATION_QUEUE_NAME ?? "local_in_home_simulation_jobs";

  let suppliedDimensions;
  if (args.wallWidth !== null && args.wallHeight !== null) {
    suppliedDimensions = {
      wall_width: args.wallWidth,
      wall_height: args.wallHeight
    };
  } else if (
    args.leftWallWidth !== null &&
    args.rightWallWidth !== null &&
    args.roomHeight !== null
  ) {
    suppliedDimensions = {
      left_wall_width: args.leftWallWidth,
      right_wall_width: args.rightWallWidth,
      room_height: args.roomHeight
    };
  } else {
    fail(
      "supply either --wall-width and --wall-height (back_wall) or --left-wall, --right-wall, and --room-height (corner)",
      2
    );
  }

  info(`Submitting dimensions for job ${args.jobId}`);
  const msgId = await callRpc({
    supabaseUrl,
    serviceRoleKey,
    name: "submit_in_home_simulation_dimensions",
    body: {
      job_id: args.jobId,
      supplied_dimensions: suppliedDimensions,
      queue_name: queueName
    }
  });

  info(`PASS sim:dimensions:submit: queued placement msg_id=${msgId}`);
}

await main();
