import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0068 in-home simulation worker checkpoint pump", () => {
  const source = readFileSync(workerPath, "utf8");

  it("parses explicit pump and checkpoint invocation modes", () => {
    expect(source).toContain("type WorkerMode = \"legacy_queue\" | \"pump\" | \"checkpoint\"");
    expect(source).toContain("parseWorkerRequestBody");
    expect(source).toContain('mode === "pump"');
    expect(source).toContain('mode === "checkpoint"');
    expect(source).toContain("In-home simulation worker mode is invalid");
  });

  it("keeps legacy queue mode as the no-mode fallback during migration", () => {
    expect(source).toContain("return { mode: \"legacy_queue\" }");
    expect(source).toContain("dequeueRoomPrepMessages");
  });

  it("implements pump mode as short orchestration without provider work", () => {
    const pumpIndex = source.indexOf("async function handlePumpMode");
    const checkpointIndex = source.indexOf("async function handleCheckpointMode");
    const pumpSource = source.slice(pumpIndex, checkpointIndex);

    expect(pumpIndex).toBeGreaterThan(-1);
    expect(checkpointIndex).toBeGreaterThan(pumpIndex);
    expect(source).toContain("in_home_simulation_checkpoint_pump_status");
    expect(pumpSource).toContain("readCheckpointPumpStatus");
    expect(pumpSource).toContain("IN_HOME_SIMULATION_MAX_ACTIVE_CHECKPOINTS");
    expect(pumpSource).toContain("available_slots");
    expect(pumpSource).toContain("invokeWorkerCheckpoint");
    expect(pumpSource).toContain("deferWorkerInvocation");
    expect(pumpSource).not.toContain("selectStage1Providers");
    expect(pumpSource).not.toContain("selectStage2Providers");
    expect(pumpSource).not.toContain("processClaimedJob(");
    expect(pumpSource).not.toContain("processPlacementJob(");
  });

  it("claims one durable checkpoint in checkpoint mode", () => {
    const checkpointIndex = source.indexOf("async function handleCheckpointMode");
    const serveIndex = source.indexOf("Deno.serve");
    const checkpointSource = source.slice(checkpointIndex, serveIndex);

    expect(checkpointIndex).toBeGreaterThan(-1);
    expect(serveIndex).toBeGreaterThan(checkpointIndex);
    expect(checkpointSource).toContain("claimCheckpointJob");
    expect(checkpointSource).toContain("processClaimedCheckpoint");
    expect(source).toContain("release_in_home_simulation_checkpoint_claim");
    expect(checkpointSource).toContain("releaseCheckpointClaim");
    expect(checkpointSource).toContain("invokeWorkerPump");
    expect(checkpointSource).toContain("finally");
  });

  it("uses checkpoint success RPCs when split room checkpoints advance", () => {
    expect(source).toContain("complete_in_home_simulation_checkpoint_claim");
    expect(source).toContain('nextCheckpointKey: "room_cleaning"');
    expect(source).toContain('nextCheckpointKey: "room_corners"');
    expect(source).toContain('nextCheckpointKey: "awaiting_dimensions"');
  });

  it("self-invokes through the in-home worker function URL and secret", () => {
    expect(source).toContain("resolveWorkerFunctionUrl");
    expect(source).toContain("IN_HOME_SIMULATION_WORKER_FUNCTION_URL");
    expect(source).toContain("buildWorkerInvocationHeaders");
    expect(source).toContain("IN_HOME_SIMULATION_WORKER_INVOKE_SECRET");
    expect(source).toContain("x-in-home-simulation-worker-secret");
  });
});
