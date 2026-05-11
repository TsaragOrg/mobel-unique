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
  it("placement generation uploads one provider output and enqueues placement measurement without measuring or final persistence", async () => {
    const source = await readFile(workerPath, "utf8");
    const generationSource = extractFunction(source, "processPlacementJob");

    expect(generationSource).toContain("providers.placement.placeSofa");
    expect(generationSource).toContain("readPlacementFeedbackState");
    expect(generationSource).toContain("placement_upload_output_started");
    expect(generationSource).toContain("uploadStorageObject");
    expect(generationSource).toContain("completeCheckpointClaim");
    expect(generationSource).toContain("placement_generation_next_checkpoint_ready");
    expect(generationSource).not.toContain("measureSofa");
    expect(generationSource).not.toContain(
      '"complete_in_home_simulation_placement_stage"'
    );
    expect(generationSource).not.toContain("placement_persisted");
  });

  it("placement measurement downloads the uploaded output, measures it, and either retries generation with feedback or advances to finalize", async () => {
    const source = await readFile(workerPath, "utf8");
    const measurementSource = extractFunction(
      source,
      "runPlacementMeasurementCheckpoint"
    );

    expect(measurementSource).toContain("placement_measurement_started");
    expect(measurementSource).toContain("downloadStorageObject");
    expect(measurementSource).toContain("providers.measurement");
    expect(measurementSource).toContain("measureSofa");
    expect(measurementSource).toContain("computeBackWallTargets");
    expect(measurementSource).toContain("isPlacementWithinTolerance");
    expect(measurementSource).toContain("buildPlacementFeedback");
    expect(measurementSource).toContain("writePlacementFeedbackState");
    expect(measurementSource).toContain(
      "retryGenerationCompletion.nextCheckpointKey"
    );
    expect(measurementSource).toContain("completion.nextCheckpointKey");
    expect(measurementSource).not.toContain("providers.placement.placeSofa");
    expect(measurementSource).not.toContain(
      '"complete_in_home_simulation_placement_stage"'
    );
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

  it("processClaimedCheckpoint dispatches placement generation, measurement, and finalize by explicit checkpoint key", async () => {
    const source = await readFile(workerPath, "utf8");
    const dispatchIndex = source.indexOf("async function processClaimedCheckpoint(");
    expect(dispatchIndex).toBeGreaterThan(-1);

    const nextFnIndex = source.indexOf(
      "\nasync function dispatchCheckpointFromOutbox",
      dispatchIndex
    );
    const dispatchSource = source.slice(dispatchIndex, nextFnIndex);

    expect(dispatchSource).toContain('claim.checkpoint_key === "placement_generation"');
    expect(dispatchSource).toContain('claim.checkpoint_key === "placement_measurement"');
    expect(dispatchSource).toContain('claim.checkpoint_key === "placement_finalize"');
    expect(dispatchSource).toContain("processPlacementJob");
    expect(dispatchSource).toContain("runPlacementMeasurementCheckpoint");
    expect(dispatchSource).toContain("runPlacementFinalizeCheckpoint");
    expect(dispatchSource).toContain('nextCheckpointKey: "placement_measurement"');
    expect(dispatchSource).toContain('nextCheckpointKey: "placement_finalize"');
    expect(dispatchSource).toContain('nextCheckpointKey: "completed"');
  });
});
