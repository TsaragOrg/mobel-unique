import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workerPath = "supabase/functions/in-home-simulation-worker/index.ts";

describe("PLAN-0057 worker uses supabaseFetchWithTimeout for every internal call", () => {
  it("imports the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    expect(source).toContain('from "./lib/supabase-fetch.ts"');
    expect(source).toContain("supabaseFetchWithTimeout");
  });

  it("has zero remaining naked `await fetch(` calls", async () => {
    const source = await readFile(workerPath, "utf8");
    const matches = source.match(/await fetch\(/g) ?? [];
    expect(matches.length).toBe(0);
  });

  it("wraps callRpc through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf("async function callRpc");
    const closeIndex = source.indexOf("\n}\n", fnIndex);
    const body = source.slice(fnIndex, closeIndex);
    expect(body).toContain("supabaseFetchWithTimeout");
  });

  it("wraps storage download/upload through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    expect(
      source.indexOf("async function downloadStorageObject")
    ).toBeGreaterThan(-1);
    expect(
      source.indexOf("async function uploadStorageObject")
    ).toBeGreaterThan(-1);
    expect(
      source.match(/supabaseFetchWithTimeout\(\s*`\$\{supabaseUrl\}\/storage/g)
        ?.length ?? 0
    ).toBeGreaterThanOrEqual(2);
  });

  it("uses service-role apikey headers for storage uploads", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf("async function uploadStorageObject");
    const nextFnIndex = source.indexOf("\nasync function ", fnIndex + 1);
    const body = source.slice(fnIndex, nextFnIndex);

    expect(body).toContain('"Authorization": `Bearer ${serviceRoleKey}`');
    expect(body).toContain('"apikey": serviceRoleKey');
    expect(body).toContain('"x-upsert": "true"');
  });

  it("wraps recordWorkerEvent through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf("async function recordWorkerEvent");
    const closeIndex = source.indexOf("\n}\n", fnIndex);
    const body = source.slice(fnIndex, closeIndex);
    expect(body).toContain("supabaseFetchWithTimeout");
    expect(body).toContain("worker_job_events");
  });

  it("wraps failJobNonRetryable PATCH through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf("async function failJobNonRetryable");
    const closeIndex = source.indexOf("\n}\n", fnIndex);
    const body = source.slice(fnIndex, closeIndex);
    expect(body).toContain("supabaseFetchWithTimeout");
    expect(body).toContain('method: "PATCH"');
  });

  it("wraps fetchInHomeSimulationJobRow through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf(
      "async function fetchInHomeSimulationJobRow"
    );
    const closeIndex = source.indexOf("\n}\n", fnIndex);
    const body = source.slice(fnIndex, closeIndex);
    expect(body).toContain("supabaseFetchWithTimeout");
  });

  it("wraps persistCleaningCheckpoint through the helper", async () => {
    const source = await readFile(workerPath, "utf8");
    const fnIndex = source.indexOf("async function persistCleaningCheckpoint");
    const closeIndex = source.indexOf("\n}\n", fnIndex);
    const body = source.slice(fnIndex, closeIndex);
    expect(body).toContain("supabaseFetchWithTimeout");
  });

  it("uses the new 180-second default claim TTL", async () => {
    const source = await readFile(workerPath, "utf8");
    expect(source).toContain("DEFAULT_CLAIM_TTL_SECONDS = 180");
    expect(source).not.toContain("DEFAULT_CLAIM_TTL_SECONDS = 600");
  });
});
