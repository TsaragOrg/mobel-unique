#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_STAGE_2_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_STAGE_2_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_STAGE_2_SMOKE_TIMEOUT_MS ?? 30000
);

const REQUIRED_FUNCTIONS = [
  "submit_in_home_simulation_dimensions",
  "request_in_home_simulation_regeneration",
  "claim_specific_in_home_simulation_placement_job",
  "complete_in_home_simulation_placement_stage",
  "record_in_home_simulation_placement_failure"
];

const smokeSql = `
begin;

create temp table in_home_simulation_stage_2_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_stage_2_smoke_failures (failure)
select 'missing helper function: public.' || function_name
from (values
  ${REQUIRED_FUNCTIONS.map((name) => `('${name}')`).join(",\n  ")}
) as required(function_name)
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = required.function_name
);

do $smoke$
declare
  job_id uuid;
  msg_id bigint;
  claim_record record;
  current_status public.simulation_job_status;
  output_count integer;
  output_index integer;
  output_row_count integer;
  failure_status text;
begin
  -- Seed a job that has already passed Stage 1.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/inputs/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'awaiting_dimensions',
    room_normalized_path = 'simulations/stage-2-smoke/room_normalized.jpg',
    room_compressed_path = 'simulations/stage-2-smoke/room_compressed.jpg',
    room_cleaned_path = 'simulations/stage-2-smoke/room_cleaned.png',
    dimension_guide_overlay_path = 'simulations/stage-2-smoke/room_guides.png',
    room_geometry_mode = 'back_wall'::public.room_geometry_mode,
    room_geometry_points = jsonb_build_object(
      'mode', 'back_wall',
      'points', jsonb_build_array(
        jsonb_build_object('x', 100, 'y', 700),
        jsonb_build_object('x', 900, 'y', 700),
        jsonb_build_object('x', 900, 'y', 100),
        jsonb_build_object('x', 100, 'y', 100)
      )
    ),
    awaiting_dimensions_at = now()
  where id = job_id;

  -- submit_dimensions happy path.
  select public.submit_in_home_simulation_dimensions(
    job_id,
    jsonb_build_object('wall_width', 4.0, 'wall_height', 2.5)
  ) into msg_id;

  if msg_id is null then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('submit_dimensions did not return a msg_id');
  end if;

  select status into current_status
  from public.in_home_simulation_jobs
  where id = job_id;
  if current_status <> 'placement_queued' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('submit_dimensions did not transition the job to placement_queued');
  end if;

  -- claim_specific_placement happy path.
  select * into claim_record
  from public.claim_specific_in_home_simulation_placement_job(
    job_id, 'stage-2-worker', 600
  );
  if claim_record.job_id is null or claim_record.job_id <> job_id then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('claim_specific_placement did not claim the job');
  end if;

  select status into current_status
  from public.in_home_simulation_jobs
  where id = job_id;
  if current_status <> 'placement_processing' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('placement claim did not transition to placement_processing');
  end if;

  -- complete_placement happy path.
  perform public.complete_in_home_simulation_placement_stage(
    job_id := job_id,
    worker_identifier := 'stage-2-worker',
    generation_index := 0,
    output_object_path := 'simulations/stage-2-smoke/outputs/output-0.png',
    output_content_type := 'image/png',
    output_width_px := 1024,
    output_height_px := 768,
    provider_name := 'mock',
    provider_model := 'mock-placement-v001',
    prompt_version := 'sofa_placement_v001',
    prepared_sofa_path := 'simulations/stage-2-smoke/sofa_prepared.png'
  );

  select status, generated_output_count, latest_generated_output_index
  into current_status, output_count, output_index
  from public.in_home_simulation_jobs
  where id = job_id;

  if current_status <> 'succeeded' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('complete_placement did not transition to succeeded');
  end if;

  if output_count <> 1 or output_index <> 0 then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('complete_placement did not increment generated_output_count to 1 or set latest index to 0');
  end if;

  select count(*) into output_row_count
  from public.simulation_generated_outputs
  where in_home_simulation_job_id = job_id and generation_index = 0;
  if output_row_count <> 1 then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('complete_placement did not insert a simulation_generated_outputs row');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  caught boolean := false;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/wrong-keys/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'awaiting_dimensions',
    room_geometry_mode = 'back_wall'::public.room_geometry_mode
  where id = job_id;

  begin
    perform public.submit_in_home_simulation_dimensions(
      job_id,
      jsonb_build_object('left_wall_width', 3.0, 'right_wall_width', 3.0, 'room_height', 2.5)
    );
  exception when others then
    caught := true;
  end;

  if not caught then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('submit_dimensions accepted corner-mode keys for a back_wall job');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  msg_id bigint;
  current_status public.simulation_job_status;
  reserved integer;
begin
  -- Seed a succeeded job with one output, then ask for regeneration.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/regen/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'succeeded',
    room_geometry_mode = 'back_wall'::public.room_geometry_mode,
    room_geometry_points = jsonb_build_object('mode', 'back_wall', 'points', jsonb_build_array()),
    supplied_dimensions = jsonb_build_object('wall_width', 4.0, 'wall_height', 2.5),
    generated_output_count = 1,
    regeneration_count = 0,
    latest_generated_output_index = 0
  where id = job_id;

  insert into public.simulation_generated_outputs (
    in_home_simulation_job_id, generation_index, object_path,
    content_type, source_type, provider_name, provider_model, prompt_version
  )
  values (
    job_id, 0,
    'simulations/stage-2-smoke/regen/outputs/output-0.png',
    'image/png', 'ai_generated_in_home_simulation',
    'mock', 'mock-placement-v001', 'sofa_placement_v001'
  );

  select public.request_in_home_simulation_regeneration(job_id) into msg_id;

  if msg_id is null then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('request_regeneration did not return a msg_id');
  end if;

  select status, reserved_generation_index into current_status, reserved
  from public.in_home_simulation_jobs
  where id = job_id;

  if current_status <> 'placement_queued' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('request_regeneration did not transition to placement_queued');
  end if;

  if reserved <> 1 then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('request_regeneration did not reserve next generation_index = 1');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  caught boolean := false;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/cap/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'succeeded',
    supplied_dimensions = jsonb_build_object('wall_width', 4.0, 'wall_height', 2.5),
    generated_output_count = 3,
    regeneration_count = 2,
    latest_generated_output_index = 2
  where id = job_id;

  begin
    perform public.request_in_home_simulation_regeneration(job_id);
  exception when others then
    caught := true;
  end;

  if not caught then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('request_regeneration accepted a request beyond the 3-output cap');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  resulting_status text;
  current_status public.simulation_job_status;
  current_index integer;
begin
  -- Failed regeneration with a prior output should return to succeeded.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/regen-fail/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'placement_processing',
    claimed_by = 'stage-2-failed-worker',
    claim_expires_at = now() + interval '5 minutes',
    generated_output_count = 1,
    regeneration_count = 0,
    latest_generated_output_index = 0,
    reserved_generation_index = 1
  where id = job_id;

  select public.record_in_home_simulation_placement_failure(
    job_id, 'stage-2-failed-worker', 'placement_failed', 'mock failure'
  ) into resulting_status;

  if resulting_status <> 'succeeded' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('record_placement_failure with a prior output did not return succeeded');
  end if;

  select status, latest_generated_output_index into current_status, current_index
  from public.in_home_simulation_jobs
  where id = job_id;

  if current_status <> 'succeeded' or current_index <> 0 then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('record_placement_failure did not preserve the prior succeeded state');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  resulting_status text;
  current_status public.simulation_job_status;
begin
  -- Failed first attempt with no prior output should mark failed.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/stage-2-smoke/initial-fail/room.jpg', null, 24
  ) into job_id;

  update public.in_home_simulation_jobs
  set
    status = 'placement_processing',
    claimed_by = 'stage-2-initial-worker',
    claim_expires_at = now() + interval '5 minutes',
    generated_output_count = 0
  where id = job_id;

  select public.record_in_home_simulation_placement_failure(
    job_id, 'stage-2-initial-worker', 'placement_failed', 'mock failure'
  ) into resulting_status;

  if resulting_status <> 'failed' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('record_placement_failure without prior output did not return failed');
  end if;

  select status into current_status
  from public.in_home_simulation_jobs
  where id = job_id;

  if current_status <> 'failed' then
    insert into in_home_simulation_stage_2_smoke_failures (failure)
    values ('record_placement_failure without prior output did not set status to failed');
  end if;
end;
$smoke$;

select failure
from in_home_simulation_stage_2_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation stage 2 smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation stage 2 smoke: ${message}`);
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
    fail(`stage 2 contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation stage 2 smoke");
});
