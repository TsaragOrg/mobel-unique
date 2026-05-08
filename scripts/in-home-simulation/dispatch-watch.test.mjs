import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./dispatch-watch.mjs", import.meta.url)
);

function runScript({ args = [], env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        SUPABASE_URL: "http://127.0.0.1:54321",
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

function startWorkerServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        close: () => new Promise((done) => server.close(done)),
        url: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

describe("sim:dispatch cli", () => {
  it("fails clearly when SUPABASE_URL is not local", async () => {
    const result = await runScript({
      args: ["--once"],
      env: { SUPABASE_URL: "https://prod.supabase.co" }
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "SUPABASE_URL must point at a local Supabase instance"
    );
  });

  it("fails clearly when the interval is too small", async () => {
    const result = await runScript({
      args: ["--interval-ms", "10"]
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--interval-ms must be an integer");
  });

  it("dispatches one local worker request in once mode", async () => {
    let requestBody = "";
    const worker = await startWorkerServer((request, response) => {
      expect(request.method).toBe("POST");
      expect(request.url).toBe("/functions/v1/in-home-simulation-worker");

      request.on("data", (chunk) => {
        requestBody += chunk;
      });
      request.on("end", () => {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            function_name: "in-home-simulation-worker",
            processed: 1,
            queued: 0,
            started_count: 1,
            status: "claimed"
          })
        );
      });
    });

    try {
      const result = await runScript({
        args: ["--once"],
        env: { SUPABASE_URL: worker.url }
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS sim:dispatch:once");
      expect(result.stdout).toContain("processed=1");
      expect(JSON.parse(requestBody)).toEqual({ mode: "dispatch" });
    } finally {
      await worker.close();
    }
  });
});
