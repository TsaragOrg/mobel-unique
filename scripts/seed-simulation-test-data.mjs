#!/usr/bin/env node

// SPEC-0015 PLAN-0039 + PLAN-0051 test catalog seed.
//
// Calls the SQL function `public.seed_simulation_test_catalog`
// (added in migration 20260502000800) to upsert a deterministic
// pair of test sofas — one back-wall, one corner-tagged — together
// with a shared fabric, visual matrix columns, and published
// render cells. Idempotent: safe to re-run.
//
// PLAN-0051 extension: when source storage paths are passed via
// `--source-*` flags, the script also copies bytes from those
// existing dev catalog assets into the four `seed/simulation-test/`
// storage paths the test sofas reference. Each upload is idempotent
// (`upsert: true`). When a flag is omitted, the script logs a
// warning and skips that asset, so local seeds against an empty
// bucket still succeed.
//
// Usage:
//   pnpm seed:simulation-test
//   pnpm seed:simulation-test -- --corner-tag shape:corner
//   pnpm seed:simulation-test -- \
//     --source-straight-render-path sofas/<slug>/<file>.png \
//     --source-corner-render-path sofas/<slug>/<file>.png \
//     --source-fabric-swatch-path fabrics/<slug>/swatch.png \
//     --source-fabric-ai-reference-path fabrics/<slug>/ai-reference.png
//
// Required env:
//   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// The service role key is required because the RPC is granted to
// service_role only. The script refuses to talk to a non-local URL
// unless SIMULATION_TEST_SEED_ALLOW_NON_LOCAL=1 is set, mirroring
// the safety on `seed-local-admin-fixtures.mjs`.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

loadEnvFile(resolve(REPO_ROOT, ".env.local"));
loadEnvFile(resolve(REPO_ROOT, ".env"));
loadEnvFile(resolve(REPO_ROOT, "apps/web/.env.local"));
loadEnvFile(resolve(REPO_ROOT, "apps/web/.env"));
loadEnvFile(resolve(REPO_ROOT, "supabase/.env.local"));
loadEnvFile(resolve(REPO_ROOT, "supabase/.env"));

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOW_NON_LOCAL =
  process.env.SIMULATION_TEST_SEED_ALLOW_NON_LOCAL === "1";

const args = parseArgs(process.argv.slice(2));
const cornerTag = args["corner-tag"] ?? "corner";

if (!SERVICE_ROLE_KEY) {
  fail("SUPABASE_SERVICE_ROLE_KEY is required.");
}

if (!ALLOW_NON_LOCAL && !isLocalUrl(SUPABASE_URL)) {
  fail(
    `Refusing to seed non-local Supabase URL ${SUPABASE_URL}. ` +
      "Set SIMULATION_TEST_SEED_ALLOW_NON_LOCAL=1 to override."
  );
}

await callRpc("seed_simulation_test_catalog", {
  corner_tag_slug: cornerTag
});

const STORAGE_COPY_TARGETS = [
  {
    flag: "source-straight-render-path",
    sourceBucket: "catalog-public-assets",
    targetBucket: "catalog-public-assets",
    targetPath: "seed/simulation-test/sofa-straight-render.png",
    label: "Straight sofa render"
  },
  {
    flag: "source-corner-render-path",
    sourceBucket: "catalog-public-assets",
    targetBucket: "catalog-public-assets",
    targetPath: "seed/simulation-test/sofa-corner-render.png",
    label: "Corner sofa render"
  },
  {
    flag: "source-fabric-swatch-path",
    sourceBucket: "catalog-public-assets",
    targetBucket: "catalog-public-assets",
    targetPath: "seed/simulation-test/fabric-swatch.png",
    label: "Fabric swatch"
  },
  {
    flag: "source-fabric-ai-reference-path",
    sourceBucket: "catalog-private-assets",
    targetBucket: "catalog-private-assets",
    targetPath: "seed/simulation-test/fabric-ai-reference.png",
    label: "Fabric AI reference"
  }
];

const storageResults = [];
for (const target of STORAGE_COPY_TARGETS) {
  const sourcePath = args[target.flag];
  if (!sourcePath || sourcePath === "true") {
    console.warn(
      `WARN ${target.label}: --${target.flag} not provided; skipping copy. ` +
        `Target ${target.targetBucket}/${target.targetPath} will remain unset.`
    );
    storageResults.push(`  - ${target.label}: skipped`);
    continue;
  }

  await copyStorageObject({
    sourceBucket: target.sourceBucket,
    sourcePath,
    targetBucket: target.targetBucket,
    targetPath: target.targetPath
  });
  storageResults.push(
    `  - ${target.label}: ${target.sourceBucket}/${sourcePath} -> ` +
      `${target.targetBucket}/${target.targetPath}`
  );
}

console.log(
  [
    "PASS simulation test catalog seed",
    `Supabase: ${SUPABASE_URL}`,
    `Corner tag slug: ${cornerTag}`,
    "Two sofas seeded:",
    "  - simulation-test-straight (back_wall)",
    "  - simulation-test-corner (corner-tagged)",
    "Storage copies:",
    ...storageResults
  ].join("\n")
);

async function copyStorageObject({
  sourceBucket,
  sourcePath,
  targetBucket,
  targetPath
}) {
  const sourceUrl =
    `${SUPABASE_URL}/storage/v1/object/${sourceBucket}/${sourcePath}`;
  const downloadResponse = await fetch(sourceUrl, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY
    }
  });
  if (!downloadResponse.ok) {
    const text = await downloadResponse.text();
    fail(
      `download ${sourceBucket}/${sourcePath} failed: ` +
        `HTTP ${downloadResponse.status} ${text}`
    );
  }
  const contentType =
    downloadResponse.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await downloadResponse.arrayBuffer());

  const uploadUrl =
    `${SUPABASE_URL}/storage/v1/object/${targetBucket}/${targetPath}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: bytes,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true"
    }
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    fail(
      `upload ${targetBucket}/${targetPath} failed: ` +
        `HTTP ${uploadResponse.status} ${text}`
    );
  }
}

function parseArgs(rawArgs) {
  const out = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rawArgs[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function isLocalUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function callRpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY
    }
  });
  if (!response.ok) {
    const text = await response.text();
    fail(`${name} rpc failed: HTTP ${response.status} ${text}`);
  }
}
