import { describe, expect, it } from "vitest";

import {
  hashSimulationIdempotencyKey,
  type SimulationIdempotencyStore
} from "./simulation-idempotency";

describe("hashSimulationIdempotencyKey", () => {
  it("returns a 64-char hex sha-256 digest", () => {
    const digest = hashSimulationIdempotencyKey(
      "00000000-0000-4000-8000-000000000099"
    );
    expect(/^[0-9a-f]{64}$/.test(digest)).toBe(true);
  });

  it("is deterministic", () => {
    const a = hashSimulationIdempotencyKey("abc");
    const b = hashSimulationIdempotencyKey("abc");
    expect(a).toBe(b);
  });

  it("does not include the raw key", () => {
    const raw = "00000000-0000-4000-8000-000000000099";
    const digest = hashSimulationIdempotencyKey(raw);
    expect(digest).not.toContain(raw);
  });
});

describe("SimulationIdempotencyStore contract", () => {
  function createInMemoryStore(): SimulationIdempotencyStore {
    const rows = new Map<string, { simulationJobId: string | null }>();
    return {
      async acquire(keyHash) {
        const existing = rows.get(keyHash);
        if (existing) {
          return {
            acquired: false,
            simulationJobId: existing.simulationJobId
          };
        }
        rows.set(keyHash, { simulationJobId: null });
        return { acquired: true, simulationJobId: null };
      },
      async finalize(keyHash, simulationJobId) {
        const existing = rows.get(keyHash);
        if (!existing) {
          throw new Error("not acquired");
        }
        rows.set(keyHash, { simulationJobId });
      }
    };
  }

  it("returns acquired=true on the first call for a given key", async () => {
    const store = createInMemoryStore();
    const result = await store.acquire("hash-a");
    expect(result).toEqual({ acquired: true, simulationJobId: null });
  });

  it("returns acquired=false with null jobId while the original is in flight", async () => {
    const store = createInMemoryStore();
    await store.acquire("hash-a");
    const second = await store.acquire("hash-a");
    expect(second).toEqual({ acquired: false, simulationJobId: null });
  });

  it("returns acquired=false with the persisted job id after finalize", async () => {
    const store = createInMemoryStore();
    await store.acquire("hash-a");
    await store.finalize(
      "hash-a",
      "00000000-0000-4000-8000-0000000000a1"
    );
    const result = await store.acquire("hash-a");
    expect(result).toEqual({
      acquired: false,
      simulationJobId: "00000000-0000-4000-8000-0000000000a1"
    });
  });

  it("treats different keys independently", async () => {
    const store = createInMemoryStore();
    const a = await store.acquire("hash-a");
    const b = await store.acquire("hash-b");
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
  });

  it("rejects finalize for a key that was not acquired", async () => {
    const store = createInMemoryStore();
    await expect(
      store.finalize("hash-a", "00000000-0000-4000-8000-0000000000a1")
    ).rejects.toThrow("not acquired");
  });
});
