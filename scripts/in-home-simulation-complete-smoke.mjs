#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_COMPLETE_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_COMPLETE_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_COMPLETE_SMOKE_TIMEOUT_MS ?? 10000
);

const smokeSql = `
begin;

create temp table in_home_simulation_complete_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_complete_smoke_failures (failure)
select 'missing complete function: public.complete_in_home_simulation_room_prep_stage'
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'complete_in_home_simulation_room_prep_stage'
);

do $smoke$
declare
  job_id uuid;
  claim_record record;
  awaiting_count integer;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/complete-smoke/inputs/room.jpg', null, 24
  ) into job_id;

  select * into claim_record
  from public.claim_in_home_simulation_room_prep_job(
    'complete-smoke-worker', 600
  );

  if claim_record.job_id is null then
    insert into in_home_simulation_complete_smoke_failures (failure)
    values ('claim before complete returned no row');
    return;
  end if;

  perform public.complete_in_home_simulation_room_prep_stage(
    job_id := claim_record.job_id,
    worker_identifier := 'complete-smoke-worker',
    room_normalized_path := 'simulations/complete-smoke/room_normalized.jpg',
    room_compressed_path := 'simulations/complete-smoke/room_compressed.jpg',
    room_cleaned_path := 'simulations/complete-smoke/room_cleaned.png',
    dimension_guide_overlay_path := 'simulations/complete-smoke/room_guides.png',
    room_geometry_mode := 'back_wall'::public.room_geometry_mode,
    room_geometry_points := jsonb_build_object(
      'mode', 'back_wall',
      'points', jsonb_build_array(
        jsonb_build_object('x', 100, 'y', 700),
        jsonb_build_object('x', 900, 'y', 700),
        jsonb_build_object('x', 900, 'y', 100),
        jsonb_build_object('x', 100, 'y', 100)
      )
    ),
    room_geometry_confidence := 0.95
  );

  select count(*) into awaiting_count
  from public.in_home_simulation_jobs
  where id = claim_record.job_id
    and status = 'awaiting_dimensions'
    and room_geometry_mode = 'back_wall'
    and room_geometry_confidence = 0.95
    and room_normalized_path = 'simulations/complete-smoke/room_normalized.jpg'
    and room_cleaned_path = 'simulations/complete-smoke/room_cleaned.png'
    and dimension_guide_overlay_path = 'simulations/complete-smoke/room_guides.png'
    and awaiting_dimensions_at is not null
    and claim_expires_at is null
    and last_error_message is null;

  if awaiting_count <> 1 then
    insert into in_home_simulation_complete_smoke_failures (failure)
    values ('complete did not transition the job to awaiting_dimensions with the expected fields');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  claim_record record;
  caught boolean := false;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/complete-smoke-wrong-worker/inputs/room.jpg', null, 24
  ) into job_id;

  select * into claim_record
  from public.claim_in_home_simulation_room_prep_job(
    'complete-smoke-worker-original', 600
  );

  begin
    perform public.complete_in_home_simulation_room_prep_stage(
      job_id := claim_record.job_id,
      worker_identifier := 'complete-smoke-worker-imposter',
      room_normalized_path := 'simulations/x/room_normalized.jpg',
      room_compressed_path := 'simulations/x/room_compressed.jpg',
      room_cleaned_path := 'simulations/x/room_cleaned.png',
      dimension_guide_overlay_path := 'simulations/x/room_guides.png',
      room_geometry_mode := 'back_wall'::public.room_geometry_mode,
      room_geometry_points := '{"mode":"back_wall","points":[]}'::jsonb
    );
  exception when others then
    caught := true;
  end;

  if not caught then
    insert into in_home_simulation_complete_smoke_failures (failure)
    values ('complete accepted a worker_identifier that does not match the current claim');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  caught boolean := false;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/complete-smoke-not-claimed/inputs/room.jpg', null, 24
  ) into job_id;

  begin
    perform public.complete_in_home_simulation_room_prep_stage(
      job_id := job_id,
      worker_identifier := 'complete-smoke-worker',
      room_normalized_path := 'simulations/x/room_normalized.jpg',
      room_compressed_path := 'simulations/x/room_compressed.jpg',
      room_cleaned_path := 'simulations/x/room_cleaned.png',
      dimension_guide_overlay_path := 'simulations/x/room_guides.png',
      room_geometry_mode := 'back_wall'::public.room_geometry_mode,
      room_geometry_points := '{"mode":"back_wall","points":[]}'::jsonb
    );
  exception when others then
    caught := true;
  end;

  if not caught then
    insert into in_home_simulation_complete_smoke_failures (failure)
    values ('complete accepted a job that is not in room_prep_processing');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.complete_in_home_simulation_room_prep_stage(
      job_id := '00000000-0000-4000-8000-0000ff00bad0'::uuid,
      worker_identifier := '',
      room_normalized_path := 'x',
      room_compressed_path := 'x',
      room_cleaned_path := 'x',
      dimension_guide_overlay_path := 'x',
      room_geometry_mode := 'back_wall'::public.room_geometry_mode,
      room_geometry_points := '{}'::jsonb
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_complete_smoke_failures (failure)
    values ('complete accepted an empty worker_identifier');
  end if;
end;
$smoke$;

select failure
from in_home_simulation_complete_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation complete smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation complete smoke: ${message}`);
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

const child = spawn(
  PSQL_BIN,
  [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", smokeSql],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let stdout = "";
let stderr = "";
let settled = false;

const timeout = setTimeout(() => {
  child.kill("SIGTERM");
  if (isLocalDbUrl(DB_URL)) {
    skip(
      `local Supabase database is not reachable at ${DB_URL}. Run \`pnpm supabase:start\`.`
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
    fail(`complete contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation complete smoke");
});
