#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.SPEC_0009_SCHEMA_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const EXPLICIT_PSQL_BIN = Boolean(process.env.SPEC_0009_SCHEMA_SMOKE_PSQL);
const PSQL_BIN = process.env.SPEC_0009_SCHEMA_SMOKE_PSQL ?? "psql";
const DOCKER_BIN = process.env.SPEC_0009_SCHEMA_SMOKE_DOCKER ?? "docker";
const DOCKER_DB_URL =
  process.env.SPEC_0009_SCHEMA_SMOKE_DOCKER_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SPEC_0009_SCHEMA_SMOKE_TIMEOUT_MS ?? 10000,
);

const REQUIRED_TABLES = [
  "sofas",
  "public_tags",
  "sofa_tags",
  "storage_assets",
  "fabrics",
  "sofa_fabrics",
  "visual_matrix_columns",
  "sofa_source_photos",
  "sofa_render_cells",
  "fabric_render_jobs",
  "fabric_render_candidates",
  "sofa_render_exports",
  "email_verification_requests",
  "consent_records",
  "simulation_sessions",
  "in_home_simulation_jobs",
  "simulation_generated_outputs",
  "worker_job_events",
];

const REQUIRED_ENUMS = [
  "sofa_lifecycle_state",
  "fabric_lifecycle_state",
  "asset_visibility",
  "asset_lifecycle_state",
  "render_source_type",
  "fabric_render_generation_mode",
  "fabric_render_job_status",
  "simulation_job_status",
  "room_geometry_mode",
  "consent_type",
  "consent_decision",
  "worker_job_type",
];

const REQUIRED_BUCKETS = [
  ["catalog-public-assets", "true"],
  ["catalog-private-assets", "false"],
  ["simulation-private-artifacts", "false"],
];

const REQUIRED_INDEXES = [
  "sofas_public_slug_unique_idx",
  "sofas_public_catalog_order_idx",
  "sofa_render_cells_unique_idx",
  "fabric_render_jobs_status_queued_idx",
  "fabric_render_jobs_claim_expires_idx",
  "in_home_simulation_jobs_status_queued_idx",
  "in_home_simulation_jobs_claim_expires_idx",
  "simulation_generated_outputs_job_index_unique_idx",
];

const REQUIRED_VIEWS = [
  "public_catalog_sofas",
  "public_catalog_tags",
  "public_sofa_tags",
  "public_sofa_fabrics",
  "public_sofa_visual_positions",
  "public_sofa_render_cells",
];

const REQUIRED_FUNCTIONS = [
  "sofa_publication_readiness_errors",
  "spec_0009_expired_simulation_jobs",
  "spec_0009_orphan_room_upload_objects",
  "spec_0009_mark_simulation_job_purged",
  "spec_0009_expired_zip_exports",
  "spec_0009_public_render_assets_for_unavailable_sofas",
];

function values(items) {
  return items.map((item) => `('${item}')`).join(",\n    ");
}

function bucketValues(items) {
  return items
    .map(([bucket, isPublic]) => `('${bucket}', ${isPublic})`)
    .join(",\n    ");
}

