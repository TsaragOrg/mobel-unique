#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const WORKER_SMOKE_FUNCTION_URL =
  process.env.WORKER_SMOKE_FUNCTION_URL ?? `${SUPABASE_URL}/functions/v1/worker-smoke`;
const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_SMOKE_TIMEOUT_MS ?? 5000);

function skip(message) {
  console.log(`SKIP local worker smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL local worker smoke: ${message}`);
  process.exit(1);
}

let response;

try {
  response = await fetch(WORKER_SMOKE_FUNCTION_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
} catch (error) {
  const code = error?.cause?.code ?? error?.code;
  const isLocalFunctionUrl =
    WORKER_SMOKE_FUNCTION_URL.includes("127.0.0.1") ||
    WORKER_SMOKE_FUNCTION_URL.includes("localhost");
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    error?.name === "TimeoutError" ||
    (isLocalFunctionUrl && error?.message === "fetch failed")
  ) {
    skip(
      `local Supabase Edge Function is not reachable at ${WORKER_SMOKE_FUNCTION_URL}. ` +
        "Run `pnpm supabase:start` and `pnpm supabase:functions:serve`."
    );
  }

  fail(error instanceof Error ? error.message : String(error));
}

const responseText = await response.text();
let body;

try {
  body = responseText ? JSON.parse(responseText) : {};
} catch {
  fail(`expected JSON response, received: ${responseText}`);
}

if (!response.ok) {
  fail(
    `worker-smoke function returned HTTP ${response.status}: ${JSON.stringify(body)}`
  );
}

if (body.status !== "ok" || !body.job_id || !body.queue_name) {
  fail(`unexpected smoke response: ${JSON.stringify(body)}`);
}

console.log(
  `PASS local worker smoke: processed job ${body.job_id} from ${body.queue_name}`
);
