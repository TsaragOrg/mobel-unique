import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./enqueue-stage-1.mjs", import.meta.url));

function runScript({ args = [], env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "local-service-role-key",
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

function makeFixtureFile(extension) {
  const dir = mkdtempSync(join(tmpdir(), "mobel-sim-enqueue-test-"));
  const file = join(dir, `room${extension}`);
  writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  return file;
}

describe("sim:enqueue:stage1 cli", () => {
  it("fails clearly when --photo is missing", async () => {
    const result = await runScript();

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("missing --photo argument");
  });

  it("fails clearly when SUPABASE_URL is not local", async () => {
    const photo = makeFixtureFile(".jpg");
    const result = await runScript({
      args: ["--photo", photo],
      env: { SUPABASE_URL: "https://prod.supabase.co" }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "SUPABASE_URL must point at a local Supabase instance"
    );
  });

  it("fails clearly when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const photo = makeFixtureFile(".jpg");
    const result = await runScript({
      args: ["--photo", photo],
      env: { SUPABASE_SERVICE_ROLE_KEY: "" }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
  });

  it("fails clearly when the photo file does not exist", async () => {
    const result = await runScript({
      args: ["--photo", "/tmp/this-file-does-not-exist-mobel.jpg"]
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("photo file not found");
  });

  it("fails clearly when the photo extension is not supported", async () => {
    const photo = makeFixtureFile(".gif");
    const result = await runScript({
      args: ["--photo", photo]
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unsupported photo extension");
  });

  it("fails clearly when --retention-hours is out of range", async () => {
    const photo = makeFixtureFile(".jpg");
    const result = await runScript({
      args: ["--photo", photo, "--retention-hours", "48"]
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "retention hours must be a positive integer no greater than 24"
    );
  });

  it("fails clearly when an unknown flag is provided", async () => {
    const result = await runScript({
      args: ["--photo", "/tmp/x.jpg", "--bogus"]
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown flag: --bogus");
  });
});
