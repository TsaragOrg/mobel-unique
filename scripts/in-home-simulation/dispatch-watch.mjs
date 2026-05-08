#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 140_000;
const MIN_INTERVAL_MS = 1000;

function fail(message, exitCode = 1) {
  console.error(`FAIL sim:dispatch: ${message}`);
  process.exit(exitCode);
}

function info(message) {
  console.log(message);
}

function parseArgs(argv) {
  const args = {
    intervalMs: DEFAULT_INTERVAL_MS,
    once: false,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--") {
      continue;
    }
    if (value === "--once") {
      args.once = true;
      continue;
    }
    if (value === "--interval-ms") {
      args.intervalMs = Number.parseInt(argv[++i] ?? "", 10);
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
  if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
    fail(
      `SUPABASE_URL must point at a local Supabase instance (got ${url}). Refusing to dispatch against DEV or PROD.`,
      2
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
    `active=${body.active_processing ?? "-"}`
  ].join(" ");
}

async function dispatchOnce({ supabaseUrl, invokeSecret, timeoutMs }) {
  const args = [
    "-sS",
    "--max-time",
    String(timeoutMs / 1000),
    "-X",
    "POST",
    `${supabaseUrl}/functions/v1/in-home-simulation-worker`,
    "-H",
    "Accept: application/json",
    "-H",
    "Content-Type: application/json"
  ];

  if (invokeSecret) {
    args.push("-H", `x-in-home-simulation-worker-secret: ${invokeSecret}`);
  }

  args.push("-d", JSON.stringify({ mode: "dispatch" }));

  const text = await new Promise((resolve, reject) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (status) => {
      if (status !== 0) {
        reject(new Error(stderr.trim() || `curl exited with status ${status}`));
        return;
      }
      resolve(stdout);
    });
  });

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
  ensurePositiveInteger("--interval-ms", args.intervalMs, MIN_INTERVAL_MS);
  ensurePositiveInteger("--timeout-ms", args.timeoutMs, 1000);

  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  ensureLocalSupabaseUrl(supabaseUrl);

  const invokeSecret = process.env.IN_HOME_SIMULATION_WORKER_INVOKE_SECRET;

  if (args.once) {
    try {
      const body = await dispatchOnce({
        invokeSecret,
        supabaseUrl,
        timeoutMs: args.timeoutMs
      });
      info(`PASS sim:dispatch:once ${formatDispatchResult(body)}`);
      return;
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  let stopped = false;
  process.once("SIGINT", () => {
    stopped = true;
    info("");
    info("Stopped sim:dispatch:watch");
  });

  info(
    `Watching local in-home simulation dispatch outbox every ${args.intervalMs}ms at ${supabaseUrl}`
  );

  while (!stopped) {
    try {
      const body = await dispatchOnce({
        invokeSecret,
        supabaseUrl,
        timeoutMs: args.timeoutMs
      });
      info(`${new Date().toISOString()} ${formatDispatchResult(body)}`);
    } catch (error) {
      console.error(
        `${new Date().toISOString()} dispatch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!stopped) {
      await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
    }
  }
}

await main();
