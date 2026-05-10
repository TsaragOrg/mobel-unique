#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_CLAIM_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_CLAIM_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_CLAIM_SMOKE_TIMEOUT_MS ?? 30000
);

const smokeSql = `
begin;

create temp table in_home_simulation_claim_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_claim_smoke_failures (failure)
select 'missing claim function: public.claim_in_home_simulation_room_prep_job'
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'claim_in_home_simulation_room_prep_job'
);

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
    '00000000-0000-4000-8000-000000010101',
    'catalog-public-assets',
    'claim-smoke/swatch.png',
    'public',
    'active',
    'fabric_swatch_public',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000010102',
    'catalog-private-assets',
    'claim-smoke/ai-reference.png',
    'private',
    'active',
    'fabric_ai_reference',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000010103',
    'catalog-private-assets',
    'claim-smoke/render-private.png',
    'private',
    'active',
    'render_private',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000010104',
    'catalog-public-assets',
    'claim-smoke/render-public.png',
    'public',
    'active',
    'render_public',
    'image/png',
    10,
    10,
    10
  ),
  (
    '00000000-0000-4000-8000-000000010105',
    'catalog-private-assets',
    'claim-smoke/prepared-sofa.png',
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
values (
  '00000000-0000-4000-8000-000000010201',
  'published',
  'Claim Smoke Sofa',
  'Claim Smoke Sofa',
  'https://shop.example/claim-smoke'
);

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
  '00000000-0000-4000-8000-000000010301',
  'active',
  'Claim Smoke Fabric',
  'Claim Smoke Fabric',
  '00000000-0000-4000-8000-000000010101',
  '00000000-0000-4000-8000-000000010102',
  false
);

insert into public.sofa_fabrics (sofa_id, fabric_id, public_order)
values (
  '00000000-0000-4000-8000-000000010201',
  '00000000-0000-4000-8000-000000010301',
  0
);

insert into public.visual_matrix_columns (id, sofa_id, sequence, admin_label, public_label)
values (
  '00000000-0000-4000-8000-000000010401',
  '00000000-0000-4000-8000-000000010201',
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
  '00000000-0000-4000-8000-000000010501',
  '00000000-0000-4000-8000-000000010201',
  '00000000-0000-4000-8000-000000010301',
  '00000000-0000-4000-8000-000000010103',
  '00000000-0000-4000-8000-000000010104',
  'manual_upload'
);

insert into public.email_verification_requests (
  id,
  email_normalized_hash,
  verification_code_hash,
  status,
  expires_at
)
values (
  '00000000-0000-4000-8000-000000010601',
  'claim-smoke-email',
  'claim-smoke-code',
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
  '00000000-0000-4000-8000-000000010602',
  'email_verification_required',
  'granted',
  'claim-smoke-email',
  'v1',
  'fr-FR',
  'claim-smoke',
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
  '00000000-0000-4000-8000-000000010603',
  '00000000-0000-4000-8000-000000010601',
  'claim-smoke-email',
  '00000000-0000-4000-8000-000000010602',
  'claim-smoke-access-token',
  'active',
  now() + interval '24 hours'
);

update public.consent_records
set simulation_session_id = '00000000-0000-4000-8000-000000010603'
where id = '00000000-0000-4000-8000-000000010602';

insert into public.in_home_simulation_jobs (
  id,
  simulation_session_id,
  selected_sofa_id,
  selected_fabric_id,
  selected_visual_matrix_column_id,
  prepared_render_cell_id,
  prepared_sofa_asset_id,
  storage_prefix,
  customer_room_original_path,
  status,
  retention_deadline,
  queued_at
)
values
  (
    '00000000-0000-4000-8000-000000010701',
    '00000000-0000-4000-8000-000000010603',
    '00000000-0000-4000-8000-000000010201',
    '00000000-0000-4000-8000-000000010301',
    '00000000-0000-4000-8000-000000010401',
    '00000000-0000-4000-8000-000000010501',
    '00000000-0000-4000-8000-000000010105',
    'simulations/00000000-0000-4000-8000-000000010701',
    'simulations/00000000-0000-4000-8000-000000010701/inputs/room.jpg',
    'queued',
    now() + interval '23 hours',
    now()
  );

with first_claim as (
  select * from public.claim_in_home_simulation_room_prep_job(
    'claim-smoke-worker-a',
    600
  )
)
insert into in_home_simulation_claim_smoke_failures (failure)
select 'first claim did not return the queued job'
where not exists (
  select 1
  from first_claim
  where job_id = '00000000-0000-4000-8000-000000010701'
);

insert into in_home_simulation_claim_smoke_failures (failure)
select 'first claim did not transition the job to room_prep_processing'
where not exists (
  select 1
  from public.in_home_simulation_jobs
  where id = '00000000-0000-4000-8000-000000010701'
    and status = 'room_prep_processing'
    and room_prep_attempt_count = 1
    and claimed_by = 'claim-smoke-worker-a'
    and claim_expires_at > now() + interval '590 seconds'
    and claim_expires_at < now() + interval '610 seconds'
    and claimed_at is not null
    and room_prep_started_at is not null
);

with repeated_claim as (
  select * from public.claim_in_home_simulation_room_prep_job(
    'claim-smoke-worker-b',
    600
  )
)
insert into in_home_simulation_claim_smoke_failures (failure)
select 'second claim returned a job that was already room_prep_processing'
where exists (
  select 1 from repeated_claim
);

insert into public.in_home_simulation_jobs (
  id,
  simulation_session_id,
  selected_sofa_id,
  selected_fabric_id,
  selected_visual_matrix_column_id,
  prepared_render_cell_id,
  prepared_sofa_asset_id,
  storage_prefix,
  customer_room_original_path,
  status,
  room_prep_attempt_count,
  retention_deadline,
  queued_at
)
values
  (
    '00000000-0000-4000-8000-000000010702',
    '00000000-0000-4000-8000-000000010603',
    '00000000-0000-4000-8000-000000010201',
    '00000000-0000-4000-8000-000000010301',
    '00000000-0000-4000-8000-000000010401',
    '00000000-0000-4000-8000-000000010501',
    '00000000-0000-4000-8000-000000010105',
    'simulations/00000000-0000-4000-8000-000000010702',
    'simulations/00000000-0000-4000-8000-000000010702/inputs/room.jpg',
    'queued',
    3,
    now() + interval '23 hours',
    now()
  );

with attempt_capped_claim as (
  select * from public.claim_in_home_simulation_room_prep_job(
    'claim-smoke-worker-c',
    600
  )
)
insert into in_home_simulation_claim_smoke_failures (failure)
select 'claim returned a job whose room_prep_attempt_count is at the per-stage cap'
where exists (
  select 1 from attempt_capped_claim
  where job_id = '00000000-0000-4000-8000-000000010702'
);

update public.in_home_simulation_jobs
set status = 'queued'
where id = '00000000-0000-4000-8000-000000010702';

insert into public.in_home_simulation_jobs (
  id,
  simulation_session_id,
  selected_sofa_id,
  selected_fabric_id,
  selected_visual_matrix_column_id,
  prepared_render_cell_id,
  prepared_sofa_asset_id,
  storage_prefix,
  customer_room_original_path,
  status,
  retention_deadline,
  queued_at,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000010703',
    '00000000-0000-4000-8000-000000010603',
    '00000000-0000-4000-8000-000000010201',
    '00000000-0000-4000-8000-000000010301',
    '00000000-0000-4000-8000-000000010401',
    '00000000-0000-4000-8000-000000010501',
    '00000000-0000-4000-8000-000000010105',
    'simulations/00000000-0000-4000-8000-000000010703',
    'simulations/00000000-0000-4000-8000-000000010703/inputs/room.jpg',
    'queued',
    now() - interval '1 minute',
    now() - interval '25 hours',
    now() - interval '25 hours'
  );

with expired_claim as (
  select * from public.claim_in_home_simulation_room_prep_job(
    'claim-smoke-worker-d',
    600
  )
)
insert into in_home_simulation_claim_smoke_failures (failure)
select 'claim returned a job whose retention_deadline has passed'
where exists (
  select 1 from expired_claim
  where job_id = '00000000-0000-4000-8000-000000010703'
);

do $smoke$
begin
  perform public.claim_in_home_simulation_room_prep_job('', 600);
  insert into in_home_simulation_claim_smoke_failures (failure)
  values ('claim accepted an empty worker_identifier');
exception
  when raise_exception then null;
  when others then null;
end;
$smoke$;

do $smoke$
begin
  perform public.claim_in_home_simulation_room_prep_job(
    'claim-smoke-worker-e',
    0
  );
  insert into in_home_simulation_claim_smoke_failures (failure)
  values ('claim accepted a non-positive claim_ttl_seconds');
exception
  when raise_exception then null;
  when others then null;
end;
$smoke$;

select failure
from in_home_simulation_claim_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation claim smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation claim smoke: ${message}`);
  process.exit(1);
}

