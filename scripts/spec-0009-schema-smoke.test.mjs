import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./spec-0009-schema-smoke.mjs", import.meta.url),
);
const TEST_TIMEOUT_MS = 15000;

function createFakePsql() {
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-0009-smoke-test-"));
  const fakePsqlPath = join(cwd, "fake-psql.mjs");

  writeFileSync(
    fakePsqlPath,
    `#!/usr/bin/env node
process.stdout.write(process.env.FAKE_PSQL_STDOUT ?? "");
process.stderr.write(process.env.FAKE_PSQL_STDERR ?? "");
process.exit(Number(process.env.FAKE_PSQL_STATUS ?? "0"));
`,
  );
  chmodSync(fakePsqlPath, 0o755);

  return fakePsqlPath;
}

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        ...env,
      },
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

describe("SPEC-0009 schema smoke script", () => {
  it(
    "passes when psql returns no schema failures",
    async () => {
      const result = await runSmoke({
        SPEC_0009_SCHEMA_SMOKE_PSQL: createFakePsql(),
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS SPEC-0009 schema smoke");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "fails clearly when psql returns schema failures",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STDOUT:
          "missing table: public.sofas\nrls disabled: public.fabrics\n",
        SPEC_0009_SCHEMA_SMOKE_PSQL: createFakePsql(),
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("FAIL SPEC-0009 schema smoke");
      expect(result.stderr).toContain("missing table: public.sofas");
      expect(result.stderr).toContain("rls disabled: public.fabrics");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "skips clearly when the local database is unreachable",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STATUS: "2",
        FAKE_PSQL_STDERR:
          'connection to server at "127.0.0.1", port 54322 failed: Connection refused\n',
        SPEC_0009_SCHEMA_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        SPEC_0009_SCHEMA_SMOKE_PSQL: createFakePsql(),
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP SPEC-0009 schema smoke");
      expect(result.stdout).toContain("pnpm supabase:start");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "skips clearly when the sandbox blocks the local database connection",
    async () => {
      const result = await runSmoke({
        FAKE_PSQL_STATUS: "2",
        FAKE_PSQL_STDERR:
          'connection to server at "127.0.0.1", port 54322 failed: Operation not permitted\n',
        SPEC_0009_SCHEMA_SMOKE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        SPEC_0009_SCHEMA_SMOKE_PSQL: createFakePsql(),
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP SPEC-0009 schema smoke");
    },
    TEST_TIMEOUT_MS,
  );
});
