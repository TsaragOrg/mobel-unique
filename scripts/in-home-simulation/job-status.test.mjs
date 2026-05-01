import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./job-status.mjs", import.meta.url));

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

describe("sim:status cli", () => {
  it("fails clearly when no job id is given", async () => {
    const result = await runScript();

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("missing job id");
  });

  it("fails clearly when the job id is not a UUID", async () => {
    const result = await runScript({ args: ["not-a-uuid"] });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("job id is not a valid UUID");
  });

  it("fails clearly when SUPABASE_URL is not local", async () => {
    const result = await runScript({
      args: ["00000000-0000-4000-8000-000000000001"],
      env: { SUPABASE_URL: "https://prod.supabase.co" }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "SUPABASE_URL must point at a local Supabase instance"
    );
  });

  it("fails clearly when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const result = await runScript({
      args: ["00000000-0000-4000-8000-000000000001"],
      env: { SUPABASE_SERVICE_ROLE_KEY: "" }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
  });
});
