import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  expect(start, `${name} is present`).toBeGreaterThan(-1);

  const nextFn = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, nextFn > -1 ? nextFn : source.length);
}

describe("PLAN-0068 Stage 2 checkpoint refactor", () => {
  it("placement generation uploads the provider output and enqueues placement finalize without final persistence", async () => {
    const source = await readFile(workerPath, "utf8");
    const generationSource = extractFunction(source, "processPlacementJob");

    expect(generationSource).toContain("providers.placement.placeSofa");
    expect(generationSource).toContain("placement_upload_output_started");
    expect(generationSource).toContain("uploadStorageObject");
    expect(generationSource).toContain("completeCheckpointClaim");
    expect(generationSource).toContain("placement_generation_next_checkpoint_ready");
    expect(generationSource).not.toContain(
      '"complete_in_home_simulation_placement_stage"'
    );
    expect(generationSource).not.toContain("placement_persisted");
  });

  it("placement finalize downloads the uploaded output, persists the placement stage, and completes the checkpoint", async () => {
    const source = await readFile(workerPath, "utf8");
    const finalizeSource = extractFunction(
      source,
      "runPlacementFinalizeCheckpoint"
    );

    expect(finalizeSource).toContain("placement_finalize_started");
    expect(finalizeSource).toContain("downloadStorageObject");
    expect(finalizeSource).toContain("placement_finalize_decode_output_started");
    expect(finalizeSource).toContain(
      '"complete_in_home_simulation_placement_stage"'
    );
    expect(finalizeSource).toContain("placement_persisted");
    expect(finalizeSource).toContain("completeCheckpointClaim");
    expect(finalizeSource).toContain("placement_finalize_next_checkpoint_ready");
    expect(finalizeSource).not.toContain("providers.placement.placeSofa");
    expect(finalizeSource).not.toContain("uploadStorageObject");
  });

  it("processClaimedCheckpoint dispatches placement generation and finalize by explicit checkpoint key", async () => {
    const source = await readFile(workerPath, "utf8");
    const dispatchIndex = source.indexOf("async function processClaimedCheckpoint(");
    expect(dispatchIndex).toBeGreaterThan(-1);

    const nextFnIndex = source.indexOf(
      "\nasync function dispatchCheckpointFromOutbox",
      dispatchIndex
    );
    const dispatchSource = source.slice(dispatchIndex, nextFnIndex);

    expect(dispatchSource).toContain('claim.checkpoint_key === "placement_generation"');
    expect(dispatchSource).toContain('claim.checkpoint_key === "placement_finalize"');
    expect(dispatchSource).toContain("processPlacementJob");
    expect(dispatchSource).toContain("runPlacementFinalizeCheckpoint");
    expect(dispatchSource).toContain('nextCheckpointKey: "placement_finalize"');
    expect(dispatchSource).toContain('nextCheckpointKey: "completed"');
  });
});
