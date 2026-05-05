import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./fabric-render-worker-gemini-smoke.mjs", import.meta.url),
);

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        FABRIC_RENDER_ENABLE_GEMINI_SMOKE: undefined,
        GEMINI_API_KEY: undefined,
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

describe("fabric render worker Gemini smoke script", () => {
  it("skips when GEMINI_API_KEY is missing", async () => {
    const result = await runSmoke({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
    expect(result.stdout).toContain("GEMINI_API_KEY");
  });

  it("skips when Gemini smoke is not explicitly enabled", async () => {
    const result = await runSmoke({
      GEMINI_API_KEY: "test-key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
    expect(result.stdout).toContain("FABRIC_RENDER_ENABLE_GEMINI_SMOKE=1");
  });

  it("skips when the Gemini smoke request_id is missing", async () => {
    const result = await runSmoke({
      FABRIC_RENDER_ENABLE_GEMINI_SMOKE: "1",
      GEMINI_API_KEY: "test-key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
    expect(result.stdout).toContain("FABRIC_RENDER_WORKER_SMOKE_REQUEST_ID");
  });

  it("passes when the function starts a Gemini pump request", async () => {
    const body = encodeURIComponent(
      JSON.stringify({
        mode: "pump",
        request_id: "00000000-0000-4000-8000-000000000007",
        started_count: 1,
        status: "started",
      }),
    );
    const result = await runSmoke({
      FABRIC_RENDER_ENABLE_GEMINI_SMOKE: "1",
      FABRIC_RENDER_WORKER_FUNCTION_URL: `data:application/json,${body}`,
      FABRIC_RENDER_WORKER_SMOKE_REQUEST_ID:
        "00000000-0000-4000-8000-000000000007",
      GEMINI_API_KEY: "test-key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS fabric render Gemini smoke");
    expect(result.stdout).toContain("00000000-0000-4000-8000-000000000007");
  });

  it("sends the worker invocation secret header when configured", async () => {
    let receivedSecret = null;
    let receivedBody = null;
    const server = createServer((request, response) => {
      receivedSecret = request.headers["x-fabric-render-worker-secret"] ?? null;
      request.on("data", (chunk) => {
        receivedBody = JSON.parse(String(chunk));
      });
      response.writeHead(200, {
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify({
          mode: "pump",
          request_id: "00000000-0000-4000-8000-000000000007",
          started_count: 1,
          status: "started",
        }),
      );
    });

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const result = await runSmoke({
        FABRIC_RENDER_ENABLE_GEMINI_SMOKE: "1",
        FABRIC_RENDER_WORKER_FUNCTION_URL: `http://127.0.0.1:${port}/functions/v1/fabric-render-worker`,
        FABRIC_RENDER_WORKER_INVOKE_SECRET: "local-secret",
        FABRIC_RENDER_WORKER_SMOKE_REQUEST_ID:
          "00000000-0000-4000-8000-000000000007",
        GEMINI_API_KEY: "test-key",
      });

      expect(result.status).toBe(0);
      expect(receivedSecret).toBe("local-secret");
      expect(receivedBody).toMatchObject({
        mode: "pump",
        request_id: "00000000-0000-4000-8000-000000000007",
      });
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  it("skips clearly when no Gemini job is queued", async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, {
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify({
          mode: "pump",
          request_id: "00000000-0000-4000-8000-000000000007",
          started_count: 0,
          status: "idle",
        }),
      );
    });

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const result = await runSmoke({
        FABRIC_RENDER_ENABLE_GEMINI_SMOKE: "1",
        FABRIC_RENDER_WORKER_FUNCTION_URL: `http://127.0.0.1:${port}/functions/v1/fabric-render-worker`,
        FABRIC_RENDER_WORKER_SMOKE_REQUEST_ID:
          "00000000-0000-4000-8000-000000000007",
        GEMINI_API_KEY: "test-key",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SKIP fabric render Gemini smoke");
      expect(result.stdout).toContain("no queued Gemini fabric render job");
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });
});
