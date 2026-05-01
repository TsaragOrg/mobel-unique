import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./in-home-simulation-stage-1-smoke.mjs", import.meta.url)
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

function dataUrlFor(body) {
  return `data:application/json,${encodeURIComponent(JSON.stringify(body))}`;
}

describe("in-home simulation stage 1 smoke script", () => {
  it("skips clearly when the local Edge Function is unreachable", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL:
        "http://127.0.0.1:1/functions/v1/in-home-simulation-worker",
      IN_HOME_SIMULATION_STAGE_1_TIMEOUT_MS: "250"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SKIP in-home simulation stage 1 smoke");
    expect(result.stdout).toContain("pnpm supabase:start");
  });

  it("passes when the worker reports a noop because no Stage 1 job is queued", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "in-home-simulation-worker",
        stage: "stage_1",
        status: "noop",
        processed: 0
      })
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS in-home simulation stage 1 smoke");
    expect(result.stdout).toContain("outcome=noop");
  });

  it("passes when the worker reports a claimed Stage 1 job", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "in-home-simulation-worker",
        stage: "stage_1",
        status: "claimed",
        processed: 1,
        job_id: "00000000-0000-4000-8000-000000000007",
        job_status: "room_prep_processing"
      })
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS in-home simulation stage 1 smoke");
    expect(result.stdout).toContain("outcome=claimed");
    expect(result.stdout).toContain("processed=1");
  });

  it("passes when the worker reports a completed Stage 1 job", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "in-home-simulation-worker",
        stage: "stage_1",
        status: "completed",
        processed: 1,
        job_id: "00000000-0000-4000-8000-000000000007",
        job_status: "awaiting_dimensions"
      })
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS in-home simulation stage 1 smoke");
    expect(result.stdout).toContain("outcome=completed");
    expect(result.stdout).toContain("processed=1");
  });

  it("fails when the response is not for the in-home-simulation-worker function", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "worker-smoke",
        stage: "stage_1",
        status: "noop",
        processed: 0
      })
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unexpected function_name");
  });

  it("fails when the response is not a Stage 1 outcome", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "in-home-simulation-worker",
        stage: "stage_2",
        status: "completed",
        processed: 1
      })
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("expected stage_1 response");
  });

  it("fails when the outcome is not one of the allowed Stage 1 outcomes", async () => {
    const result = await runSmoke({
      IN_HOME_SIMULATION_STAGE_1_FUNCTION_URL: dataUrlFor({
        function_name: "in-home-simulation-worker",
        stage: "stage_1",
        status: "failed",
        processed: 0,
        error: "boom"
      })
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unexpected stage 1 outcome");
  });
});
