import { describe, expect, it } from "vitest";

import {
  REQUIRED_CORNER_POINT_KEYS,
  validateBackWallGeometry,
  validateCornerGeometry
} from "../supabase/functions/in-home-simulation-worker/lib/sanity.ts";

const validBackWall = {
  mode: "back_wall",
  points: [
    { x: 100, y: 700 },
    { x: 900, y: 700 },
    { x: 900, y: 100 },
    { x: 100, y: 100 }
  ]
};

const validCorner = {
  mode: "corner",
  points: {
    corner_floor: { x: 500, y: 700 },
    corner_ceiling: { x: 500, y: 100 },
    left_wall_floor_outer: { x: 100, y: 700 },
    left_wall_ceiling_outer: { x: 100, y: 100 },
    right_wall_floor_outer: { x: 900, y: 700 },
    right_wall_ceiling_outer: { x: 900, y: 100 }
  }
};

describe("validateBackWallGeometry", () => {
  it("accepts a well-formed back_wall geometry", () => {
    expect(validateBackWallGeometry(validBackWall, 1000, 800)).toEqual({
      ok: true
    });
  });

  it("rejects when there are not exactly four points", () => {
    const result = validateBackWallGeometry(
      { mode: "back_wall", points: validBackWall.points.slice(0, 3) },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-bounds points", () => {
    const result = validateBackWallGeometry(
      {
        mode: "back_wall",
        points: [
          { x: -10, y: 700 },
          { x: 900, y: 700 },
          { x: 900, y: 100 },
          { x: 100, y: 100 }
        ]
      },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });

  it("rejects swapped left and right anchors", () => {
    const result = validateBackWallGeometry(
      {
        mode: "back_wall",
        points: [
          { x: 900, y: 700 },
          { x: 100, y: 700 },
          { x: 100, y: 100 },
          { x: 900, y: 100 }
        ]
      },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a quad whose bottom is above the top", () => {
    const result = validateBackWallGeometry(
      {
        mode: "back_wall",
        points: [
          { x: 100, y: 100 },
          { x: 900, y: 100 },
          { x: 900, y: 700 },
          { x: 100, y: 700 }
        ]
      },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateCornerGeometry", () => {
  it("accepts a well-formed corner geometry", () => {
    expect(validateCornerGeometry(validCorner, 1000, 800)).toEqual({
      ok: true
    });
  });

  it("rejects when any required key is missing", () => {
    for (const key of REQUIRED_CORNER_POINT_KEYS) {
      const broken = {
        mode: "corner",
        points: { ...validCorner.points }
      };
      delete broken.points[key];
      const result = validateCornerGeometry(broken, 1000, 800);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects when corner floor is above corner ceiling", () => {
    const result = validateCornerGeometry(
      {
        mode: "corner",
        points: {
          ...validCorner.points,
          corner_floor: { x: 500, y: 100 },
          corner_ceiling: { x: 500, y: 700 }
        }
      },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });

  it("rejects when left and right wall outer points are on the wrong side of the corner", () => {
    const result = validateCornerGeometry(
      {
        mode: "corner",
        points: {
          ...validCorner.points,
          left_wall_floor_outer: { x: 900, y: 700 },
          right_wall_floor_outer: { x: 100, y: 700 }
        }
      },
      1000,
      800
    );
    expect(result.ok).toBe(false);
  });
});
