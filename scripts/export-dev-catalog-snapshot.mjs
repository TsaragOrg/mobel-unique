import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { validateSnapshotText } from "./validate-dev-catalog-snapshot.mjs";

export const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const DEFAULT_OUTPUT_PATH =
  "supabase/catalog-snapshots/dev/catalog-data.sql";

export const CATALOG_STORAGE_ASSET_KINDS = [
  "fabric_ai_reference",
  "fabric_render_candidate",
  "fabric_render_candidate_variant",
  "fabric_render_private",
  "fabric_swatch_public",
  "fabric_swatch_public_variant",
  "manual_render",
  "manual_render_variant",
  "published_sofa_render",
  "published_sofa_render_variant",
  "sofa_source_photo",
  "sofa_source_photo_variant",
];

export const CATALOG_TABLES = [
  {
    name: "storage_assets",
    orderBy: "id",
    where: `asset_kind in (${CATALOG_STORAGE_ASSET_KINDS.map(sqlString).join(
      ", ",
    )})`,
    columns: [
      "id",
      "bucket_id",
      "object_path",
      "visibility",
      "lifecycle_state",
      "asset_kind",
      "content_type",
      "byte_size",
      "width_px",
      "height_px",
      "checksum_sha256",
      "created_at",
      "deleted_at",
      "purged_at",
    ],
  },
  {
    name: "storage_asset_variants",
    orderBy: "original_asset_id, variant_kind",
    columns: [
      "original_asset_id",
      "variant_kind",
      "variant_asset_id",
      "generation_kind",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "public_tags",
    orderBy: "id",
    columns: ["id", "public_label", "slug", "created_at", "updated_at"],
  },
  {
    name: "fabrics",
    orderBy: "id",
    columns: [
      "id",
      "lifecycle_state",
      "internal_name",
      "public_name",
      "swatch_asset_id",
      "ai_reference_asset_id",
      "is_premium",
      "archived_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "sofas",
    orderBy: "id",
    columns: [
      "id",
      "lifecycle_state",
      "internal_name",
      "public_name",
      "public_slug",
      "shopify_order_url",
      "public_description",
      "length_cm",
      "depth_cm",
      "height_cm",
      "footprint_type",
      "footprint_measurements",
      "manual_public_order",
      "first_published_at",
      "published_at",
      "archived_at",
      "created_at",
      "updated_at",
    ],
    jsonbColumns: ["footprint_measurements"],
  },
  {
    name: "sofa_fabrics",
    orderBy: "sofa_id, fabric_id",
    columns: [
      "sofa_id",
      "fabric_id",
      "public_order",
      "assigned_at",
      "updated_at",
    ],
  },
  {
    name: "sofa_tags",
    orderBy: "sofa_id, tag_id",
    columns: ["sofa_id", "tag_id", "created_at"],
  },
  {
    name: "visual_matrix_columns",
    orderBy: "id",
    columns: [
      "id",
      "sofa_id",
      "sequence",
      "admin_label",
      "public_label",
      "current_source_photo_id",
      "deleted_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "sofa_source_photos",
    orderBy: "id",
    columns: [
      "id",
      "sofa_id",
      "visual_matrix_column_id",
      "original_fabric_id",
      "asset_id",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "sofa_render_cells",
    orderBy: "id",
    columns: [
      "id",
      "sofa_id",
      "fabric_id",
      "visual_matrix_column_id",
      "current_private_asset_id",
      "current_public_asset_id",
      "source_type",
      "source_photo_id",
      "accepted_fabric_render_candidate_id",
      "updated_at",
    ],
  },
  {
    name: "fabric_render_jobs",
    orderBy: "id",
    columns: [
      "id",
      "sofa_id",
      "fabric_id",
      "visual_matrix_column_id",
      "render_cell_id",
      "generation_mode",
      "target_sofa_asset_id",
      "fabric_ai_reference_asset_id",
      "refinement_source_asset_id",
      "prompt_note",
      "provider_name",
      "provider_model",
      "prompt_version",
      "status",
      "attempt_count",
      "max_attempts",
      "queued_at",
      "claimed_by",
      "claimed_at",
      "claim_expires_at",
      "last_attempt_started_at",
      "last_error_message",
      "completed_at",
      "created_at",
      "updated_at",
      "refine_prompt",
      "request_id",
    ],
  },
  {
    name: "fabric_render_candidates",
    orderBy: "id",
    columns: [
      "id",
      "job_id",
      "render_cell_id",
      "asset_id",
      "generation_mode",
      "refinement_source_asset_id",
      "provider_name",
      "provider_model",
      "prompt_version",
      "sofa_id",
      "fabric_id",
      "visual_matrix_column_id",
      "accepted_at",
      "created_at",
    ],
  },
  {
    name: "sofa_render_exports",
    orderBy: "id",
    columns: [
      "id",
      "sofa_id",
      "status",
      "asset_id",
      "included_render_count",
      "last_error_message",
      "expires_at",
      "completed_at",
      "created_at",
    ],
  },
];

const INSERT_OVERRIDES = {
  sofa_render_cells: {
    accepted_fabric_render_candidate_id: null,
  },
  visual_matrix_columns: {
    current_source_photo_id: null,
  },
};

const CYCLE_RESTORE_PATCHES = [
  {
    table: "visual_matrix_columns",
    keyColumn: "id",
    column: "current_source_photo_id",
    type: "uuid",
  },
  {
    table: "sofa_render_cells",
    keyColumn: "id",
    column: "accepted_fabric_render_candidate_id",
    type: "uuid",
  },
];

const DELETE_SQL = [
  "update public.sofa_render_cells set accepted_fabric_render_candidate_id = null where accepted_fabric_render_candidate_id is not null;",
  "update public.visual_matrix_columns set current_source_photo_id = null where current_source_photo_id is not null;",
  "delete from public.fabric_render_candidates;",
  "delete from public.fabric_render_jobs;",
  "delete from public.sofa_render_exports;",
  "delete from public.sofa_render_cells;",
  "delete from public.sofa_source_photos;",
  "delete from public.visual_matrix_columns;",
  "delete from public.sofa_fabrics;",
  "delete from public.sofa_tags;",
  "delete from public.sofas;",
  "delete from public.fabrics;",
  "delete from public.public_tags;",
  "delete from public.storage_asset_variants;",
  `delete from public.storage_assets where asset_kind in (${CATALOG_STORAGE_ASSET_KINDS.map(
    sqlString,
  ).join(", ")});`,
];

function usage() {
  return `Usage: node scripts/export-dev-catalog-snapshot.mjs [options]

Options:
  --database-url <url>       Local Postgres connection URL.
  --output <path>            Snapshot output path.
  --allow-non-local-source   Allow exporting from a non-local database URL.
  --help                     Show this help.
`;
}

function parseArgs(argv) {
  const options = {
    databaseUrl:
      process.env.LOCAL_DATABASE_URL ??
      process.env.SUPABASE_LOCAL_DB_URL ??
      DEFAULT_LOCAL_DATABASE_URL,
    output: DEFAULT_OUTPUT_PATH,
    allowNonLocalSource: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--database-url") {
      options.databaseUrl = argv[++index];
    } else if (arg === "--output") {
      options.output = argv[++index];
    } else if (arg === "--allow-non-local-source") {
      options.allowNonLocalSource = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function assertLocalDatabaseUrl(databaseUrl, allowNonLocalSource) {
  if (allowNonLocalSource) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("The database URL is invalid.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      "Refusing to export from a non-local database URL. Pass --allow-non-local-source only for an intentional one-off export.",
    );
  }
}

function assertIdentifier(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(value, column, table) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric value for ${table.name}.${column}`);
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    if (!table.jsonbColumns?.includes(column)) {
      throw new Error(`Unexpected object value for ${table.name}.${column}`);
    }

    return `${sqlString(JSON.stringify(value))}::jsonb`;
  }

  return sqlString(value);
}

function psqlJson(databaseUrl, query) {
  const stdout = execFileSync(
    "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-Atc", query, databaseUrl],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 64,
    },
  ).trim();

  return JSON.parse(stdout || "[]");
}

function selectRows(databaseUrl, table) {
  assertIdentifier(table.name);
  for (const column of table.columns) {
    assertIdentifier(column);
  }

  const query = `
    select coalesce(json_agg(row_to_json(snapshot_rows)), '[]'::json)
    from (
      select ${table.columns.join(", ")}
      from public.${table.name}
      where ${table.where ?? "true"}
      order by ${table.orderBy}
    ) as snapshot_rows;
  `;

  return psqlJson(databaseUrl, query);
}

function insertStatement(table, rows) {
  if (rows.length === 0) {
    return `-- ${table.name}: 0 rows`;
  }

  const overrides = INSERT_OVERRIDES[table.name] ?? {};
  const values = rows
    .map((row) => {
      const rowValues = table.columns.map((column) =>
        sqlValue(
          Object.hasOwn(overrides, column) ? overrides[column] : row[column],
          column,
          table,
        ),
      );

      return `  (${rowValues.join(", ")})`;
    })
    .join(",\n");

  return `insert into public.${table.name} (${table.columns.join(", ")}) values\n${values};`;
}

function restoreCycleStatement(patch, rows) {
  const patchRows = rows.filter((row) => row[patch.column] !== null);

  if (patchRows.length === 0) {
    return `-- ${patch.table}.${patch.column}: 0 rows to restore`;
  }

  const values = patchRows
    .map(
      (row) =>
        `  (${sqlValue(row[patch.keyColumn], patch.keyColumn, {
          name: patch.table,
        })}::uuid, ${sqlValue(row[patch.column], patch.column, {
          name: patch.table,
        })}::${patch.type})`,
    )
    .join(",\n");

  return `update public.${patch.table} as target
set ${patch.column} = source.${patch.column}
from (
  values
${values}
) as source(${patch.keyColumn}, ${patch.column})
where target.${patch.keyColumn} = source.${patch.keyColumn};`;
}

export function generateSnapshotSql(
  rowsByTable,
  generatedAt = new Date(),
  snapshotPath = DEFAULT_OUTPUT_PATH,
) {
  const lines = [
    "-- Mobel Unique DEV catalog snapshot",
    `-- Generated at: ${generatedAt.toISOString()}`,
    "-- Generated by: scripts/export-dev-catalog-snapshot.mjs",
    "-- Snapshot scope: catalog-only public tables for sofas, fabrics, public tags, view columns, source photos, render cells, render jobs, render candidates, render exports, and catalog storage asset metadata.",
    "-- Excluded scope: auth accounts, trusted admin devices, visitor email and simulation data, rate limits, cost meters, worker event logs, storage object metadata, and storage object bytes.",
    "-- Storage note: this SQL contains asset metadata only. Matching bucket objects must already exist in DEV storage or be synchronized separately.",
    "",
    "begin;",
    "set local lock_timeout = '10s';",
    "set local statement_timeout = '5min';",
    "",
    "-- Replace the DEV catalog rows without touching auth or admin trust data.",
    ...DELETE_SQL,
    "",
  ];

  for (const table of CATALOG_TABLES) {
    lines.push(insertStatement(table, rowsByTable.get(table.name) ?? []), "");
  }

  for (const patch of CYCLE_RESTORE_PATCHES) {
    lines.push(
      restoreCycleStatement(patch, rowsByTable.get(patch.table) ?? []),
      "",
    );
  }

  lines.push("commit;", "");

  const sql = lines.join("\n");
  const validationErrors = validateSnapshotText(sql, snapshotPath);
  if (validationErrors.length > 0) {
    throw new Error(
      `Generated snapshot failed validation:\n${validationErrors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  return sql;
}

export function exportSnapshot(options) {
  assertLocalDatabaseUrl(options.databaseUrl, options.allowNonLocalSource);

  const rowsByTable = new Map();
  for (const table of CATALOG_TABLES) {
    rowsByTable.set(table.name, selectRows(options.databaseUrl, table));
  }

  const sql = generateSnapshotSql(rowsByTable, new Date(), options.output);
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, sql);

  return [...rowsByTable.entries()].map(([table, rows]) => ({
    table,
    count: rows.length,
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const counts = exportSnapshot(options);
  console.log(`Wrote ${options.output}`);
  for (const { table, count } of counts) {
    console.log(`${table}: ${count}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
