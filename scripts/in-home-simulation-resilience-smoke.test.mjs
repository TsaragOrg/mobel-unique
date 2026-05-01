import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./in-home-simulation-resilience-smoke.mjs", import.meta.url)
);
const TEST_TIMEOUT_MS = 45000;

function createFakePsql() {
  const cwd = mkdtempSync(
    join(tmpdir(), "mobel-in-home-simulation-resilience-smoke-test-")
  );
  const fakePsqlPath = join(cwd, "fake-psql.mjs");

  writeFileSync(
    fakePsqlPath,
    `#!/usr/bin/env node
const hangMs = Number(process.env.FAKE_PSQL_HANG_MS ?? "0");
if (hangMs > 0) {
  await new Promise((resolve) => setTimeout(resolve, hangMs));
}
process.stdout.write(process.env.FAKE_PSQL_STDOUT ?? "");
process.stderr.write(process.env.FAKE_PSQL_STDERR ?? "");
process.exit(Number(process.env.FAKE_PSQL_STATUS ?? "0"));
`
  );
  chmodSync(fakePsqlPath, 0o755);

  return fakePsqlPath;
}

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        ...env
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}

describe("in-home simulation resilience smoke script", () => {
  it(
    "passes when psql returns no resilience contract failures",
    async () => {
      const result = await runSmoke({
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "PASS in-home simulation resilience smoke"
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails clearly when psql reports resilience contract failures",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STDOUT:
          "release_room_prep_claim did not return job to queued\nrecover_expired_claims did not return room_prep_processing to queued\n",
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "FAIL in-home simulation resilience smoke"
      );
      expect(result.stderr).toContain(
        "release_room_prep_claim did not return job to queued"
      );
      expect(result.stderr).toContain(
        "recover_expired_claims did not return room_prep_processing to queued"
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails clearly when psql times out",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_HANG_MS: "500",
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL: createFakePsql(),
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_TIMEOUT_MS: "50"
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "FAIL in-home simulation resilience smoke"
      );
      expect(result.stderr).toContain("database query timed out after 50ms");
      expect(result.stdout).not.toContain(
        "SKIP in-home simulation resilience smoke"
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "skips clearly when the local database is unreachable",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STATUS: "2",
        FAKE_PSQL_STDERR:
          'connection to server at "127.0.0.1", port 54322 failed: Connection refused\n',
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "SKIP in-home simulation resilience smoke"
      );
      expect(result.stdout).toContain("pnpm supabase:start");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "skips clearly when the sandbox blocks the local database connection",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STATUS: "2",
        FAKE_PSQL_STDERR:
          'connection to server at "127.0.0.1", port 54322 failed: Operation not permitted\n',
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        IN_HOME_SIMULATION_RESILIENCE_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "SKIP in-home simulation resilience smoke"
      );
    },
    TEST_TIMEOUT_MS
  );
});
