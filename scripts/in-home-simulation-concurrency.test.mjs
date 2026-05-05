import { describe, expect, it } from "vitest";

import {
  parseConcurrency,
  runWithConcurrency
} from "../supabase/functions/in-home-simulation-worker/lib/concurrency.ts";

describe("parseConcurrency", () => {
  it("returns the default for missing or invalid input", () => {
    expect(parseConcurrency(undefined, 1)).toBe(1);
    expect(parseConcurrency(null, 1)).toBe(1);
    expect(parseConcurrency("", 3)).toBe(3);
    expect(parseConcurrency("abc", 3)).toBe(3);
    expect(parseConcurrency("0", 3)).toBe(3);
    expect(parseConcurrency("-1", 3)).toBe(3);
  });

  it("returns the parsed positive integer", () => {
    expect(parseConcurrency("1", 5)).toBe(1);
    expect(parseConcurrency("4", 1)).toBe(4);
    expect(parseConcurrency("16", 1)).toBe(16);
  });
});

describe("runWithConcurrency", () => {
  it("runs all items and preserves index alignment", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("returns an empty array for an empty input", async () => {
    const results = await runWithConcurrency([], 4, async () => "x");
    expect(results).toEqual([]);
  });

  it("respects the concurrency limit", async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 8 }, (_, i) => i);
    const limit = 3;

    await runWithConcurrency(items, limit, async (i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return i;
    });

    expect(peak).toBeLessThanOrEqual(limit);
    expect(peak).toBeGreaterThanOrEqual(1);
  });

  it("propagates a worker rejection", async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow(/boom/);
  });

  it("clamps non-positive limits to 1", async () => {
    const results = await runWithConcurrency([1, 2, 3], 0, async (n) => n);
    expect(results).toEqual([1, 2, 3]);
  });
});
