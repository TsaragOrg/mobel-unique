import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./local-worker-smoke.mjs", import.meta.url));

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

describe("local worker smoke script", () => {
  it("skips clearly when the local Edge Function is unreachable", async () => {
    const result = await runSmoke({
      WORKER_SMOKE_FUNCTION_URL: "http://127.0.0.1:1/functions/v1/worker-smoke",
      WORKER_SMOKE_TIMEOUT_MS: "250"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP local worker smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when the worker smoke function returns a processed job", async () => {
    const body = encodeURIComponent(
      JSON.stringify({
        job_id: "00000000-0000-4000-8000-000000000001",
        queue_name: "local_worker_smoke_jobs",
        status: "ok"
      })
    );
    const result = await runSmoke({
      WORKER_SMOKE_FUNCTION_URL: `data:application/json,${body}`
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS local worker smoke");
    expect(result.stdout).toContain("local_worker_smoke_jobs");
  });
});
