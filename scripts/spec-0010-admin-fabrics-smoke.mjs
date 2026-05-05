#!/usr/bin/env node

const SUPABASE_URL =
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "http://127.0.0.1:54321";
const WEB_URL =
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_WEB_URL ?? "http://127.0.0.1:3000";
const ANON_KEY =
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL =
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_EMAIL ??
  "admin.local@mobel-unique.test";
const ADMIN_PASSWORD =
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_PASSWORD ??
  "mobel-unique-local-admin-password";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SPEC_0010_ADMIN_FABRICS_SMOKE_TIMEOUT_MS ?? 5000,
);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const PNG_CONTENT_TYPE = "image/png";

function skip(message) {
  console.log(`SKIP SPEC-0010 admin fabrics smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL SPEC-0010 admin fabrics smoke: ${message}`);
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
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or SPEC_0010_ADMIN_FABRICS_SMOKE_ANON_KEY is required.",
    );
  }

  const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

  let response;

  try {
    response = await fetch(tokenUrl, {
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isLocalUrl(SUPABASE_URL) && isConnectionFailure(error)) {
      skip(
        `local Supabase is not reachable at ${SUPABASE_URL}. Run \`pnpm supabase:start\`.`,
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, "Supabase Auth");

  if (!response.ok) {
    fail(
      `local admin login failed with HTTP ${response.status}. Run \`pnpm supabase:reset\` and verify local admin seed credentials.`,
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
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isLocalUrl(WEB_URL) && isConnectionFailure(error)) {
      skip(
        `local web app is not reachable at ${WEB_URL}. Run \`pnpm dev:web\`.`,
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, "trusted device registration");

  if (!response.ok) {
    fail(
      `trusted device registration returned HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  const cookie = response.headers.get("set-cookie");

  if (!cookie?.includes("__Host-mobel_admin_device=")) {
    fail(
      "trusted device registration did not return the trusted device cookie.",
    );
  }

  return cookie.split(";")[0];
}

async function adminRequest(
  accessToken,
  trustedDeviceCookie,
  path,
  init = {},
  options = {},
) {
  const url = `${WEB_URL}${path}`;

  let response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: trustedDeviceCookie,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isLocalUrl(WEB_URL) && isConnectionFailure(error)) {
      skip(
        `local web app is not reachable at ${WEB_URL}. Run \`pnpm dev:web\`.`,
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, path);

  if (options.expectedStatus) {
    if (response.status !== options.expectedStatus) {
      fail(
        `${path} returned HTTP ${response.status}; expected ${options.expectedStatus}: ${JSON.stringify(body)}`,
      );
    }

    return body;
  }

  if (!response.ok) {
    fail(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function uploadSignedAsset(upload, bytes, contentType) {
  if (!upload?.signed_upload_url) {
    fail(
      `upload descriptor is missing a signed URL: ${JSON.stringify(upload)}`,
    );
  }

  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", new Blob([bytes], { type: contentType }), "fabric.png");

  let response;

  try {
    response = await fetch(upload.signed_upload_url, {
      body,
      method: "PUT",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (!response.ok) {
    const responseText = await response.text();
    fail(
      `signed upload returned HTTP ${response.status}: ${responseText || "(empty body)"}`,
    );
  }
}

async function createCompletedUpload(
  accessToken,
  trustedDeviceCookie,
  purpose,
) {
  const uploadBody = await adminRequest(
    accessToken,
    trustedDeviceCookie,
    "/api/admin/uploads",
    {
      body: JSON.stringify({
        byte_size: PNG_BYTES.byteLength,
        content_type: PNG_CONTENT_TYPE,
        purpose,
      }),
      method: "POST",
    },
  );
  const upload = uploadBody.data?.upload;

  if (upload?.method !== "signed_upload" || !upload.upload_id) {
    fail(
      `unexpected upload response for ${purpose}: ${JSON.stringify(uploadBody)}`,
    );
  }

  await uploadSignedAsset(upload, PNG_BYTES, PNG_CONTENT_TYPE);

  const completeBody = await adminRequest(
    accessToken,
    trustedDeviceCookie,
    `/api/admin/uploads/${encodeURIComponent(upload.upload_id)}/complete`,
    {
      method: "POST",
    },
  );
  const asset = completeBody.data?.asset;

  if (!asset?.id) {
    fail(
      `upload completion did not return an asset: ${JSON.stringify(completeBody)}`,
    );
  }

  return {
    asset,
    completeBody,
  };
}

function assertNoPrivateLeak(value, label) {
  const serialized = JSON.stringify(value);

  for (const forbiddenText of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "service_role",
    "catalog-private-assets",
    "object_path",
    "provider_key",
    "stack",
  ]) {
    if (serialized.includes(forbiddenText)) {
      fail(`${label} leaked private text: ${forbiddenText}`);
    }
  }
}

const accessToken = await fetchSupabaseAuthToken();
const trustedDeviceCookie = await registerTrustedDevice(accessToken);
const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sofaBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/sofas",
  {
    body: JSON.stringify({
      internal_name: `Smoke Fabric Sofa ${uniqueSuffix}`,
      public_name: `Smoke Fabric Public Sofa ${uniqueSuffix}`,
      tag_ids: [],
    }),
    method: "POST",
  },
);
const sofaId = sofaBody.data?.sofa?.id;

if (!sofaId || sofaBody.data.sofa.lifecycle_state !== "draft") {
  fail(`unexpected sofa creation response: ${JSON.stringify(sofaBody)}`);
}

const swatchUpload = await createCompletedUpload(
  accessToken,
  trustedDeviceCookie,
  "fabric_swatch",
);
const aiReferenceUpload = await createCompletedUpload(
  accessToken,
  trustedDeviceCookie,
  "fabric_ai_reference",
);

const fabricBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabrics",
  {
    body: JSON.stringify({
      ai_reference_asset_id: aiReferenceUpload.asset.id,
      internal_name: `Smoke Fabric ${uniqueSuffix}`,
      is_premium: false,
      public_name: `Smoke Public Fabric ${uniqueSuffix}`,
      swatch_asset_id: swatchUpload.asset.id,
    }),
    method: "POST",
  },
);
const fabricId = fabricBody.data?.fabric?.id;

if (!fabricId || fabricBody.data.fabric.lifecycle_state !== "active") {
  fail(`unexpected fabric creation response: ${JSON.stringify(fabricBody)}`);
}

const getFabricBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/fabrics/${fabricId}`,
);

if (getFabricBody.data?.fabric?.id !== fabricId) {
  fail(
    `created fabric could not be retrieved: ${JSON.stringify(getFabricBody)}`,
  );
}

const listFabricsBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabrics",
);

if (!listFabricsBody.data?.fabrics?.some((fabric) => fabric.id === fabricId)) {
  fail("created fabric was not present in the admin fabric list.");
}

const assignBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofaId}/fabrics/${fabricId}`,
  {
    body: JSON.stringify({
      public_order: 1,
    }),
    method: "PUT",
  },
);

if (assignBody.data?.sofa_fabric?.public_order !== 1) {
  fail(
    `unexpected sofa fabric assignment response: ${JSON.stringify(assignBody)}`,
  );
}

const sofaFabricsBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofaId}/fabrics`,
);

if (
  !sofaFabricsBody.data?.sofa_fabrics?.some(
    (assignment) =>
      assignment.fabric_id === fabricId && assignment.public_order === 1,
  )
) {
  fail("assigned fabric was not present in the sofa fabric list.");
}

const readinessBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofaId}/publication-readiness`,
);

if (
  readinessBody.data?.readiness?.errors?.some(
    (error) => error.code === "MISSING_PUBLIC_FABRIC",
  )
) {
  fail(
    `readiness still reports MISSING_PUBLIC_FABRIC after assignment: ${JSON.stringify(readinessBody)}`,
  );
}

const archiveBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/fabrics/${fabricId}/archive`,
  {
    method: "POST",
  },
);

if (archiveBody.data?.fabric?.lifecycle_state !== "archived") {
  fail(`fabric archive did not persist: ${JSON.stringify(archiveBody)}`);
}

const archivedListBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabrics",
);

if (
  !archivedListBody.data?.fabrics?.some(
    (fabric) => fabric.id === fabricId && fabric.lifecycle_state === "archived",
  )
) {
  fail("archived fabric was not visible in the admin fabric list.");
}

const secondSofaBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/sofas",
  {
    body: JSON.stringify({
      internal_name: `Smoke Archived Fabric Sofa ${uniqueSuffix}`,
      tag_ids: [],
    }),
    method: "POST",
  },
);
const secondSofaId = secondSofaBody.data?.sofa?.id;

if (!secondSofaId) {
  fail(
    `unexpected second sofa creation response: ${JSON.stringify(secondSofaBody)}`,
  );
}

const archivedAssignBody = await adminRequest(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${secondSofaId}/fabrics/${fabricId}`,
  {
    body: JSON.stringify({
      public_order: 1,
    }),
    method: "PUT",
  },
  {
    expectedStatus: 409,
  },
);

if (archivedAssignBody.error?.code !== "FABRIC_ARCHIVED") {
  fail(
    `archived fabric assignment returned the wrong error: ${JSON.stringify(archivedAssignBody)}`,
  );
}

for (const [label, body] of [
  ["sofa", sofaBody],
  ["swatch complete", swatchUpload.completeBody],
  ["AI reference complete", aiReferenceUpload.completeBody],
  ["fabric", fabricBody],
  ["get fabric", getFabricBody],
  ["list fabrics", listFabricsBody],
  ["assign fabric", assignBody],
  ["list sofa fabrics", sofaFabricsBody],
  ["readiness", readinessBody],
  ["archive", archiveBody],
  ["archived list", archivedListBody],
  ["second sofa", secondSofaBody],
  ["archived assign", archivedAssignBody],
]) {
  assertNoPrivateLeak(body, label);
}

console.log(
  "PASS SPEC-0010 admin fabrics smoke: created, assigned, readiness-checked, and archived a fabric",
);
