import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./recover-expired.mjs", import.meta.url)
);

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
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stderr, stdout }));
  });
}

describe("sim:recover-expired cli", () => {
  it("fails when SUPABASE_URL is not local", async () => {
    const result = await runScript({
      env: { SUPABASE_URL: "https://prod.supabase.co" }
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "SUPABASE_URL must point at a local Supabase instance"
    );
  });

  it("fails when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const result = await runScript({
      env: { SUPABASE_SERVICE_ROLE_KEY: "" }
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
  });

  it("rejects an invalid --batch-size", async () => {
    const result = await runScript({ args: ["--batch-size", "0"] });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "--batch-size must be a positive integer"
    );
  });

  it("fails on unknown flags", async () => {
    const result = await runScript({ args: ["--bogus"] });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown flag: --bogus");
  });
});
