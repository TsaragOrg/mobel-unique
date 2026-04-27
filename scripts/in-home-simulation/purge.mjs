#!/usr/bin/env node

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:purge: ${message}`);
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

async function main() {
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) {
      fail(`unknown flag: ${process.argv[i]}`, 2);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  ensureLocalSupabaseUrl(supabaseUrl);
  if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is required", 2);

  const url = `${supabaseUrl}/functions/v1/in-home-simulation-purge`;

  info(`Triggering in-home-simulation-purge at ${url}`);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey
      },
      signal: AbortSignal.timeout(60000)
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await response.text();
  if (!response.ok) fail(`HTTP ${response.status}: ${body}`);

  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    fail(`unexpected non-JSON response: ${body}`);
  }

  info(`Status: ${parsed.status} (${parsed.processed} jobs purged)`);
  for (const result of parsed.results ?? []) {
    if (result.error) {
      info(
        `  ${result.job_id}: error=${result.error} objects_deleted=${result.objects_deleted}`
      );
    } else {
      info(
        `  ${result.job_id}: marked_expired=${result.marked_expired} objects_deleted=${result.objects_deleted}`
      );
    }
  }

  if (parsed.status === "ok" || parsed.status === "noop") {
    info("PASS sim:purge");
  } else {
    fail(`purge ended with status ${parsed.status}`);
  }
}

await main();
