import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";
const planPath =
  "docs/plans/active/PLAN-0068-in-home-simulation-checkpoint-pump-realtime.md";

const terminalOrVisitorActionKeys = new Set([
  "awaiting_dimensions",
  "completed",
  "failed",
  "expired",
]);

const intentionallyUnhandledExecutableKeys = [
  "dimension_guide",
  "placement_measurement",
  "placement_finalize",
];

function extractCheckpointKeys(source) {
  const match = source.match(/type SimulationCheckpointKey =([\s\S]*?);/);
  expect(match, "SimulationCheckpointKey union is present").not.toBeNull();
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function extractProcessClaimedCheckpointSource(source) {
  const start = source.indexOf("async function processClaimedCheckpoint(");
  const end = source.indexOf(
    "\nasync function dispatchCheckpointFromOutbox",
    start,
  );
  expect(start, "processClaimedCheckpoint function is present").toBeGreaterThan(
    -1,
  );
  expect(end, "processClaimedCheckpoint slice end is present").toBeGreaterThan(
    start,
  );
  return source.slice(start, end);
}

function extractHandledCheckpointKeys(processSource) {
  return [
    ...processSource.matchAll(/claim\.checkpoint_key === "([^"]+)"/g),
  ].map((entry) => entry[1]);
}

describe("PLAN-0068 checkpoint handler coverage audit", () => {
  const workerSource = readFileSync(workerPath, "utf8");
  const planSource = readFileSync(planPath, "utf8");
  const checkpointKeys = extractCheckpointKeys(workerSource);
  const processSource = extractProcessClaimedCheckpointSource(workerSource);
  const handledKeys = extractHandledCheckpointKeys(processSource);

  it("keeps every non-terminal checkpoint key handled or explicitly justified", () => {
    const executableKeys = checkpointKeys.filter(
      (key) => !terminalOrVisitorActionKeys.has(key),
    );
    const unhandledExecutableKeys = executableKeys.filter(
      (key) => !handledKeys.includes(key),
    );

    expect(unhandledExecutableKeys).toEqual(
      intentionallyUnhandledExecutableKeys,
    );
    for (const key of intentionallyUnhandledExecutableKeys) {
      expect(planSource).toContain(`\`${key}\``);
      expect(planSource).toContain("intentionally unhandled");
    }
  });

  it("does not accidentally handle terminal or visitor-action sentinel keys", () => {
    const handledSentinelKeys = handledKeys.filter((key) =>
      terminalOrVisitorActionKeys.has(key)
    );

    expect(handledSentinelKeys).toEqual([]);
  });

  it("keeps handler keys declared in the worker checkpoint union", () => {
    for (const key of handledKeys) {
      expect(checkpointKeys).toContain(key);
    }
    expect(processSource).toContain(
      "throw new Error(`unsupported checkpoint ${claim.checkpoint_key}`)",
    );
  });
});
