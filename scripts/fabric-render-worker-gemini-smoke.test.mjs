import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./fabric-render-worker-gemini-smoke.mjs", import.meta.url)
);

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        FABRIC_RENDER_ENABLE_GEMINI_SMOKE: undefined,
        GEMINI_API_KEY: undefined,
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

describe("fabric render worker Gemini smoke script", () => {
  it("skips when GEMINI_API_KEY is missing", async () => {
    const result = await runSmoke({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
    expect(result.stdout).toContain("GEMINI_API_KEY");
  });

  it("skips when Gemini smoke is not explicitly enabled", async () => {
    const result = await runSmoke({
      GEMINI_API_KEY: "test-key"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
    expect(result.stdout).toContain("FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1");
  });

  it("passes when the function returns a succeeded Gemini job", async () => {
    const body = encodeURIComponent(
      JSON.stringify({
        job_id: "00000000-0000-4000-8000-000000000007",
        queue_name: "local_fabric_render_jobs",
        status: "succeeded",
        output_path:
          "fabric-render/00000000-0000-4000-8000-000000000007/output.png"
      })
    );
    const result = await runSmoke({
      FABRIC_RENDER_ENABLE_GEMINI_SMOKE: "1",
      FABRIC_RENDER_WORKER_FUNCTION_URL: `data:application/json,${body}`,
      GEMINI_API_KEY: "test-key"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS fabric render Gemini smoke");
    expect(result.stdout).toContain("output.png");
  });
});
