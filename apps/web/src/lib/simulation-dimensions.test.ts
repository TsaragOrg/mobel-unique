import { describe, expect, it } from "vitest";

import {
  SIMULATION_DIMENSION_MAX_M,
  SIMULATION_DIMENSION_MIN_M,
  validateBackWallSubmittedDimensions,
  validateCornerSubmittedDimensions
} from "./simulation-dimensions";

describe("validateBackWallSubmittedDimensions", () => {
  it("accepts a valid payload with all three keys", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_width: 4.2,
      wall_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dimensions).toEqual({
        wall_width: 4.2,
        wall_height: 2.7,
        room_depth: 5
      });
    }
  });

  it("rejects a missing room_depth (CR-SPEC-0012 makes it required)", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_width: 4.2,
      wall_height: 2.7
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("room_depth");
    }
  });

  it("rejects a missing wall_width", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_width: "4.2",
      wall_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("wall_width");
    }
  });

  it("rejects a value below the minimum", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_width: 0.1,
      wall_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("wall_width");
    }
  });

  it("rejects a value above the maximum", () => {
    const result = validateBackWallSubmittedDimensions({
      wall_width: 25,
      wall_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("wall_width");
    }
  });

  it("rejects a non-object body", () => {
    expect(validateBackWallSubmittedDimensions(null).ok).toBe(false);
    expect(validateBackWallSubmittedDimensions("nope").ok).toBe(false);
    expect(validateBackWallSubmittedDimensions(["array"]).ok).toBe(false);
  });

  it("accepts the boundary values", () => {
    const min = validateBackWallSubmittedDimensions({
      wall_width: SIMULATION_DIMENSION_MIN_M,
      wall_height: SIMULATION_DIMENSION_MIN_M,
      room_depth: SIMULATION_DIMENSION_MIN_M
    });
    const max = validateBackWallSubmittedDimensions({
      wall_width: SIMULATION_DIMENSION_MAX_M,
      wall_height: SIMULATION_DIMENSION_MAX_M,
      room_depth: SIMULATION_DIMENSION_MAX_M
    });
    expect(min.ok).toBe(true);
    expect(max.ok).toBe(true);
  });
});

describe("validateCornerSubmittedDimensions", () => {
  it("accepts a valid payload with all four keys", () => {
    const result = validateCornerSubmittedDimensions({
      left_wall_width: 3.4,
      right_wall_width: 4.0,
      room_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dimensions.left_wall_width).toBe(3.4);
      expect(result.dimensions.room_depth).toBe(5);
    }
  });

  it("rejects a missing room_depth", () => {
    const result = validateCornerSubmittedDimensions({
      left_wall_width: 3.4,
      right_wall_width: 4.0,
      room_height: 2.7
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("room_depth");
    }
  });

  it("rejects a missing required wall key", () => {
    const result = validateCornerSubmittedDimensions({
      right_wall_width: 4.0,
      room_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("left_wall_width");
    }
  });

  it("rejects a non-positive value", () => {
    const result = validateCornerSubmittedDimensions({
      left_wall_width: -1,
      right_wall_width: 4,
      room_height: 2.7,
      room_depth: 5
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateCornerSubmittedDimensions(null).ok).toBe(false);
  });
});