const smokeSql = `
begin;

create temp table spec_0009_smoke_failures (
  failure text not null
) on commit drop;

insert into spec_0009_smoke_failures (failure)
with
required_tables(table_name) as (
  values
    ${values(REQUIRED_TABLES)}
),
required_enums(type_name) as (
  values
    ${values(REQUIRED_ENUMS)}
),
required_buckets(bucket_id, is_public) as (
  values
    ${bucketValues(REQUIRED_BUCKETS)}
),
required_indexes(index_name) as (
  values
    ${values(REQUIRED_INDEXES)}
),
required_views(view_name) as (
  values
    ${values(REQUIRED_VIEWS)}
),
required_functions(function_name) as (
  values
    ${values(REQUIRED_FUNCTIONS)}
),
failures as (
  select 'missing table: public.' || table_name as failure
  from required_tables
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = required_tables.table_name
      and c.relkind in ('r', 'p')
  )

  union all

  select 'rls disabled: public.' || table_name
  from required_tables
  where exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = required_tables.table_name
      and c.relkind in ('r', 'p')
      and c.relrowsecurity = false
  )

  union all

  select 'missing enum: public.' || type_name
  from required_enums
  where not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = required_enums.type_name
  )

  union all

  select 'missing bucket: ' || bucket_id
  from required_buckets
  where not exists (
    select 1
    from storage.buckets b
    where b.id = required_buckets.bucket_id
      and b.public = required_buckets.is_public
  )

  union all

  select 'missing index: ' || index_name
  from required_indexes
  where not exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.indexname = required_indexes.index_name
  )

  union all

  select 'missing public read view: public.' || view_name
  from required_views
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = required_views.view_name
      and c.relkind in ('v', 'm')
  )

  union all

  select 'missing helper function: public.' || function_name
  from required_functions
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required_functions.function_name
  )

  union all

  select 'missing slug guard trigger: public.sofas_before_write_trigger'
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sofas'
      and t.tgname = 'sofas_before_write_trigger'
      and not t.tgisinternal
  )

  union all

  select 'missing storage policy: spec_0009_catalog_public_assets_read'
  where not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'spec_0009_catalog_public_assets_read'
  )

  union all

  select 'unsafe direct storage write policy for anon or authenticated role: ' || policyname
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and roles && array['anon', 'authenticated']::name[]
)
select failure
from failures;

insert into public.storage_assets (
  id,
  bucket_id,
  object_path,
  visibility,
  lifecycle_state,
  asset_kind,
  content_type,
  byte_size,
  width_px,
  height_px
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'catalog-public-assets',
    'spec-0009/swatch.png',
    'public',
    'active',
    'fabric_swatch_public',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'catalog-private-assets',
    'spec-0009/ai-reference.png',
    'private',
    'active',
    'fabric_ai_reference',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'catalog-private-assets',
    'spec-0009/render-private.png',
    'private',
    'active',
    'render_private',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'catalog-public-assets',
    'spec-0009/render-public.png',
    'public',
    'active',
    'render_public',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    'catalog-private-assets',
    'spec-0009/prepared-sofa.png',
    'private',
    'active',
    'prepared_sofa_private',
    'image/png',
    10,
    10,
    10
  );

insert into public.sofas (
  id,
  lifecycle_state,
  internal_name,
  public_name,
  shopify_order_url
)
values
  (
    '00000000-0000-4000-8000-000000000201',
    'published',
    'SPEC-0009 Published Sofa',
    'SPEC-0009 Published Sofa',
    'https://shop.example/spec-0009'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'draft',
    'SPEC-0009 Draft Sofa',
    'SPEC-0009 Draft Sofa',
    'https://shop.example/spec-0009-draft'
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'draft',
    'SPEC-0009 Incomplete Sofa',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    'draft',
    'SPEC-0009 Frozen Slug Sofa',
    'SPEC-0009 Frozen Slug Sofa',
    'https://shop.example/spec-0009-frozen'
  );

update public.sofas
set first_published_at = now()
where id = '00000000-0000-4000-8000-000000000204';

insert into public.fabrics (
  id,
  lifecycle_state,
  internal_name,
  public_name,
  swatch_asset_id,
  ai_reference_asset_id,
  is_premium
)
values (
  '00000000-0000-4000-8000-000000000301',
  'active',
  'SPEC-0009 Fabric',
  'SPEC-0009 Fabric',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  false
);

insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000301',
  0
);

insert into public.visual_matrix_columns (id, sofa_id, sequence, admin_label, public_label)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000201',
  1,
  'Front',
  'Front'
);

insert into public.sofa_render_cells (
  id,
  sofa_id,
  fabric_id,
  visual_matrix_column_id,
  current_private_asset_id,
  current_public_asset_id,
  source_type
)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000104',
  'manual_upload'
);

insert into spec_0009_smoke_failures (failure)
select 'publication readiness did not reject an incomplete sofa'
where not (
  'missing_public_name' = any(
    public.sofa_publication_readiness_errors('00000000-0000-4000-8000-000000000203')
  )
);

insert into spec_0009_smoke_failures (failure)
select 'publication readiness rejected a complete public sofa: '
  || array_to_string(
    public.sofa_publication_readiness_errors('00000000-0000-4000-8000-000000000201'),
    ', '
  )
where array_length(
  public.sofa_publication_readiness_errors('00000000-0000-4000-8000-000000000201'),
  1
) is not null;

do $smoke$
begin
  update public.sofas
  set public_slug = 'changed-after-first-publication'
  where id = '00000000-0000-4000-8000-000000000204';

  insert into spec_0009_smoke_failures (failure)
  values ('slug freeze did not reject public_slug changes after first_published_at');
exception
  when check_violation then null;
end;
$smoke$;

insert into spec_0009_smoke_failures (failure)
select 'public catalog view does not expose the published sofa fixture'
where not exists (
  select 1
  from public.public_catalog_sofas
  where id = '00000000-0000-4000-8000-000000000201'
);

insert into spec_0009_smoke_failures (failure)
select 'public catalog view exposes draft sofas'
where exists (
  select 1
  from public.public_catalog_sofas
  where id = '00000000-0000-4000-8000-000000000202'
);

do $smoke$
begin
  insert into public.sofa_render_cells (
    sofa_id,
    fabric_id,
    visual_matrix_column_id,
    current_private_asset_id,
    current_public_asset_id,
    source_type
  )
  values (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000104',
    'manual_upload'
  );

  insert into spec_0009_smoke_failures (failure)
  values ('render cell uniqueness did not reject duplicate sofa/fabric/visual position');
exception
  when unique_violation then null;
end;
$smoke$;

insert into public.email_verification_requests (
  id,
  email_normalized_hash,
  verification_code_hash,
  status,
  expires_at
)
values (
  '00000000-0000-4000-8000-000000000601',
  'email-hash',
  'code-hash',
  'verified',
  now() + interval '15 minutes'
);

insert into public.consent_records (
  id,
  consent_type,
  decision,
  email_normalized_hash,
  wording_version,
  locale,
  source,
  decided_at
)
values (
  '00000000-0000-4000-8000-000000000602',
  'email_verification_required',
  'granted',
  'email-hash',
  'v1',
  'fr-FR',
  'schema-smoke',
  now()
);

insert into public.simulation_sessions (
  id,
  email_verification_request_id,
  email_normalized_hash,
  required_email_consent_record_id,
  access_token_hash,
  status,
  expires_at
)
values (
  '00000000-0000-4000-8000-000000000603',
  '00000000-0000-4000-8000-000000000601',
  'email-hash',
  '00000000-0000-4000-8000-000000000602',
  'access-token-hash',
  'active',
  now() + interval '24 hours'
);

update public.consent_records
set simulation_session_id = '00000000-0000-4000-8000-000000000603'
where id = '00000000-0000-4000-8000-000000000602';

do $smoke$
begin
  insert into public.in_home_simulation_jobs (
    simulation_session_id,
    selected_sofa_id,
    selected_fabric_id,
    selected_visual_matrix_column_id,
    prepared_render_cell_id,
    prepared_sofa_asset_id,
    storage_prefix,
    retention_deadline
  )
  values (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000105',
    'simulations/00000000-0000-4000-8000-000000000701',
    now() + interval '25 hours'
  );

  insert into spec_0009_smoke_failures (failure)
  values ('simulation retention deadline cap did not reject deadlines beyond 24 hours');
exception
  when check_violation then null;
end;
$smoke$;

do $smoke$
begin
  execute 'set local role anon';
  execute 'select count(*) from public.sofas';
  execute 'reset role';

  insert into spec_0009_smoke_failures (failure)
  values ('anonymous role can read private base table public.sofas');
exception
  when insufficient_privilege then
    execute 'reset role';
end;
$smoke$;

do $smoke$
declare
  public_count integer;
  error_message text;
begin
  execute 'set local role anon';
  execute 'select count(*) from public.public_catalog_sofas' into public_count;
  execute 'reset role';
exception
  when others then
    get stacked diagnostics error_message = message_text;
    execute 'reset role';
    insert into spec_0009_smoke_failures (failure)
    values ('anonymous role cannot read public catalog view: ' || error_message);
end;
$smoke$;

select failure
from spec_0009_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP SPEC-0009 schema smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL SPEC-0009 schema smoke: ${message}`);
  process.exit(1);
}

