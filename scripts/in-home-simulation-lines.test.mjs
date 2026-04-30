import { describe, expect, it } from "vitest";

import {
  MIN_DOT_PIXELS,
  classifyBackWall,
  classifyCorner,
  classifyDots,
  isYellow,
  midpoint
} from "../supabase/functions/in-home-simulation-worker/lib/lines-classify.ts";

describe("isYellow", () => {
  it("accepts a saturated bright yellow", () => {
    expect(isYellow(255, 220, 0)).toBe(true);
    expect(isYellow(245, 210, 50)).toBe(true);
  });

  it("rejects warm wood tones (typical false positive)", () => {
    // wood / beige sofa colors must NOT register as a dot
    expect(isYellow(180, 150, 100)).toBe(false);
    expect(isYellow(200, 160, 120)).toBe(false);
  });

  it("rejects white and off-white", () => {
    expect(isYellow(240, 240, 240)).toBe(false);
    expect(isYellow(250, 245, 220)).toBe(false);
  });

  it("rejects orange (r-g >= 80)", () => {
    expect(isYellow(250, 150, 50)).toBe(false);
  });
});

describe("classifyDots", () => {
  it("classifies four dots as back_wall", () => {
    const dots = [
      { x: 100, y: 100, size: 50 },
      { x: 900, y: 110, size: 55 },
      { x: 110, y: 800, size: 60 },
      { x: 880, y: 790, size: 50 }
    ];
    const result = classifyDots(dots);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.corners.mode).toBe("back_wall");
    expect(result.corners).toMatchObject({
      topLeft: { x: 100, y: 100 },
      topRight: { x: 900, y: 110 },
      bottomLeft: { x: 110, y: 800 },
      bottomRight: { x: 880, y: 790 }
    });
  });

  it("classifies six dots as corner", () => {
    const dots = [
      { x: 100, y: 100, size: 50 },
      { x: 500, y: 120, size: 55 },
      { x: 900, y: 100, size: 60 },
      { x: 110, y: 800, size: 50 },
      { x: 510, y: 790, size: 55 },
      { x: 880, y: 800, size: 50 }
    ];
    const result = classifyDots(dots);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.corners.mode).toBe("corner");
    expect(result.corners).toMatchObject({
      topLeft: { x: 100, y: 100 },
      topCenter: { x: 500, y: 120 },
      topRight: { x: 900, y: 100 },
      bottomLeft: { x: 110, y: 800 },
      bottomCenter: { x: 510, y: 790 },
      bottomRight: { x: 880, y: 800 }
    });
  });

  it("rejects unsupported dot counts", () => {
    expect(classifyDots([]).ok).toBe(false);
    expect(classifyDots([{ x: 1, y: 1, size: 1 }]).ok).toBe(false);
    expect(
      classifyDots([
        { x: 1, y: 1, size: 1 },
        { x: 2, y: 2, size: 1 },
        { x: 3, y: 3, size: 1 },
        { x: 4, y: 4, size: 1 },
        { x: 5, y: 5, size: 1 }
      ]).ok
    ).toBe(false);
  });
});

describe("classifyBackWall", () => {
  it("orders by y then by x", () => {
    const dots = [
      { x: 600, y: 500, size: 1 },
      { x: 100, y: 80, size: 1 },
      { x: 600, y: 80, size: 1 },
      { x: 100, y: 500, size: 1 }
    ];
    const corners = classifyBackWall(dots);
    expect(corners.topLeft).toMatchObject({ x: 100, y: 80 });
    expect(corners.topRight).toMatchObject({ x: 600, y: 80 });
    expect(corners.bottomLeft).toMatchObject({ x: 100, y: 500 });
    expect(corners.bottomRight).toMatchObject({ x: 600, y: 500 });
  });
});

describe("classifyCorner", () => {
  it("orders 6 dots into top {L,C,R} + bottom {L,C,R}", () => {
    const dots = [
      { x: 50, y: 100, size: 1 },
      { x: 500, y: 100, size: 1 },
      { x: 950, y: 100, size: 1 },
      { x: 50, y: 800, size: 1 },
      { x: 500, y: 800, size: 1 },
      { x: 950, y: 800, size: 1 }
    ];
    const c = classifyCorner(dots);
    expect(c.topLeft.x).toBe(50);
    expect(c.topCenter.x).toBe(500);
    expect(c.topRight.x).toBe(950);
    expect(c.bottomLeft.x).toBe(50);
    expect(c.bottomCenter.x).toBe(500);
    expect(c.bottomRight.x).toBe(950);
  });
});

describe("midpoint", () => {
  it("rounds to nearest integer pixel", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 5, y: 5 })).toEqual({ x: 3, y: 3 });
    expect(midpoint({ x: 100, y: 100 }, { x: 200, y: 200 })).toEqual({
      x: 150,
      y: 150
    });
  });
});

describe("MIN_DOT_PIXELS", () => {
  it("is set to a strict threshold to ignore noise", () => {
    expect(MIN_DOT_PIXELS).toBeGreaterThanOrEqual(20);
  });
});
