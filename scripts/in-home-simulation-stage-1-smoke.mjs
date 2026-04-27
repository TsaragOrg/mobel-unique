#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const FUNCTION_URL =
  process.env.IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL ??
  `${SUPABASE_URL}/functions/v1/in-home-simulation-worker`;
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_STAGE_1_TIMEOUT_MS ?? 5000
);
const ALLOWED_OUTCOMES = new Set(["noop", "claimed", "completed"]);

function skip(message) {
  console.log(`SKIP in-home simulation stage 1 smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation stage 1 smoke: ${message}`);
  process.exit(1);
}

let response;

try {
  response = await fetch(FUNCTION_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
} catch (error) {
  const code = error?.cause?.code ?? error?.code;
  const isLocalFunctionUrl =
    FUNCTION_URL.includes("127.0.0.1") || FUNCTION_URL.includes("localhost");
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    error?.name === "TimeoutError" ||
    (isLocalFunctionUrl && error?.message === "fetch failed")
  ) {
    skip(
      `local Supabase Edge Function is not reachable at ${FUNCTION_URL}. ` +
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
    `in-home-simulation-worker returned HTTP ${response.status}: ${JSON.stringify(body)}`
  );
}

if (body.function_name !== "in-home-simulation-worker") {
  fail(`unexpected function_name in response: ${JSON.stringify(body)}`);
}

if (body.stage !== "stage_1") {
  fail(`expected stage_1 response, received: ${JSON.stringify(body)}`);
}

if (!ALLOWED_OUTCOMES.has(body.status)) {
  fail(`unexpected stage 1 outcome: ${JSON.stringify(body)}`);
}

if (typeof body.processed !== "number" || body.processed < 0) {
  fail(`expected non-negative processed count, received: ${JSON.stringify(body)}`);
}

console.log(
  `PASS in-home simulation stage 1 smoke: outcome=${body.status} processed=${body.processed}`
);
