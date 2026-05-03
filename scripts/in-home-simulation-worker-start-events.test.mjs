import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0056 + PLAN-0058 worker emits checkpoint-started events", () => {
  it("runValidateCheckpoint emits stage_1_validate_checkpoint_started before validateRoom", async () => {
    const source = await readFile(workerPath, "utf8");

    const fnIndex = source.indexOf("async function runValidateCheckpoint(");
    expect(fnIndex).toBeGreaterThan(-1);
    const nextFnIndex = source.indexOf("\nasync function ", fnIndex + 1);
    const fnSource = source.slice(
      fnIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    const startEventIndex = fnSource.indexOf(
      "stage_1_validate_checkpoint_started"
    );
    const validateRoomIndex = fnSource.indexOf("validateRoom");
    expect(startEventIndex).toBeGreaterThan(-1);
    expect(validateRoomIndex).toBeGreaterThan(-1);
    expect(startEventIndex).toBeLessThan(validateRoomIndex);
  });

  it("runCleaningCheckpoint emits stage_1_cleaning_checkpoint_started", async () => {
    const source = await readFile(workerPath, "utf8");

    const fnIndex = source.indexOf("async function runCleaningCheckpoint(");
    expect(fnIndex).toBeGreaterThan(-1);
    const nextFnIndex = source.indexOf("\nasync function ", fnIndex + 1);
    const fnSource = source.slice(
      fnIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    const startEventIndex = fnSource.indexOf(
      "stage_1_cleaning_checkpoint_started"
    );
    const cleanRoomIndex = fnSource.indexOf("providers.cleaning.cleanRoom");
    expect(startEventIndex).toBeGreaterThan(-1);
    expect(cleanRoomIndex).toBeGreaterThan(-1);
    // Start event must precede the long OpenAI fetch so observability
    // is preserved when the isolate dies mid-fetch.
    expect(startEventIndex).toBeLessThan(cleanRoomIndex);
  });

  it("runCornersCheckpoint emits stage_1_corners_checkpoint_started", async () => {
    const source = await readFile(workerPath, "utf8");

    const fnIndex = source.indexOf("async function runCornersCheckpoint(");
    expect(fnIndex).toBeGreaterThan(-1);
    const nextFnIndex = source.indexOf("\nasync function ", fnIndex + 1);
    const fnSource = source.slice(
      fnIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    const startEventIndex = fnSource.indexOf(
      "stage_1_corners_checkpoint_started"
    );
    const placeCornerDotsIndex = fnSource.indexOf("placeCornerDots");
    expect(startEventIndex).toBeGreaterThan(-1);
    expect(placeCornerDotsIndex).toBeGreaterThan(-1);
    expect(startEventIndex).toBeLessThan(placeCornerDotsIndex);
  });

  it("processPlacementJob emits stage_2_placement_started", async () => {
    const source = await readFile(workerPath, "utf8");

    const fnIndex = source.indexOf("async function processPlacementJob(");
    expect(fnIndex).toBeGreaterThan(-1);
    const nextFnIndex = source.indexOf("\nasync function ", fnIndex + 1);
    const fnSource = source.slice(
      fnIndex,
      nextFnIndex > -1 ? nextFnIndex : source.length
    );

    const startEventIndex = fnSource.indexOf("stage_2_placement_started");
    const placeSofaIndex = fnSource.indexOf("placeSofa");
    expect(startEventIndex).toBeGreaterThan(-1);
    expect(placeSofaIndex).toBeGreaterThan(-1);
    expect(startEventIndex).toBeLessThan(placeSofaIndex);
  });
});

describe("PLAN-0056 providers wired through openai-fetch helper", () => {
  it("openai-cleaning calls openaiFetchWithTimeout instead of raw fetch", async () => {
    const source = await readFile(
      "supabase/functions/in-home-simulation-worker/lib/providers/openai-cleaning.ts",
      "utf8"
    );

    expect(source).toContain('from "./openai-fetch.ts"');
    expect(source).toContain("openaiFetchWithTimeout");
    expect(source).not.toMatch(/await fetch\(`\$\{OPENAI_API_BASE\}/);
  });

  it("openai-corners calls openaiFetchWithTimeout instead of raw fetch", async () => {
    const source = await readFile(
      "supabase/functions/in-home-simulation-worker/lib/providers/openai-corners.ts",
      "utf8"
    );

    expect(source).toContain('from "./openai-fetch.ts"');
    expect(source).toContain("openaiFetchWithTimeout");
    expect(source).not.toMatch(/await fetch\(`\$\{OPENAI_API_BASE\}/);
  });

  it("openai-placement calls openaiFetchWithTimeout instead of raw fetch", async () => {
    const source = await readFile(
      "supabase/functions/in-home-simulation-worker/lib/providers/openai-placement.ts",
      "utf8"
    );

    expect(source).toContain('from "./openai-fetch.ts"');
    expect(source).toContain("openaiFetchWithTimeout");
    expect(source).not.toMatch(/await fetch\(`\$\{OPENAI_API_BASE\}/);
  });

  it("openai-vision calls openaiFetchWithTimeout instead of raw fetch", async () => {
    const source = await readFile(
      "supabase/functions/in-home-simulation-worker/lib/providers/openai-vision.ts",
      "utf8"
    );

    expect(source).toContain('from "./openai-fetch.ts"');
    expect(source).toContain("openaiFetchWithTimeout");
    expect(source).not.toMatch(/await fetch\(`\$\{OPENAI_API_BASE\}/);
  });

  it("openai-placement-measurement calls openaiFetchWithTimeout instead of raw fetch", async () => {
    const source = await readFile(
      "supabase/functions/in-home-simulation-worker/lib/providers/openai-placement-measurement.ts",
      "utf8"
    );

    expect(source).toContain('from "./openai-fetch.ts"');
    expect(source).toContain("openaiFetchWithTimeout");
    expect(source).not.toMatch(/await fetch\(`\$\{OPENAI_API_BASE\}/);
  });
});
