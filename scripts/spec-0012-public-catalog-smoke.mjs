#!/usr/bin/env node

const WEB_URL =
  process.env.SPEC_0012_PUBLIC_CATALOG_SMOKE_WEB_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  "http://127.0.0.1:3000";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SPEC_0012_PUBLIC_CATALOG_SMOKE_TIMEOUT_MS ?? 5000,
);

function skip(message) {
  console.log(`SKIP SPEC-0012 public catalog smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL SPEC-0012 public catalog smoke: ${message}`);
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

async function publicRequest(path) {
  const url = `${WEB_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isLocalUrl(WEB_URL) && isConnectionFailure(error)) {
      skip(`local web app is not reachable at ${WEB_URL}. Run \`pnpm dev:web\`.`);
    }

    fail(error instanceof Error ? error.message : String(error));
  }

  const body = await readJsonResponse(response, path);

  if (!response.ok) {
    fail(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function readJsonResponse(response, label) {
  const responseText = await response.text();

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    fail(`${label} returned non-JSON response: ${responseText}`);
  }
}

function assertNoPrivateLeak(value, label) {
  const serialized = JSON.stringify(value);

  for (const forbiddenText of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "service_role",
    "catalog-private-assets",
    "provider_key",
    "private_render",
    "render_cell_id",
    "object_path",
    "stack",
    "internal_name",
  ]) {
    if (serialized.includes(forbiddenText)) {
      fail(`${label} leaked private text: ${forbiddenText}`);
    }
  }
}

const tagsBody = await publicRequest("/api/public/catalog/tags");
assertNoPrivateLeak(tagsBody, "catalog tags");

if (!Array.isArray(tagsBody.data?.items)) {
  fail(`unexpected tag response: ${JSON.stringify(tagsBody)}`);
}

const catalogBody = await publicRequest("/api/public/catalog?limit=1");
assertNoPrivateLeak(catalogBody, "catalog");

const catalogItems = catalogBody.data?.items;

if (!Array.isArray(catalogItems)) {
  fail(`unexpected catalog response: ${JSON.stringify(catalogBody)}`);
}

if (catalogItems.length === 0) {
  skip(
    "no published public-usable sofa fixture exists yet. Seed or publish a sofa before running this smoke end to end.",
  );
}

const firstItem = catalogItems[0];

for (const requiredField of [
  "id",
  "public_slug",
  "public_name",
  "default_fabric_id",
  "default_visual_position_id",
  "default_render_medium_content_type",
  "default_render_medium_url",
  "default_render_url",
]) {
  if (!firstItem?.[requiredField]) {
    fail(`catalog item is missing ${requiredField}: ${JSON.stringify(firstItem)}`);
  }
}

if (firstItem.default_render_url !== firstItem.default_render_medium_url) {
  fail(
    `catalog default render compatibility alias does not point at medium delivery: ${JSON.stringify(firstItem)}`,
  );
}

if (
  !String(firstItem.default_render_medium_url).includes(
    "/storage/v1/object/public/",
  )
) {
  fail(
    `catalog medium render is not a public storage URL: ${JSON.stringify(firstItem)}`,
  );
}

if (catalogBody.data.next_cursor) {
  const nextPageBody = await publicRequest(
    `/api/public/catalog?limit=1&cursor=${encodeURIComponent(catalogBody.data.next_cursor)}`,
  );
  assertNoPrivateLeak(nextPageBody, "catalog next page");

  if (
    nextPageBody.data?.items?.some((item) => item.id === firstItem.id)
  ) {
    fail("catalog pagination returned a duplicate sofa on the next page.");
  }
}

const sofaBody = await publicRequest(
  `/api/public/sofas/${encodeURIComponent(firstItem.public_slug)}`,
);
assertNoPrivateLeak(sofaBody, "sofa detail");

if (sofaBody.data?.sofa?.public_slug !== firstItem.public_slug) {
  fail(`sofa detail did not match catalog slug: ${JSON.stringify(sofaBody)}`);
}

if (
  !sofaBody.data?.defaults?.fabric_id ||
  !sofaBody.data?.defaults?.visual_position_id ||
  !Array.isArray(sofaBody.data?.fabrics) ||
  !Array.isArray(sofaBody.data?.visual_positions) ||
  !Array.isArray(sofaBody.data?.renders) ||
  sofaBody.data.fabrics.length === 0 ||
  sofaBody.data.visual_positions.length === 0 ||
  sofaBody.data.renders.length === 0
) {
  fail(`sofa detail is missing public selection state: ${JSON.stringify(sofaBody)}`);
}

const defaultDetailRender = sofaBody.data.renders.find(
  (render) =>
    render.fabric_id === sofaBody.data.defaults.fabric_id &&
    render.visual_position_id === sofaBody.data.defaults.visual_position_id,
);

if (
  !defaultDetailRender?.render_original_url ||
  !defaultDetailRender.render_original_content_type
) {
  fail(
    `sofa detail default render is missing original delivery fields: ${JSON.stringify(sofaBody)}`,
  );
}

if (defaultDetailRender.render_url !== defaultDetailRender.render_original_url) {
  fail(
    `sofa detail render compatibility alias does not point at original delivery: ${JSON.stringify(defaultDetailRender)}`,
  );
}

if (
  !String(defaultDetailRender.render_original_url).includes(
    "/storage/v1/object/public/",
  )
) {
  fail(
    `sofa detail original render is not a public storage URL: ${JSON.stringify(defaultDetailRender)}`,
  );
}

console.log(
  `PASS SPEC-0012 public catalog smoke: read medium catalog render and original sofa detail render for ${firstItem.public_slug}`,
);
