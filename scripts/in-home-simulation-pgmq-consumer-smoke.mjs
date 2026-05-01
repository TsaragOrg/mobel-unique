#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL =
  process.env.IN_HOME_SIMULATION_PGMQ_CONSUMER_SMOKE_DB_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  DEFAULT_LOCAL_DB_URL;
const PSQL_BIN =
  process.env.IN_HOME_SIMULATION_PGMQ_CONSUMER_SMOKE_PSQL ?? "psql";
const REQUEST_TIMEOUT_MS = Number(
  process.env.IN_HOME_SIMULATION_PGMQ_CONSUMER_SMOKE_TIMEOUT_MS ?? 10000
);

const REQUIRED_FUNCTIONS = [
  "dequeue_in_home_simulation_room_prep_messages",
  "delete_in_home_simulation_room_prep_message",
  "claim_specific_in_home_simulation_room_prep_job"
];

const smokeSql = `
begin;

create temp table in_home_simulation_pgmq_consumer_smoke_failures (
  failure text not null
) on commit drop;

insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
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
  dequeued_count integer;
  dequeued_msg_id bigint;
  dequeued_job_id uuid;
  delete_result boolean;
  redequeued_count integer;
  claim_record record;
begin
  select public.seed_in_home_simulation_local_test_job(
    'simulations/pgmq-consumer-smoke/inputs/room.jpg', null, 24
  ) into job_id;

  select public.enqueue_in_home_simulation_room_prep_message(
    job_id, 'local_in_home_simulation_jobs'
  ) into msg_id;

  if msg_id is null then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('enqueue did not return a msg_id');
    return;
  end if;

  select count(*), max(d.msg_id), (max(d.message ->> 'job_id'))::uuid
  into dequeued_count, dequeued_msg_id, dequeued_job_id
  from public.dequeue_in_home_simulation_room_prep_messages(
    'local_in_home_simulation_jobs', 600, 5
  ) as d;

  if dequeued_count <> 1 then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeue did not return exactly the message that was enqueued');
  end if;

  if dequeued_msg_id <> msg_id then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeued msg_id did not match the enqueued msg_id');
  end if;

  if dequeued_job_id <> job_id then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeued message payload did not carry the seeded job_id');
  end if;

  select * into claim_record
  from public.claim_specific_in_home_simulation_room_prep_job(
    job_id, 'pgmq-consumer-smoke-worker', 600
  );

  if claim_record.job_id is null or claim_record.job_id <> job_id then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('claim_specific did not claim the seeded job by id');
  end if;

  select * into claim_record
  from public.claim_specific_in_home_simulation_room_prep_job(
    job_id, 'pgmq-consumer-smoke-worker-other', 600
  );

  if claim_record.job_id is not null then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('claim_specific returned a row for a job that was already room_prep_processing');
  end if;

  select public.delete_in_home_simulation_room_prep_message(
    'local_in_home_simulation_jobs', msg_id
  ) into delete_result;

  if not delete_result then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('delete returned false for a message that should still exist on the queue');
  end if;

  select count(*) into redequeued_count
  from public.dequeue_in_home_simulation_room_prep_messages(
    'local_in_home_simulation_jobs', 60, 5
  );

  if redequeued_count <> 0 then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeue still returned messages after the deletion');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.dequeue_in_home_simulation_room_prep_messages('', 600, 1);
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeue accepted an empty queue_name');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.dequeue_in_home_simulation_room_prep_messages(
      'local_in_home_simulation_jobs', 0, 1
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('dequeue accepted a non-positive visibility_seconds');
  end if;
end;
$smoke$;

do $smoke$
declare
  caught boolean := false;
begin
  begin
    perform public.claim_specific_in_home_simulation_room_prep_job(
      null, 'worker', 600
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    insert into in_home_simulation_pgmq_consumer_smoke_failures (failure)
    values ('claim_specific accepted a null job_id');
  end if;
end;
$smoke$;

select failure
from in_home_simulation_pgmq_consumer_smoke_failures
order by failure;

rollback;
`;

function skip(message) {
  console.log(`SKIP in-home simulation pgmq-consumer smoke: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL in-home simulation pgmq-consumer smoke: ${message}`);
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
    fail(`pgmq consumer contract checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("PASS in-home simulation pgmq-consumer smoke");
});
