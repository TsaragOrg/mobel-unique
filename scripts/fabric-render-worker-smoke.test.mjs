import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./fabric-render-worker-smoke.mjs", import.meta.url)
);

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

describe("fabric render worker smoke script", () => {
  it("skips clearly when the local function is unreachable", async () => {
    const result = await runSmoke({
      FABRIC_RENDER_WORKER_FUNCTION_URL:
        "http://127.0.0.1:1/functions/v1/fabric-render-worker",
      FABRIC_RENDER_WORKER_SMOKE_TIMEOUT_MS: "250"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render worker smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when the function returns a succeeded job", async () => {
    const body = encodeURIComponent(
      JSON.stringify({
        job_id: "00000000-0000-4000-8000-000000000006",
        queue_name: "local_fabric_render_jobs",
        status: "succeeded",
        output_path:
          "fabric-render/00000000-0000-4000-8000-000000000006/output.png"
      })
    );
    const result = await runSmoke({
      FABRIC_RENDER_WORKER_FUNCTION_URL: `data:application/json,${body}`
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS fabric render worker smoke");
    expect(result.stdout).toContain("local_fabric_render_jobs");
    expect(result.stdout).toContain("output.png");
  });

  it("skips clearly when the local Supabase gateway has no served function", async () => {
    const server = createServer((request, response) => {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Function not found");
    });

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const result = await runSmoke({
        FABRIC_RENDER_WORKER_FUNCTION_URL: `http://127.0.0.1:${port}/functions/v1/fabric-render-worker`
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP fabric render worker smoke");
      expect(result.stdout).toContain("pnpm supabase:functions:serve");
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });
});
