#!/usr/bin/env node

const SUPABASE_URL =
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "http://127.0.0.1:54321";
const WEB_URL =
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_WEB_URL ??
  "http://127.0.0.1:3000";
const ANON_KEY =
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL =
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_EMAIL ??
  "admin.local@mobel-unique.test";
const ADMIN_PASSWORD =
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_PASSWORD ??
  "mobel-unique-local-admin-password";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SPEC_0010_ADMIN_RENDER_PREP_SMOKE_TIMEOUT_MS ?? 5000,
);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const PNG_CONTENT_TYPE = "image/png";

function skip(message) {
  console.log(`SKIP SPEC-0010 admin render prep smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL SPEC-0010 admin render prep smoke: ${message}`);
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

async function requestJson(url, init, label) {
  let response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      (isLocalUrl(WEB_URL) || isLocalUrl(SUPABASE_URL)) &&
      isConnectionFailure(error)
    ) {
      skip(
        `local services are not reachable. Run \`pnpm supabase:start\` and \`pnpm dev:web\`.`,
      );
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, label);

  if (!response.ok) {
    fail(`${label} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return {
    body,
    response,
  };
}

async function fetchSupabaseAuthToken() {
  if (!ANON_KEY) {
    skip(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or SPEC_0010_ADMIN_RENDER_PREP_SMOKE_ANON_KEY is required.",
    );
  }

  const { body } = await requestJson(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
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
    },
    "Supabase Auth",
  );

  if (
    !body.access_token ||
    body.user?.app_metadata?.mobel_unique?.role !== "admin"
  ) {
    fail("local admin login did not return the server-controlled admin claim.");
  }

  return body.access_token;
}

async function registerTrustedDevice(accessToken) {
  const { response } = await requestJson(
    `${WEB_URL}/api/admin/trusted-device`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    },
    "trusted device registration",
  );
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  const cookie = cookieHeader.split(";")[0];

  if (!cookie.startsWith("__Host-mobel_admin_device=")) {
    fail("trusted device registration did not return an admin device cookie.");
  }

  return cookie;
}

async function adminJson(accessToken, trustedDeviceCookie, path, init = {}) {
  const { body } = await requestJson(
    `${WEB_URL}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: trustedDeviceCookie,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    },
    path,
  );

  return body.data ?? {};
}

async function uploadAdminAsset({
  accessToken,
  trustedDeviceCookie,
  purpose,
  extraPayload = {},
}) {
  const { upload } = await adminJson(
    accessToken,
    trustedDeviceCookie,
    "/api/admin/uploads",
    {
      body: JSON.stringify({
        byte_size: PNG_BYTES.byteLength,
        content_type: PNG_CONTENT_TYPE,
        purpose,
        ...extraPayload,
      }),
      method: "POST",
    },
  );

  if (!upload?.signed_upload_url || !upload.upload_id) {
    fail(`upload descriptor is incomplete for ${purpose}`);
  }

  const uploadResponse = await fetch(upload.signed_upload_url, {
    body: new Blob([PNG_BYTES], {
      type: PNG_CONTENT_TYPE,
    }),
    method: "PUT",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!uploadResponse.ok) {
    fail(`${purpose} signed upload failed with HTTP ${uploadResponse.status}`);
  }

  const { asset } = await adminJson(
    accessToken,
    trustedDeviceCookie,
    `/api/admin/uploads/${encodeURIComponent(upload.upload_id)}/complete`,
    {
      method: "POST",
    },
  );

  if (!asset?.id) {
    fail(`${purpose} completion did not return an asset.`);
  }

  return asset;
}

const uniqueSuffix = `${Date.now()}`;
const accessToken = await fetchSupabaseAuthToken();
const trustedDeviceCookie = await registerTrustedDevice(accessToken);

const swatchAsset = await uploadAdminAsset({
  accessToken,
  purpose: "fabric_swatch",
  trustedDeviceCookie,
});
const aiReferenceAsset = await uploadAdminAsset({
  accessToken,
  purpose: "fabric_ai_reference",
  trustedDeviceCookie,
});
const { fabric } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabrics",
  {
    body: JSON.stringify({
      ai_reference_asset_id: aiReferenceAsset.id,
      internal_name: `Render prep fabric ${uniqueSuffix}`,
      is_premium: false,
      public_name: `Render prep fabric ${uniqueSuffix}`,
      swatch_asset_id: swatchAsset.id,
    }),
    method: "POST",
  },
);
const { sofa } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/sofas",
  {
    body: JSON.stringify({
      internal_name: `Render prep sofa ${uniqueSuffix}`,
      tag_ids: [],
    }),
    method: "POST",
  },
);

await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofa.id}/fabrics/${fabric.id}`,
  {
    body: JSON.stringify({
      public_order: 1,
    }),
    method: "PUT",
  },
);

const { visual_matrix_column: visualMatrixColumn } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofa.id}/visual-matrix-columns`,
  {
    body: JSON.stringify({
      admin_label: "Smoke front",
      public_label: "Front",
      sequence: 1,
    }),
    method: "POST",
  },
);

await uploadAdminAsset({
  accessToken,
  extraPayload: {
    original_fabric_id: fabric.id,
    sofa_id: sofa.id,
    visual_matrix_column_id: visualMatrixColumn.id,
  },
  purpose: "sofa_source_photo",
  trustedDeviceCookie,
});

const { render_coverage: renderCoverage } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofa.id}/render-coverage`,
);

const renderCell = renderCoverage?.render_cells?.find(
  (cell) =>
    cell.fabric_id === fabric.id &&
    cell.visual_matrix_column_id === visualMatrixColumn.id,
);

if (!renderCell?.can_generate_initial) {
  fail(`render cell is not eligible: ${JSON.stringify(renderCell)}`);
}

const { fabric_render_job: job } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabric-render-jobs",
  {
    body: JSON.stringify({
      fabric_id: fabric.id,
      generation_mode: "initial",
      prompt_note: null,
      sofa_id: sofa.id,
      visual_matrix_column_id: visualMatrixColumn.id,
    }),
    method: "POST",
  },
);

if (!job?.id || job.status !== "queued") {
  fail(`fabric render job was not queued: ${JSON.stringify(job)}`);
}

console.log(
  `PASS SPEC-0010 admin render prep smoke: queued render job ${job.id} for sofa ${sofa.id}`,
);
