import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_MAX_DIMENSION_M,
  ABSOLUTE_MIN_DIMENSION_M,
  validateSuppliedBackWallDimensions,
  validateSuppliedCornerDimensions
} from "../supabase/functions/in-home-simulation-worker/lib/dimensions.ts";

describe("validateSuppliedBackWallDimensions", () => {
  it("accepts a usable back_wall pair", () => {
    expect(
      validateSuppliedBackWallDimensions({ wall_width: 4.0, wall_height: 2.5 })
    ).toEqual({ ok: true });
  });

  it("rejects missing keys", () => {
    expect(
      validateSuppliedBackWallDimensions({ wall_width: 4.0 }).ok
    ).toBe(false);
    expect(
      validateSuppliedBackWallDimensions({ wall_height: 2.5 }).ok
    ).toBe(false);
  });

  it("rejects non-numeric values", () => {
    expect(
      validateSuppliedBackWallDimensions({
        wall_width: "four",
        wall_height: 2.5
      }).ok
    ).toBe(false);
  });

  it("rejects values below the absolute minimum", () => {
    expect(
      validateSuppliedBackWallDimensions({
        wall_width: ABSOLUTE_MIN_DIMENSION_M - 0.01,
        wall_height: 2.5
      }).ok
    ).toBe(false);
  });

  it("rejects values above the absolute maximum", () => {
    expect(
      validateSuppliedBackWallDimensions({
        wall_width: ABSOLUTE_MAX_DIMENSION_M + 0.01,
        wall_height: 2.5
      }).ok
    ).toBe(false);
  });

  it("rejects a sofa wider than the wall when sofa width is supplied", () => {
    const result = validateSuppliedBackWallDimensions(
      { wall_width: 1.5, wall_height: 2.5 },
      { sofaWidthM: 2.0 }
    );
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("sofa wider than wall");
  });

  it("rejects a sofa taller than the wall when sofa height is supplied", () => {
    const result = validateSuppliedBackWallDimensions(
      { wall_width: 4.0, wall_height: 0.6 },
      { sofaHeightM: 0.9 }
    );
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("sofa taller than wall");
  });
});

describe("validateSuppliedCornerDimensions", () => {
  it("accepts a usable corner triple", () => {
    expect(
      validateSuppliedCornerDimensions({
        left_wall_width: 3.0,
        right_wall_width: 3.5,
        room_height: 2.5
      })
    ).toEqual({ ok: true });
  });

  it("rejects missing keys", () => {
    expect(
      validateSuppliedCornerDimensions({
        left_wall_width: 3.0,
        right_wall_width: 3.5
      }).ok
    ).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(
      validateSuppliedCornerDimensions({
        left_wall_width: 0.0,
        right_wall_width: 3.0,
        room_height: 2.5
      }).ok
    ).toBe(false);
  });

  it("rejects a corner sofa wider than either wall", () => {
    const result = validateSuppliedCornerDimensions(
      { left_wall_width: 1.0, right_wall_width: 3.0, room_height: 2.5 },
      { sofaWidthM: 2.0 }
    );
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("sofa wider than corner wall");
  });

  it("rejects a sofa taller than the room height", () => {
    const result = validateSuppliedCornerDimensions(
      { left_wall_width: 3.0, right_wall_width: 3.0, room_height: 0.7 },
      { sofaHeightM: 0.9 }
    );
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("sofa taller than room");
  });
});
