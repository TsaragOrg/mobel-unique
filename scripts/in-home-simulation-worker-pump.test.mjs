import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0068 in-home simulation worker dispatch and checkpoint modes", () => {
  const source = readFileSync(workerPath, "utf8");

  it("parses only dispatch and checkpoint invocation modes", () => {
    expect(source).toContain("type WorkerMode = \"dispatch\" | \"checkpoint\"");
    expect(source).toContain("parseWorkerRequestBody");
    expect(source).toContain('mode === "dispatch"');
    expect(source).toContain('mode === "checkpoint"');
    expect(source).toContain("In-home simulation worker mode is invalid");
    expect(source).not.toContain('mode === "pump"');
    expect(source).not.toContain("legacy_queue");
  });

  it("uses dispatch mode as the no-body and no-mode recovery default", () => {
    const parseIndex = source.indexOf("async function parseWorkerRequestBody");
    const checkpointIndex = source.indexOf("async function handleCheckpointMode");
    const parseSource = source.slice(parseIndex, checkpointIndex);

    expect(parseIndex).toBeGreaterThan(-1);
    expect(checkpointIndex).toBeGreaterThan(parseIndex);
    expect(parseSource).toContain('return { mode: "dispatch" }');
    expect(source).not.toContain("dequeueRoomPrepMessages");
    expect(source).not.toContain("processClaimedJob(");
    expect(source).not.toContain("readCheckpointPumpStatus");
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
    expect(checkpointSource).toContain("invokeWorkerDispatch");
    expect(checkpointSource).toContain("finally");
  });

  it("drains transactional dispatch outbox rows in dispatch mode", () => {
    const dispatchIndex = source.indexOf("async function handleDispatchMode");
    const checkpointIndex = source.indexOf("async function handleCheckpointMode");
    const dispatchSource = source.slice(dispatchIndex, checkpointIndex);

    expect(dispatchIndex).toBeGreaterThan(-1);
    expect(checkpointIndex).toBeGreaterThan(dispatchIndex);
    expect(dispatchSource).toContain("claimCheckpointDispatches");
    expect(dispatchSource).toContain("recoverStaleCheckpointClaims");
    expect(dispatchSource).toContain("requeueStaleCheckpointDispatches");
    expect(dispatchSource).toContain("dispatch_mode_recovered_stale_work");
    expect(dispatchSource).toContain("IN_HOME_SIMULATION_DISPATCH_BATCH_SIZE");
    expect(dispatchSource).toContain("IN_HOME_SIMULATION_DISPATCH_LOCK_TTL_SECONDS");
    expect(dispatchSource).toContain("dispatchCheckpointFromOutbox");
    expect(source).toContain("claim_in_home_simulation_checkpoint_dispatches");
    expect(source).toContain("recover_stale_in_home_simulation_checkpoints");
    expect(source).toContain("requeue_stale_in_home_simulation_checkpoint_dispatches");
    expect(source).toContain("mark_in_home_simulation_checkpoint_dispatch_dispatched");
    expect(source).toContain("mark_in_home_simulation_checkpoint_dispatch_retryable");
  });

  it("does not keep request-time pump or legacy queue execution paths", () => {
    expect(source).not.toContain("async function handlePumpMode");
    expect(source).not.toContain("in_home_simulation_checkpoint_pump_status");
    expect(source).not.toContain("dequeue_in_home_simulation_room_prep_messages");
    expect(source).not.toContain("enqueue_in_home_simulation_room_prep_message");
    expect(source).not.toContain("release_in_home_simulation_room_prep_claim");
    expect(source).not.toContain("claim_specific_in_home_simulation_room_prep_job");
    expect(source).not.toContain("claim_specific_in_home_simulation_placement_job");
  });

  it("emits structured logs for dispatch, checkpoint, and provider boundaries", () => {
    expect(source).toContain("function logWorkerStep");
    expect(source).toContain("worker_request_received");
    expect(source).toContain("dispatch_mode_claimed_outbox_rows");
    expect(source).toContain("checkpoint_mode_claimed");
    expect(source).toContain("room_validation_provider_started");
    expect(source).toContain("room_cleaning_provider_started");
    expect(source).toContain("room_corners_provider_started");
    expect(source).toContain("dimension_guide_started");
    expect(source).toContain("placement_provider_started");
    expect(source).toContain("placement_finalize_started");
    expect(source).toContain("placement_persisted");
  });

  it("resolves prepared sofa bytes from the catalog storage asset when no copied path is present", () => {
    expect(source).toContain("type StorageAssetObjectRow");
    expect(source).toContain("fetchStorageAssetObject");
    expect(source).toContain("downloadStorageObjectFromBucket");
    expect(source).toContain("claim.prepared_sofa_asset_id");
    expect(source).toContain("placement_download_prepared_sofa_started");
  });

  it("uses checkpoint success RPCs when split room checkpoints advance", () => {
    expect(source).toContain("complete_in_home_simulation_checkpoint_claim");
    expect(source).toContain('nextCheckpointKey: "room_cleaning"');
    expect(source).toContain('nextCheckpointKey: "room_corners"');
    expect(source).toContain('nextCheckpointKey: "dimension_guide"');
    expect(source).toContain('nextCheckpointKey: "awaiting_dimensions"');
    expect(source).toContain('nextCheckpointKey: "placement_finalize"');
  });

  it("self-invokes through the in-home worker function URL and secret", () => {
    expect(source).toContain("resolveWorkerFunctionUrl");
    expect(source).toContain("IN_HOME_SIMULATION_WORKER_FUNCTION_URL");
    expect(source).toContain("configuredUrl.trim().length > 0");
    expect(source).toContain("buildWorkerInvocationHeaders");
    expect(source).toContain("IN_HOME_SIMULATION_WORKER_INVOKE_SECRET");
    expect(source).toContain("IN_HOME_SIMULATION_WORKER_INVOCATION_TIMEOUT_MS");
    expect(source).toContain("DEFAULT_WORKER_INVOCATION_TIMEOUT_MS");
    expect(source).toContain("x-in-home-simulation-worker-secret");
  });

  it("allows local worker invocations without the internal secret", () => {
    const validationIndex = source.indexOf("function validateWorkerInvocation");
    const callRpcIndex = source.indexOf("async function callRpc");
    const validationSource = source.slice(validationIndex, callRpcIndex);

    expect(validationIndex).toBeGreaterThan(-1);
    expect(callRpcIndex).toBeGreaterThan(validationIndex);
    expect(validationSource).toContain("if (isLocalWorkerEnvironment())");
    expect(validationSource).toContain("return null;");
    expect(validationSource.indexOf("if (isLocalWorkerEnvironment())")).toBeLessThan(
      validationSource.indexOf("if (!expectedSecret)")
    );
  });
});
