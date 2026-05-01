import { describe, expect, it } from "vitest";

import {
  COMPRESSED_JPEG_QUALITY,
  DEFAULT_WORKER_MAX_EDGE_PX,
  NORMALIZED_JPEG_QUALITY,
  computeResizedDimensions,
  parseMaxEdge,
  shouldCompress
} from "../supabase/functions/in-home-simulation-worker/lib/normalize.ts";

describe("computeResizedDimensions", () => {
  it("returns the input dimensions when within the limit", () => {
    expect(
      computeResizedDimensions({ width: 1000, height: 800 }, 1536)
    ).toEqual({ width: 1000, height: 800 });
  });

  it("scales down a landscape image proportionally", () => {
    const result = computeResizedDimensions({ width: 4000, height: 3000 }, 1536);
    expect(result.width).toBe(1536);
    expect(result.height).toBe(1152);
  });

  it("scales down a portrait image proportionally", () => {
    const result = computeResizedDimensions({ width: 1500, height: 4000 }, 1536);
    expect(result.height).toBe(1536);
    expect(result.width).toBe(576);
  });

  it("preserves a square image's aspect ratio when scaling", () => {
    const result = computeResizedDimensions({ width: 4096, height: 4096 }, 1536);
    expect(result.width).toBe(1536);
    expect(result.height).toBe(1536);
  });

  it("rejects non-positive dimensions", () => {
    expect(() =>
      computeResizedDimensions({ width: 0, height: 100 }, 1536)
    ).toThrow(/positive width/);
    expect(() =>
      computeResizedDimensions({ width: 100, height: -1 }, 1536)
    ).toThrow(/positive height/);
  });

  it("rejects non-positive maxEdge", () => {
    expect(() =>
      computeResizedDimensions({ width: 100, height: 100 }, 0)
    ).toThrow(/positive maxEdge/);
  });
});

describe("shouldCompress", () => {
  it("returns true when the longest edge exceeds the limit", () => {
    expect(shouldCompress({ width: 4000, height: 3000 }, 1536)).toBe(true);
    expect(shouldCompress({ width: 1500, height: 4000 }, 1536)).toBe(true);
  });

  it("returns false when both dimensions are within the limit", () => {
    expect(shouldCompress({ width: 1000, height: 800 }, 1536)).toBe(false);
    expect(shouldCompress({ width: 1536, height: 1000 }, 1536)).toBe(false);
  });
});

describe("parseMaxEdge", () => {
  it("returns the default when the value is missing or empty", () => {
    expect(parseMaxEdge(null)).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
    expect(parseMaxEdge(undefined)).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
    expect(parseMaxEdge("")).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
  });

  it("returns the default when the value is invalid", () => {
    expect(parseMaxEdge("abc")).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
    expect(parseMaxEdge("0")).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
    expect(parseMaxEdge("-100")).toBe(DEFAULT_WORKER_MAX_EDGE_PX);
  });

  it("parses positive integers", () => {
    expect(parseMaxEdge("2048")).toBe(2048);
    expect(parseMaxEdge("1024")).toBe(1024);
  });
});

describe("JPEG quality defaults", () => {
  it("are within an acceptable range", () => {
    expect(NORMALIZED_JPEG_QUALITY).toBeGreaterThanOrEqual(80);
    expect(NORMALIZED_JPEG_QUALITY).toBeLessThanOrEqual(100);
    expect(COMPRESSED_JPEG_QUALITY).toBeGreaterThanOrEqual(70);
    expect(COMPRESSED_JPEG_QUALITY).toBeLessThanOrEqual(95);
    expect(NORMALIZED_JPEG_QUALITY).toBeGreaterThanOrEqual(
      COMPRESSED_JPEG_QUALITY
    );
  });
});
