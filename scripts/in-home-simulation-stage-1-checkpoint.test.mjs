import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0053 Stage 1 checkpoint refactor", () => {
  it("declares the row-fetch and partial-persist helpers", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toContain("async function fetchInHomeSimulationJobRow(");
    expect(source).toContain("async function persistCleaningCheckpoint(");
    expect(source).toContain("type InHomeSimulationJobCheckpointRow");
    expect(source).toContain("room_normalized_path");
    expect(source).toContain("room_compressed_path");
    expect(source).toContain("room_cleaned_path");
    expect(source).toContain("room_geometry_points");
  });

  it("splits the worker into cleaning and corners checkpoints", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toContain("async function runCleaningCheckpoint(");
    expect(source).toContain("async function runCornersCheckpoint(");
  });

  it("processClaimedJob dispatches based on room_cleaned_path", async () => {
    const source = await readFile(workerPath, "utf8");

    const dispatchIndex = source.indexOf("async function processClaimedJob(");
    expect(dispatchIndex).toBeGreaterThan(-1);

    const cleaningIndex = source.indexOf(
      "async function runCleaningCheckpoint(",
      dispatchIndex
    );
    const dispatchSource = source.slice(dispatchIndex, cleaningIndex);

    expect(dispatchSource).toContain("fetchInHomeSimulationJobRow");
    expect(dispatchSource).toContain("if (!checkpoint.room_cleaned_path)");
    expect(dispatchSource).toContain("runCleaningCheckpoint");
    expect(dispatchSource).toContain("runCornersCheckpoint");
    expect(dispatchSource).toContain("stage_1_cleaning_checkpoint_advanced");
    expect(dispatchSource).toContain("stage_1_completed");
  });

  it("cleaning checkpoint releases the claim and re-enqueues without transitioning to awaiting_dimensions", async () => {
    const source = await readFile(workerPath, "utf8");

    const cleaningIndex = source.indexOf(
      "async function runCleaningCheckpoint("
    );
    const cornersIndex = source.indexOf(
      "async function runCornersCheckpoint(",
      cleaningIndex
    );
    expect(cleaningIndex).toBeGreaterThan(-1);
    expect(cornersIndex).toBeGreaterThan(cleaningIndex);

    const cleaningSource = source.slice(cleaningIndex, cornersIndex);

    // Cleaning step uploads the three cleaning-side artifacts.
    expect(cleaningSource).toContain("room_normalized.jpg");
    expect(cleaningSource).toContain("room_compressed.jpg");
    expect(cleaningSource).toContain("room_cleaned.png");

    // Cleaning step persists the three paths via the helper.
    expect(cleaningSource).toContain("persistCleaningCheckpoint");

    // Cleaning step releases the claim and re-enqueues a fresh pgmq message.
    expect(cleaningSource).toContain(
      '"release_in_home_simulation_room_prep_claim"'
    );
    expect(cleaningSource).toContain(
      '"enqueue_in_home_simulation_room_prep_message"'
    );

    // Cleaning step records a checkpoint event but never the awaiting_dimensions transition.
    expect(cleaningSource).toContain(
      "stage_1_cleaning_checkpoint_completed"
    );
    expect(cleaningSource).not.toContain(
      '"complete_in_home_simulation_room_prep_stage"'
    );
    expect(cleaningSource).not.toContain('toStatus: "awaiting_dimensions"');
  });

  it("corners checkpoint downloads the cleaned bytes, runs corners + lines, and calls the complete-stage RPC", async () => {
    const source = await readFile(workerPath, "utf8");

    const cornersIndex = source.indexOf(
      "async function runCornersCheckpoint("
    );
    expect(cornersIndex).toBeGreaterThan(-1);

    // Bound the corners section to the next top-level function.
    const nextFnIndex = source.indexOf("\nasync function ", cornersIndex + 1);
    const cornersSource = source.slice(
      cornersIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    expect(cornersSource).toContain("downloadStorageObject");
    expect(cornersSource).toContain("checkpoint.room_cleaned_path");
    expect(cornersSource).toContain("placeCornerDots");
    expect(cornersSource).toContain("detectYellowDots");
    expect(cornersSource).toContain("classifyDots");
    expect(cornersSource).toContain("drawDimensionLines");
    expect(cornersSource).toContain(
      '"complete_in_home_simulation_room_prep_stage"'
    );
  });

  it("corners checkpoint fails the job when the cleaned artifact is missing in storage", async () => {
    const source = await readFile(workerPath, "utf8");

    const cornersIndex = source.indexOf(
      "async function runCornersCheckpoint("
    );
    const nextFnIndex = source.indexOf("\nasync function ", cornersIndex + 1);
    const cornersSource = source.slice(
      cornersIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    expect(cornersSource).toContain('"cleaning_artifact_missing"');
    expect(cornersSource).toContain("failJobNonRetryable");
  });

  it("outer Deno.serve only emits the awaiting_dimensions transition when the corners checkpoint completes", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toContain(
      'if (checkpointOutcome === "stage_1_completed") {'
    );
    expect(source).toContain('toStatus: "awaiting_dimensions"');
    // The cleaning checkpoint return is mapped to job_status: "queued" in
    // the outer success envelope so the response body matches the actual
    // row state.
    expect(source).toContain('"awaiting_dimensions"');
    expect(source).toContain('"queued"');
  });

  it("processClaimedJob receives queueName so cleaning can re-enqueue", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toMatch(/processClaimedJob\([\s\S]*?queueName[\s\S]*?\)/);
  });
});
