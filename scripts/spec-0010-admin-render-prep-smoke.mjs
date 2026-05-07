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
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4XgEFAPr/AP////8J+wP9ecBupQAAACt0RVh0Q3JlYXRpb24gVGltZQBUaHUsIDA3IE1heSAyMDI2IDA5OjUyOjU1IEdNVMGQOCMAAAAtdEVYdFNvZnR3YXJlAGdpdGh1Yi5jb20vbWF0bWVuL0ltYWdlU2NyaXB0IHYxLjMuMW/Br2AAAAAASUVORK5CYII=",
  "base64",
);
const PNG_CONTENT_TYPE = "image/png";
const ADMIN_PREVIEW_VARIANTS = [
  { query: "variant=small", variant: "small" },
  { query: "variant=medium", variant: "medium" },
  { query: "variant=original", variant: "original" },
];

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

async function requestJson(url, init, label, options = {}) {
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

  if (!response.ok && !options.allowError) {
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

async function adminJsonResponse(
  accessToken,
  trustedDeviceCookie,
  path,
  init = {},
) {
  const { body, response } = await requestJson(
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
    {
      allowError: true,
    },
  );

  return {
    body,
    response,
  };
}

async function assertProtectedPreviewVariants(
  accessToken,
  trustedDeviceCookie,
  assetId,
  label,
) {
  for (const { query, variant } of ADMIN_PREVIEW_VARIANTS) {
    let response;

    try {
      response = await fetch(
        `${WEB_URL}/api/admin/storage-assets/${encodeURIComponent(
          assetId,
        )}/preview?${query}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Cookie: trustedDeviceCookie,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
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

    if (!response.ok) {
      fail(
        `${label} ${variant} preview returned HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.startsWith("image/")) {
      fail(`${label} ${variant} preview did not return image bytes.`);
    }
  }
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

async function createSmokeFabric(label) {
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
        internal_name: `Render prep ${label} fabric ${uniqueSuffix}`,
        is_premium: false,
        public_name: `Render prep ${label} fabric ${uniqueSuffix}`,
        swatch_asset_id: swatchAsset.id,
      }),
      method: "POST",
    },
  );

  if (!fabric?.id) {
    fail(`fabric creation failed for ${label}: ${JSON.stringify(fabric)}`);
  }

  return fabric;
}

const sourceFabric = await createSmokeFabric("source");
const targetFabric = await createSmokeFabric("target");
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
  `/api/admin/sofas/${sofa.id}/fabrics/${sourceFabric.id}`,
  {
    body: JSON.stringify({
      public_order: 1,
    }),
    method: "PUT",
  },
);
await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofa.id}/fabrics/${targetFabric.id}`,
  {
    body: JSON.stringify({
      public_order: 2,
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

const sourcePhotoAsset = await uploadAdminAsset({
  accessToken,
  extraPayload: {
    original_fabric_id: sourceFabric.id,
    sofa_id: sofa.id,
    visual_matrix_column_id: visualMatrixColumn.id,
  },
  purpose: "sofa_source_photo",
  trustedDeviceCookie,
});
await assertProtectedPreviewVariants(
  accessToken,
  trustedDeviceCookie,
  sourcePhotoAsset.id,
  "source photo",
);

const { render_coverage: renderCoverage } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/sofas/${sofa.id}/render-coverage`,
);

const renderCell = renderCoverage?.render_cells?.find(
  (cell) =>
    cell.fabric_id === targetFabric.id &&
    cell.visual_matrix_column_id === visualMatrixColumn.id,
);
const sourceRenderCell = renderCoverage?.render_cells?.find(
  (cell) =>
    cell.fabric_id === sourceFabric.id &&
    cell.visual_matrix_column_id === visualMatrixColumn.id,
);

if (
  !sourceRenderCell?.has_private_render ||
  sourceRenderCell.source_type !== "source_photo" ||
  sourceRenderCell.can_generate_initial
) {
  fail(
    `source fabric cell is not complete from source photo: ${JSON.stringify(sourceRenderCell)}`,
  );
}

const sourceJobAttempt = await adminJsonResponse(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabric-render-jobs",
  {
    body: JSON.stringify({
      fabric_id: sourceFabric.id,
      generation_mode: "initial",
      prompt_note: null,
      sofa_id: sofa.id,
      visual_matrix_column_id: visualMatrixColumn.id,
    }),
    method: "POST",
  },
);

if (
  sourceJobAttempt.response.status !== 422 ||
  sourceJobAttempt.body?.error?.code !== "FABRIC_RENDER_JOB_CONFLICT"
) {
  fail(
    `source fabric generation was not rejected: HTTP ${sourceJobAttempt.response.status} ${JSON.stringify(sourceJobAttempt.body)}`,
  );
}

if (!renderCell?.can_generate_initial) {
  fail(`target render cell is not eligible: ${JSON.stringify(renderCell)}`);
}

const { fabric_render_job: job } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  "/api/admin/fabric-render-jobs",
  {
    body: JSON.stringify({
      fabric_id: targetFabric.id,
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

const { render_candidates: candidates } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/render-cells/${renderCell.id}/candidates`,
);

if (!Array.isArray(candidates) || candidates.length === 0) {
  fail(
    `render cell ${renderCell.id} has no generated candidates. Run the fabric render worker before this smoke.`,
  );
}

const candidate = candidates[0];

if (!candidate?.id || !candidate.preview_url) {
  fail(`render candidate is incomplete: ${JSON.stringify(candidate)}`);
}
await assertProtectedPreviewVariants(
  accessToken,
  trustedDeviceCookie,
  candidate.asset_id,
  "render candidate",
);

const { render_candidate: selectedCandidate } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/render-candidates/${candidate.id}/use-as-current`,
  {
    method: "POST",
  },
);

if (!selectedCandidate?.is_current) {
  fail(
    `render candidate was not selected: ${JSON.stringify(selectedCandidate)}`,
  );
}

const manualRenderAsset = await uploadAdminAsset({
  accessToken,
  extraPayload: {
    render_cell_id: renderCell.id,
  },
  purpose: "manual_render",
  trustedDeviceCookie,
});
await assertProtectedPreviewVariants(
  accessToken,
  trustedDeviceCookie,
  manualRenderAsset.id,
  "manual render",
);

const { render_cell: manualRenderCell } = await adminJson(
  accessToken,
  trustedDeviceCookie,
  `/api/admin/render-cells/${renderCell.id}/manual-render`,
  {
    body: JSON.stringify({
      asset_id: manualRenderAsset.id,
    }),
    method: "POST",
  },
);

if (
  manualRenderCell?.current_private_asset_id !== manualRenderAsset.id ||
  manualRenderCell.current_public_asset_id !== null ||
  manualRenderCell.source_type !== "manual_upload"
) {
  fail(
    `manual render was not attached privately: ${JSON.stringify(manualRenderCell)}`,
  );
}

console.log(
  `PASS SPEC-0010 admin render prep smoke: source cell ${sourceRenderCell.id} blocked, selected candidate ${candidate.id}, manual render ${manualRenderAsset.id}, and preview variants small, medium, original for sofa ${sofa.id}`,
);
