import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

function createFakeDocker() {
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-0009-docker-test-"));
  const fakeDockerPath = join(cwd, "fake-docker.mjs");

  writeFileSync(
    fakeDockerPath,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";

if (process.env.FAKE_DOCKER_ARGS_PATH) {
  writeFileSync(
    process.env.FAKE_DOCKER_ARGS_PATH,
    JSON.stringify(process.argv.slice(2)),
  );
}

process.stdout.write(process.env.FAKE_DOCKER_STDOUT ?? "");
process.stderr.write(process.env.FAKE_DOCKER_STDERR ?? "");
process.exit(Number(process.env.FAKE_DOCKER_STATUS ?? "0"));
`,
  );
  chmodSync(fakeDockerPath, 0o755);

  return fakeDockerPath;
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
  it("checks the catalog image variant table and public medium render safety rules", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).toContain('"storage_asset_variants"');
    expect(source).toContain('"storage_asset_variants_variant_asset_id_unique_idx"');
    expect(source).toContain("missing storage asset variant uniqueness rule");
    expect(source).toContain("render_medium_content_type");
    expect(source).toContain("medium_variant.variant_kind = 'medium'");
    expect(source).toContain("original_asset.lifecycle_state = 'active'");
    expect(source).toContain("medium_asset.lifecycle_state = 'active'");
    expect(source).toContain("SPEC-0009 Stale Render Cell Sofa");
    expect(source).toContain(
      "admin_unpublish_sofa rejected a stale non-public render cell",
    );
    expect(source).toContain(
      '"create_public_simulation_email_verification_request"',
    );
    expect(source).toContain('"verify_public_simulation_auth_otp_session"');
    expect(source).toContain('"purge_public_simulation_email_handoffs"');
  });

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

  it(
    "falls back to the Supabase database container when local psql is missing",
    async () => {
      const dockerArgsPath = join(
        mkdtempSync(join(tmpdir(), "mobel-spec-0009-docker-args-")),
        "args.json",
      );
      const result = await runSmoke({
        FAKE_DOCKER_ARGS_PATH: dockerArgsPath,
        PATH: "",
        SPEC_0009_SCHEMA_SMOKE_DOCKER: createFakeDocker(),
        SPEC_0009_SCHEMA_SMOKE_PROJECT_ID: "mobel-unique",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS SPEC-0009 schema smoke");

      const dockerArgs = JSON.parse(readFileSync(dockerArgsPath, "utf8"));
      expect(dockerArgs.slice(0, 5)).toEqual([
        "exec",
        "-i",
        "supabase_db_mobel-unique",
        "psql",
        "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
      ]);
    },
    TEST_TIMEOUT_MS,
  );
});
