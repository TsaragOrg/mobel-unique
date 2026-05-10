#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 140_000;

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:dispatch: ${message}`);
  process.exit(exitCode);
}

function info(message) {
  console.log(message);
}

function parseArgs(argv) {
  const args = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--") {
      continue;
    }
    if (value === "--once") {
      continue;
    }
    if (value === "--timeout-ms") {
      args.timeoutMs = Number.parseInt(argv[++i] ?? "", 10);
      continue;
    }
    if (value.startsWith("--")) {
      fail(`unknown flag: ${value}`, 2);
    }
    fail(`unexpected positional argument: ${value}`, 2);
  }

  return args;
}

function ensureLocalSupabaseUrl(url) {
  if (!url) {
    fail("SUPABASE_URL is required", 2);
  }
  if (
    !url.startsWith("http://127.0.0.1") &&
    !url.startsWith("http://localhost")
  ) {
    fail(
      `SUPABASE_URL must point at a local Supabase instance (got ${url}). Refusing to dispatch against DEV or PROD.`,
      2,
    );
  }
}

function ensurePositiveInteger(name, value, minimum) {
  if (!Number.isFinite(value) || value < minimum) {
    fail(`${name} must be an integer greater than or equal to ${minimum}`, 2);
  }
}

function formatDispatchResult(body) {
  return [
    `status=${body.status ?? "unknown"}`,
    `processed=${body.processed ?? 0}`,
    `started=${body.started_count ?? 0}`,
    `queued=${body.queued ?? 0}`,
    `active=${body.active_processing ?? "-"}`,
  ].join(" ");
}

async function dispatchOnce({ supabaseUrl, invokeSecret, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let text = "";

  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/in-home-simulation-worker`,
      {
        body: JSON.stringify({ mode: "dispatch" }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(invokeSecret
            ? { "x-in-home-simulation-worker-secret": invokeSecret }
            : {}),
        },
        method: "POST",
        signal: controller.signal,
      },
    );
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`worker dispatch timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `worker dispatch returned HTTP ${response.status}: ${text}`,
    );
  }

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!body || body.function_name !== "in-home-simulation-worker") {
    throw new Error(`unexpected worker response: ${text}`);
  }
  if (body.status === "failed" && body.error) {
    throw new Error(body.error);
  }

  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensurePositiveInteger("--timeout-ms", args.timeoutMs, 1000);

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  ensureLocalSupabaseUrl(supabaseUrl);

  const invokeSecret = process.env.IN_HOME_SIMULATION_WORKER_INVOKE_SECRET;

  try {
    const body = await dispatchOnce({
      invokeSecret,
      supabaseUrl,
      timeoutMs: args.timeoutMs,
    });
    info(`PASS sim:dispatch:once ${formatDispatchResult(body)}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

await main();
