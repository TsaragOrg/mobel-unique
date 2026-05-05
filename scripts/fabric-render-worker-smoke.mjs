#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const FUNCTION_URL =
  process.env.FABRIC_RENDER_WORKER_FUNCTION_URL ??
  `${SUPABASE_URL}/functions/v1/fabric-render-worker`;
const REQUEST_TIMEOUT_MS = Number(
  process.env.FABRIC_RENDER_WORKER_SMOKE_TIMEOUT_MS ?? 5000,
);

function skip(message) {
  console.log(`SKIP fabric render worker smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL fabric render worker smoke: ${message}`);
  process.exit(1);
}

function isLocalFunctionUrl(url) {
  return url.includes("127.0.0.1") || url.includes("localhost");
}

function buildWorkerHeaders(headers) {
  const invokeSecret = process.env.FABRIC_RENDER_WORKER_INVOKE_SECRET;

  return {
    ...headers,
    ...(invokeSecret
      ? {
          "x-fabric-render-worker-secret": invokeSecret,
        }
      : {}),
  };
}

let response;

try {
  response = await fetch(FUNCTION_URL, {
    body: JSON.stringify({
      mode: "pump",
      request_id: "00000000-0000-4000-8000-000000000001",
    }),
    headers: buildWorkerHeaders({
      "Content-Type": "application/json",
      "x-fabric-render-seed-mock-job": "1",
    }),
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
} catch (error) {
  const code = error?.cause?.code ?? error?.code;

  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    error?.name === "TimeoutError" ||
    (isLocalFunctionUrl(FUNCTION_URL) && error?.message === "fetch failed")
  ) {
    skip(
      `local Supabase Edge Function is not reachable at ${FUNCTION_URL}. ` +
        "Run `pnpm supabase:start` and `pnpm supabase:functions:serve`.",
    );
  }

  fail(error instanceof Error ? error.message : String(error));
}

const responseText = await response.text();

if (
  isLocalFunctionUrl(FUNCTION_URL) &&
  response.status === 404 &&
  responseText.includes("Function not found")
) {
  skip(
    `local Supabase Edge Function is not served at ${FUNCTION_URL}. ` +
      "Run `pnpm supabase:start` and `pnpm supabase:functions:serve`.",
  );
}

let body;

try {
  body = responseText ? JSON.parse(responseText) : {};
} catch {
  fail(`expected JSON response, received: ${responseText}`);
}

if (!response.ok) {
  fail(
    `fabric-render-worker function returned HTTP ${response.status}: ${JSON.stringify(body)}`,
  );
}

if (
  body.mode !== "pump" ||
  !body.request_id ||
  (body.status !== "started" && body.status !== "idle") ||
  typeof body.started_count !== "number"
) {
  fail(`unexpected fabric render smoke response: ${JSON.stringify(body)}`);
}

console.log(
  `PASS fabric render worker smoke: pump ${body.status} for request ${body.request_id} with ${body.started_count} started job workers`,
);
