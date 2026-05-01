#!/usr/bin/env node

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:recover-expired: ${message}`);
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
  let batchSize = 100;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--") {
      continue;
    } else if (process.argv[i] === "--batch-size") {
      batchSize = Number.parseInt(process.argv[++i], 10);
      if (!Number.isFinite(batchSize) || batchSize <= 0) {
        fail("--batch-size must be a positive integer", 2);
      }
    } else if (process.argv[i].startsWith("--")) {
      fail(`unknown flag: ${process.argv[i]}`, 2);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  ensureLocalSupabaseUrl(supabaseUrl);
  if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required", 2);

  info(`Recovering expired in-home simulation claims (batch_size=${batchSize})`);
  const rows = await callRpc({
    supabaseUrl,
    serviceRoleKey,
    name: "recover_expired_in_home_simulation_claims",
    body: { batch_size: batchSize }
  });

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    info("PASS sim:recover-expired: no expired claims to recover");
    return;
  }

  for (const row of list) {
    info(
      `  ${row.job_id}: ${row.previous_status} -> ${row.new_status} (${row.reason})`
    );
  }
  info(`PASS sim:recover-expired: processed ${list.length} expired claims`);
}

await main();
