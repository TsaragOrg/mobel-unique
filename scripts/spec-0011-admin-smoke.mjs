#!/usr/bin/env node

const SUPABASE_URL =
  process.env.SPEC_0011_ADMIN_SMOKE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "http://127.0.0.1:54321";
const WEB_URL =
  process.env.SPEC_0011_ADMIN_SMOKE_WEB_URL ?? "http://127.0.0.1:3000";
const ANON_KEY =
  process.env.SPEC_0011_ADMIN_SMOKE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL =
  process.env.SPEC_0011_ADMIN_SMOKE_EMAIL ??
  "admin.local@mobel-unique.test";
const ADMIN_PASSWORD =
  process.env.SPEC_0011_ADMIN_SMOKE_PASSWORD ??
  "mobel-unique-local-admin-password";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SPEC_0011_ADMIN_SMOKE_TIMEOUT_MS ?? 5000
);

function skip(message) {
  console.log(`SKIP SPEC-0011 admin smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL SPEC-0011 admin smoke: ${message}`);
  process.exit(1);
}

function isLocalUrl(url) {
  return url.includes("127.0.0.1") || url.includes("localhost");
}

function isConnectionFailure(error) {
  const code = error?.cause?.code ?? error?.code;

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    error?.name === "TimeoutError" ||
    error?.message === "fetch failed"
  );
}

async function readJsonResponse(response, label) {
  const responseText = await response.text();

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    fail(`${label} returned non-JSON response: ${responseText}`);
  }
}

async function fetchSupabaseAuthToken() {
  if (!ANON_KEY) {
    skip(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or SPEC_0011_ADMIN_SMOKE_ANON_KEY is required."
    );
  }

  const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

  let response;

  try {
    response = await fetch(tokenUrl, {
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }),
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (isLocalUrl(SUPABASE_URL) && isConnectionFailure(error)) {
      skip(
        `local Supabase is not reachable at ${SUPABASE_URL}. Run \`pnpm supabase:start\`.`
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, "Supabase Auth");

  if (!response.ok) {
    fail(
      `local admin login failed with HTTP ${response.status}. Run \`pnpm supabase:reset\` and verify local admin seed credentials.`
    );
  }

  if (
    !body.access_token ||
    body.user?.app_metadata?.mobel_unique?.role !== "admin"
  ) {
    fail("local admin login did not return the server-controlled admin claim.");
  }

  return body.access_token;
}

async function registerTrustedDevice(accessToken) {
  const registrationUrl = `${WEB_URL}/api/admin/trusted-device`;

  let response;

  try {
    response = await fetch(registrationUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (isLocalUrl(WEB_URL) && isConnectionFailure(error)) {
      skip(
        `local web app is not reachable at ${WEB_URL}. Run \`pnpm dev:web\`.`
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, "trusted device registration");

  if (!response.ok) {
    fail(
      `trusted device registration returned HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }

  const cookie = response.headers.get("set-cookie");

  if (!cookie?.includes("__Host-mobel_admin_device=")) {
    fail("trusted device registration did not return the trusted device cookie.");
  }

  return cookie.split(";")[0];
}

async function verifyTrustedDeviceRestore(accessToken, trustedDeviceCookie) {
  const sessionUrl = `${WEB_URL}/api/admin/session`;
  const response = await fetch(sessionUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: trustedDeviceCookie
    },
    method: "GET",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const body = await readJsonResponse(response, "admin session");

  if (!response.ok) {
    fail(`admin session returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  if (body.data?.admin?.authenticated !== true || body.data.admin.role !== "admin") {
    fail(`unexpected admin session response: ${JSON.stringify(body)}`);
  }
}

const accessToken = await fetchSupabaseAuthToken();
const trustedDeviceCookie = await registerTrustedDevice(accessToken);
await verifyTrustedDeviceRestore(accessToken, trustedDeviceCookie);

console.log("PASS SPEC-0011 admin smoke: trusted device restore succeeded");
