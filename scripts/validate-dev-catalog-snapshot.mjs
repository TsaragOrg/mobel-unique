import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SNAPSHOT_PATH_PREFIX = "supabase/catalog-snapshots/dev/";

export const ALLOWED_PUBLIC_TABLES = new Set([
  "fabric_render_candidates",
  "fabric_render_jobs",
  "fabrics",
  "public_tags",
  "sofa_fabrics",
  "sofa_render_cells",
  "sofa_render_exports",
  "sofa_source_photos",
  "sofa_tags",
  "sofas",
  "storage_assets",
  "visual_matrix_columns",
]);

const FORBIDDEN_PATTERNS = [
  /\bauth\./i,
  /\bstorage\./i,
  /\bvault\./i,
  /\badmin_trusted_devices\b/i,
  /\bemail_verification_requests\b/i,
  /\bconsent_records\b/i,
  /\bsimulation_sessions\b/i,
  /\bin_home_simulation_jobs\b/i,
  /\bsimulation_generated_outputs\b/i,
  /\bsimulation_idempotency_keys\b/i,
  /\bsimulation_rate_limits\b/i,
  /\bsimulation_cost_meter\b/i,
  /\bworker_job_events\b/i,
  /\bworker_smoke_jobs\b/i,
  /\bschema_migrations\b/i,
  /\bdrop\s+schema\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\\(?:copy|include|ir|i|o|!)/i,
];

function normalizeRepoPath(path) {
  return relative(process.cwd(), resolve(path)).replace(/\\/g, "/");
}

export function validateSnapshotPath(path) {
  const errors = [];
  const normalized = normalizeRepoPath(path);

  if (normalized.startsWith("../") || normalized === "..") {
    errors.push("snapshot path must stay inside the repository");
  }

  if (!normalized.startsWith(SNAPSHOT_PATH_PREFIX)) {
    errors.push(`snapshot path must be under ${SNAPSHOT_PATH_PREFIX}`);
  }

  if (!normalized.endsWith(".sql")) {
    errors.push("snapshot path must point to a .sql file");
  }

  return errors;
}

export function validateSnapshotText(text, path) {
  const errors = [...validateSnapshotPath(path)];

  if (!text.includes("-- Mobel Unique DEV catalog snapshot")) {
    errors.push("snapshot marker header is missing");
  }

  if (!/\bbegin\s*;/i.test(text) || !/\bcommit\s*;/i.test(text)) {
    errors.push("snapshot must wrap changes in an explicit transaction");
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`snapshot contains forbidden SQL pattern: ${pattern}`);
    }
  }

  const publicRefs = [...text.matchAll(/\bpublic\.([a-z_][a-z0-9_]*)\b/gi)].map(
    (match) => match[1],
  );
  const blockedPublicRefs = [
    ...new Set(publicRefs.filter((table) => !ALLOWED_PUBLIC_TABLES.has(table))),
  ].sort();

  if (blockedPublicRefs.length > 0) {
    errors.push(
      `snapshot references public tables outside the catalog scope: ${blockedPublicRefs.join(
        ", ",
      )}`,
    );
  }

  return errors;
}

export function validateSnapshotFile(path) {
  const errors = validateSnapshotPath(path);

  if (!existsSync(path)) {
    errors.push(`snapshot file does not exist: ${path}`);
    return errors;
  }

  return [...errors, ...validateSnapshotText(readFileSync(path, "utf8"), path)];
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Usage: node scripts/validate-dev-catalog-snapshot.mjs <path>",
    );
    process.exit(1);
  }

  const errors = validateSnapshotFile(path);
  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(`Validated ${path}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