function isLocalDbUrl(value) {
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function isConnectionFailure(stderr, error) {
  const text = `${stderr}\n${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("connection refused") ||
    text.includes("could not connect") ||
    text.includes("connection timed out") ||
    text.includes("no route to host") ||
    text.includes("operation not permitted") ||
    text.includes("server closed the connection")
  );
}

function isDockerDatabaseUnavailable(stderr, error) {
  const text = `${stderr}\n${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("no such container") ||
    text.includes("is not running") ||
    text.includes("cannot connect to the docker daemon")
  );
}

function readSupabaseProjectId() {
  if (process.env.SPEC_0009_SCHEMA_SMOKE_PROJECT_ID) {
    return process.env.SPEC_0009_SCHEMA_SMOKE_PROJECT_ID;
  }

  try {
    const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
    return config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

function psqlArgs(dbUrl) {
  return [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", smokeSql];
}

function spawnCommand(bin, args) {
  const isNodeShim = /\.(cjs|js|mjs)$/i.test(bin);
  return spawn(isNodeShim ? process.execPath : bin, isNodeShim ? [bin, ...args] : args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createPsqlRun() {
  return {
    args: psqlArgs(DB_URL),
    bin: PSQL_BIN,
    kind: "psql",
  };
}

function createDockerPsqlRun() {
  const projectId = readSupabaseProjectId();

  if (!projectId) {
    fail(
      `psql executable not found: ${PSQL_BIN}; Supabase project_id not found for Docker fallback`,
    );
  }

  return {
    args: [
      "exec",
      "-i",
      `supabase_db_${projectId}`,
      "psql",
      ...psqlArgs(DOCKER_DB_URL),
    ],
    bin: DOCKER_BIN,
    kind: "docker",
  };
}

function handleSuccessfulOutput(stdout) {
  const failures = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (failures.length > 0) {
    fail(`schema checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS SPEC-0009 schema smoke");
}

function runSchemaSmoke(run, options = {}) {
  const child = spawnCommand(run.bin, run.args);
  let stdout = "";
  let stderr = "";
  let settled = false;

  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
    if (isLocalDbUrl(DB_URL)) {
      skip(
        `local Supabase database is not reachable at ${DB_URL}. Run \`pnpm supabase:start\`.`,
      );
    }
    fail(`database query timed out after ${REQUEST_TIMEOUT_MS}ms`);
  }, REQUEST_TIMEOUT_MS);

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.on("error", (error) => {
    clearTimeout(timeout);
    settled = true;

    if (options.allowDockerFallback && error?.code === "ENOENT" && isLocalDbUrl(DB_URL)) {
      runSchemaSmoke(createDockerPsqlRun());
      return;
    }

    if (run.kind === "docker" && error?.code === "ENOENT") {
      fail(
        `psql executable not found: ${PSQL_BIN}; Docker fallback executable not found: ${DOCKER_BIN}`,
      );
    }

    if (error?.code === "ENOENT") {
      fail(`psql executable not found: ${run.bin}`);
    }

    fail(error instanceof Error ? error.message : String(error));
  });

  child.on("close", (status) => {
    if (settled) {
      return;
    }
    clearTimeout(timeout);

    if (status !== 0) {
      if (
        isLocalDbUrl(DB_URL) &&
        (isConnectionFailure(stderr) ||
          (run.kind === "docker" && isDockerDatabaseUnavailable(stderr)))
      ) {
        skip(
          `local Supabase database is not reachable at ${DB_URL}. Run \`pnpm supabase:start\`.`,
        );
      }
      fail(stderr.trim() || `${run.bin} exited with status ${status}`);
    }

    handleSuccessfulOutput(stdout);
  });
}

runSchemaSmoke(createPsqlRun(), {
  allowDockerFallback: !EXPLICIT_PSQL_BIN,
});
