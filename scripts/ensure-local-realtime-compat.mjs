#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const DEFAULT_DATABASE_URL =
  "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

const databaseUrl =
  process.env.SUPABASE_LOCAL_REALTIME_ADMIN_DATABASE_URL ??
  process.env.LOCAL_REALTIME_ADMIN_DATABASE_URL ??
  DEFAULT_DATABASE_URL;

function fail(message) {
  console.error(`FAIL local Realtime compatibility: ${message}`);
  process.exit(1);
}

function assertLocalDatabaseUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    fail("database URL is invalid.");
  }

  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) {
    fail("refusing to patch a non-local database.");
  }
}

assertLocalDatabaseUrl(databaseUrl);

const sql = `
do $$
begin
  if to_regclass('realtime.subscription') is not null then
    execute 'create unique index if not exists subscription_subscription_id_entity_filters_key on realtime.subscription (subscription_id, entity, filters)';
  end if;
end;
$$;
`;

const result = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
  {
    stdio: "inherit",
  },
);

if (result.error) {
  fail(result.error.message);
}

if (result.status !== 0) {
  fail(`psql exited with status ${result.status ?? "unknown"}.`);
}

console.log("PASS local Realtime compatibility index is present.");
