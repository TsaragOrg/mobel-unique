#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_TEST_SEED_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_TEST_SEED_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_TEST_SEED_SMOKE_TIMEOUT_MS ?? 10000
);

const REQUIRED_FUNCTIONS = [
  "ensure_in_home_simulation_local_test_fixtures",
  "seed_in_home_simulation_local_test_job",
  "enqueue_in_home_simulation_room_prep_message"
];

const smokeSql = `
begin;

create temp table in_home_simulation_test_seed_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_test_seed_smoke_failures (failure)
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
  job_one uuid;
  job_two uuid;
  job_one_count integer;
  job_two_count integer;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/seed-smoke/inputs/room-one.jpg', null, 12
  ) into job_one;

  select public.seed_in_home_simulation_local_test_job(
    'simulations/seed-smoke/inputs/room-two.jpg', null, 24
  ) into job_two;

  if job_one is null or job_two is null then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('seed_in_home_simulation_local_test_job did not return a job id');
  end if;

  if job_one = job_two then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('seed_in_home_simulation_local_test_job returned the same id for two calls');
  end if;

  select count(*) into job_one_count
  from public.in_home_simulation_jobs
  where id = job_one and status = 'queued'
    and customer_room_original_path = 'simulations/seed-smoke/inputs/room-one.jpg'
    and storage_prefix = 'simulations/' || job_one::text;

  select count(*) into job_two_count
  from public.in_home_simulation_jobs
  where id = job_two and status = 'queued'
    and customer_room_original_path = 'simulations/seed-smoke/inputs/room-two.jpg';

  if job_one_count <> 1 then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('first seeded job row was not persisted as queued with the expected paths');
  end if;

  if job_two_count <> 1 then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('second seeded job row was not persisted as queued with the expected paths');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.seed_in_home_simulation_local_test_job('', null, 24);
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('seed accepted an empty customer_room_original_path');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.seed_in_home_simulation_local_test_job(
      'simulations/seed-smoke/over.jpg', null, 48
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('seed accepted retention_hours greater than 24');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.enqueue_in_home_simulation_room_prep_message(
      '00000000-0000-4000-8000-0000ff00cafe'::uuid,
      'local_in_home_simulation_jobs'
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_test_seed_smoke_failures (failure)
    values ('enqueue accepted a job_id with no matching in_home_simulation_jobs row');
  end if;
end;
$smoke$;

select failure
from in_home_simulation_test_seed_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation test-seed smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation test-seed smoke: ${message}`);
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
    fail(`test-seed contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation test-seed smoke");
});