function isLocalDbUrl(value) {
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function isConnectionFailure(stderr) {
  const text = stderr.toLowerCase();
  return (
    text.includes("connection refused") ||
    text.includes("could not connect") ||
    text.includes("connection timed out") ||
    text.includes("no route to host") ||
    text.includes("operation not permitted") ||
    text.includes("server closed the connection")
  );
}

function spawnCommand(bin, args) {
  const isNodeShim = /\.(cjs|js|mjs)$/i.test(bin);
  return spawn(isNodeShim ? process.execPath : bin, isNodeShim ? [bin, ...args] : args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

const child = spawnCommand(PSQL_BIN, [
  DB_URL,
  "-v",
  "ON_ERROR_STOP=1",
  "-q",
  "-t",
  "-A",
  "-c",
  smokeSql
]);

let stdout = "";
let stderr = "";
let settled = false;

const timeout = setTimeout(() => {
  settled = true;
  child.kill("SIGTERM");
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
  if (error?.code === "ENOENT") {
    fail(`psql executable not found: ${PSQL_BIN}`);
  }
  fail(error instanceof Error ? error.message : String(error));
});

child.on("close", (status) => {
  if (settled) {
    return;
  }
  clearTimeout(timeout);

  if (status !== 0) {
    if (isLocalDbUrl(DB_URL) && isConnectionFailure(stderr)) {
      skip(
        `local Supabase database is not reachable at ${DB_URL}. Run \`pnpm supabase:start\`.`
      );
    }
    fail(stderr.trim() || `psql exited with status ${status}`);
  }

  const failures = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (failures.length > 0) {
    fail(`claim contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation claim smoke");
});
