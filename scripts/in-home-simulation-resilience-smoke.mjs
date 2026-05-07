#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_RESILIENCE_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_RESILIENCE_SMOKE_TIMEOUT_MS ?? 30000
);

const REQUIRED_FUNCTIONS = [
  "release_in_home_simulation_room_prep_claim",
  "release_in_home_simulation_placement_claim",
  "recover_expired_in_home_simulation_claims",
  "list_expired_in_home_simulation_jobs",
  "mark_in_home_simulation_job_purged"
];

const smokeSql = `
begin;

create temp table in_home_simulation_resilience_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_resilience_smoke_failures (failure)
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
  current_status public.simulation_job_status;
begin
  -- release_room_prep happy path.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/release-room-prep/room.jpg', null, 24
  ) into job_id;

  perform public.claim_specific_in_home_simulation_room_prep_job(
    job_id, 'release-worker', 600
  );

  perform public.release_in_home_simulation_room_prep_claim(
    job_id, 'release-worker', 'transient_provider', 'mock transient'
  );

  select status into current_status
  from public.in_home_simulation_jobs
  where id = job_id;

  if current_status <> 'queued' then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('release_room_prep_claim did not return job to queued');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  caught boolean := false;
begin
  -- release_room_prep refuses a worker mismatch.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/release-mismatch/room.jpg', null, 24
  ) into job_id;

  perform public.claim_specific_in_home_simulation_room_prep_job(
    job_id, 'original-worker', 600
  );

  begin
    perform public.release_in_home_simulation_room_prep_claim(
      job_id, 'imposter-worker'
    );
  exception when others then
    caught := true;
  end;

  if not caught then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('release_room_prep_claim accepted a worker mismatch');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id_recoverable uuid;
  job_id_capped uuid;
  job_id_expired_retention uuid;
  recovered_count integer;
  recoverable_status public.simulation_job_status;
  capped_status public.simulation_job_status;
  expired_status public.simulation_job_status;
begin
  -- recover_expired_claims: one recoverable, one capped, one past retention.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/recover/recoverable.jpg', null, 24
  ) into job_id_recoverable;

  update public.in_home_simulation_jobs
  set
    status = 'room_prep_processing',
    claimed_by = 'recover-worker',
    claim_expires_at = now() - interval '5 minutes',
    room_prep_attempt_count = 1
  where id = job_id_recoverable;

  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/recover/capped.jpg', null, 24
  ) into job_id_capped;

  update public.in_home_simulation_jobs
  set
    status = 'placement_processing',
    claimed_by = 'recover-worker',
    claim_expires_at = now() - interval '5 minutes',
    placement_attempt_count = max_attempts_per_stage
  where id = job_id_capped;

  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/recover/expired.jpg', null, 24
  ) into job_id_expired_retention;

  update public.in_home_simulation_jobs
  set
    status = 'room_prep_processing',
    claimed_by = 'recover-worker',
    claim_expires_at = now() - interval '5 minutes',
    retention_deadline = now() - interval '1 minute'
  where id = job_id_expired_retention;

  select count(*)
  into recovered_count
  from public.recover_expired_in_home_simulation_claims(50);

  if recovered_count < 3 then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('recover_expired_claims did not process all three test jobs');
  end if;

  select status into recoverable_status
  from public.in_home_simulation_jobs where id = job_id_recoverable;
  if recoverable_status <> 'queued' then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('recover_expired_claims did not return room_prep_processing to queued');
  end if;

  select status into capped_status
  from public.in_home_simulation_jobs where id = job_id_capped;
  if capped_status <> 'failed' then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('recover_expired_claims did not mark a capped placement job as failed');
  end if;

  select status into expired_status
  from public.in_home_simulation_jobs where id = job_id_expired_retention;
  if expired_status <> 'failed' then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('recover_expired_claims did not mark a retention-expired job as failed');
  end if;
end;
$smoke$;

do $smoke$
declare
  job_id uuid;
  expired_count integer;
  current_status public.simulation_job_status;
  output_purged timestamptz;
begin
  -- list_expired + mark_purged.
  select public.seed_in_home_simulation_local_test_job(
    'simulations/resilience/purge/room.jpg', null, 24
  ) into job_id;

  insert into public.simulation_generated_outputs (
    in_home_simulation_job_id, generation_index, object_path,
    content_type, source_type, provider_name, provider_model, prompt_version
  )
  values (
    job_id, 0,
    'simulations/resilience/purge/outputs/output-0.png',
    'image/png', 'ai_generated_in_home_simulation',
    'mock', 'mock-placement-v001', 'sofa_placement_v001'
  );

  update public.in_home_simulation_jobs
  set
    status = 'succeeded',
    retention_deadline = now() - interval '1 minute',
    generated_output_count = 1,
    regeneration_count = 0,
    latest_generated_output_index = 0
  where id = job_id;

  select count(*) into expired_count
  from public.list_expired_in_home_simulation_jobs(50) as listed
  where listed.job_id = job_id;

  if expired_count = 0 then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('list_expired_in_home_simulation_jobs did not return the seeded expired job');
  end if;

  perform public.mark_in_home_simulation_job_purged(job_id);

  select status into current_status
  from public.in_home_simulation_jobs where id = job_id;
  if current_status <> 'expired' then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('mark_purged did not transition the job to expired');
  end if;

  select purged_at into output_purged
  from public.simulation_generated_outputs
  where in_home_simulation_job_id = job_id and generation_index = 0;
  if output_purged is null then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('mark_purged did not set purged_at on the related output row');
  end if;

  -- Idempotency: a second mark_purged must not raise.
  begin
    perform public.mark_in_home_simulation_job_purged(job_id);
  exception when others then
    insert into in_home_simulation_resilience_smoke_failures (failure)
    values ('mark_purged is not idempotent on a second call');
  end;
end;
$smoke$;

select failure
from in_home_simulation_resilience_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation resilience smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation resilience smoke: ${message}`);
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
    fail(`resilience contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation resilience smoke");
});
