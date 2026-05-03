import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0053 + PLAN-0058 Stage 1 checkpoint refactor", () => {
  it("declares the row-fetch and partial-persist helpers", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toContain("async function fetchInHomeSimulationJobRow(");
    expect(source).toContain("async function persistValidateCheckpoint(");
    expect(source).toContain("async function persistCleaningCheckpoint(");
    expect(source).toContain("type InHomeSimulationJobCheckpointRow");
    expect(source).toContain("room_normalized_path");
    expect(source).toContain("room_compressed_path");
    expect(source).toContain("room_cleaned_path");
    expect(source).toContain("room_geometry_points");
  });

  it("splits the worker into validate, cleaning, and corners checkpoints", async () => {
    const source = await readFile(workerPath, "utf8");

    expect(source).toContain("async function runValidateCheckpoint(");
    expect(source).toContain("async function runCleaningCheckpoint(");
    expect(source).toContain("async function runCornersCheckpoint(");
  });

  it("processClaimedJob dispatches validate → cleaning → corners by checkpoint paths", async () => {
    const source = await readFile(workerPath, "utf8");

    const dispatchIndex = source.indexOf("async function processClaimedJob(");
    expect(dispatchIndex).toBeGreaterThan(-1);

    const validateIndex = source.indexOf(
      "async function runValidateCheckpoint(",
      dispatchIndex
    );
    const dispatchSource = source.slice(dispatchIndex, validateIndex);

    expect(dispatchSource).toContain("fetchInHomeSimulationJobRow");
    expect(dispatchSource).toContain(
      "!checkpoint.room_normalized_path"
    );
    expect(dispatchSource).toContain("if (!checkpoint.room_cleaned_path)");
    expect(dispatchSource).toContain("runValidateCheckpoint");
    expect(dispatchSource).toContain("runCleaningCheckpoint");
    expect(dispatchSource).toContain("runCornersCheckpoint");
    expect(dispatchSource).toContain("stage_1_validate_checkpoint_advanced");
    expect(dispatchSource).toContain("stage_1_cleaning_checkpoint_advanced");
    expect(dispatchSource).toContain("stage_1_completed");
  });

  it("validate checkpoint runs decode + normalize + validation + compress, persists normalized + compressed paths, releases the claim", async () => {
    const source = await readFile(workerPath, "utf8");

    const validateIndex = source.indexOf(
      "async function runValidateCheckpoint("
    );
    const cleaningIndex = source.indexOf(
      "async function runCleaningCheckpoint(",
      validateIndex
    );
    expect(validateIndex).toBeGreaterThan(-1);
    expect(cleaningIndex).toBeGreaterThan(validateIndex);

    const validateSource = source.slice(validateIndex, cleaningIndex);

    expect(validateSource).toContain("validateRoom");
    expect(validateSource).toContain("room_normalized.jpg");
    expect(validateSource).toContain("room_compressed.jpg");
    expect(validateSource).toContain("persistValidateCheckpoint");
    expect(validateSource).not.toContain("cleanRoom");
    expect(validateSource).toContain(
      '"release_in_home_simulation_room_prep_claim"'
    );
    expect(validateSource).toContain(
      '"enqueue_in_home_simulation_room_prep_message"'
    );
    expect(validateSource).toContain(
      "stage_1_validate_checkpoint_completed"
    );
  });

  it("cleaning checkpoint downloads the compressed bytes, runs only cleanRoom, persists cleaned path, re-enqueues", async () => {
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

    // Cleaning step downloads the compressed bytes (not the original).
    expect(cleaningSource).toContain("checkpoint.room_compressed_path");
    expect(cleaningSource).toContain("cleanRoom");
    expect(cleaningSource).toContain("room_cleaned.png");

    // No more validation or compression here.
    expect(cleaningSource).not.toContain("validateRoom");
    expect(cleaningSource).not.toContain("encodeJPEG(NORMALIZED");

    // Persists only the cleaned path now.
    expect(cleaningSource).toContain("persistCleaningCheckpoint");
    expect(cleaningSource).toContain("roomCleanedPath");

    // Releases claim and re-enqueues for next checkpoint.
    expect(cleaningSource).toContain(
      '"release_in_home_simulation_room_prep_claim"'
    );
    expect(cleaningSource).toContain(
      '"enqueue_in_home_simulation_room_prep_message"'
    );

    // Records cleaning-completed event, never the awaiting_dimensions transition.
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
