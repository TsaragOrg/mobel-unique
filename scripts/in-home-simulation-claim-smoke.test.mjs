import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./in-home-simulation-claim-smoke.mjs", import.meta.url)
);
const TEST_TIMEOUT_MS = 15000;

function createFakePsql() {
  const cwd = mkdtempSync(
    join(tmpdir(), "mobel-in-home-simulation-claim-smoke-test-")
  );
  const fakePsqlPath = join(cwd, "fake-psql.mjs");

  writeFileSync(
    fakePsqlPath,
    `#!/usr/bin/env node
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

describe("in-home simulation claim smoke script", () => {
  it(
    "passes when psql returns no claim contract failures",
    async () => {
      const result = await runSmoke({
        IN_HOME_SIMULATION_CLAIM_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS in-home simulation claim smoke");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails clearly when psql reports claim contract failures",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STDOUT:
          "first claim did not transition the job to room_prep_processing\nsecond claim returned a job that was already room_prep_processing\n",
        IN_HOME_SIMULATION_CLAIM_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("FAIL in-home simulation claim smoke");
      expect(result.stderr).toContain(
        "first claim did not transition the job to room_prep_processing"
      );
      expect(result.stderr).toContain(
        "second claim returned a job that was already room_prep_processing"
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
        IN_HOME_SIMULATION_CLAIM_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        IN_HOME_SIMULATION_CLAIM_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP in-home simulation claim smoke");
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
        IN_HOME_SIMULATION_CLAIM_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        IN_HOME_SIMULATION_CLAIM_SMOKE_PSQL: createFakePsql()
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP in-home simulation claim smoke");
    },
    TEST_TIMEOUT_MS
  );
});
