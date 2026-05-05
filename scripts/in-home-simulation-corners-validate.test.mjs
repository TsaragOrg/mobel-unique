import { describe, expect, it } from "vitest";

import {
  FRAME_EDGE_AVOID_RATIO,
  FRAME_EDGE_NEAR_RATIO,
  VERTICAL_ALIGN_TOLERANCE_RATIO,
  validateBackWallCorners,
  validateClassifiedCorners,
  validateCornerCorners
} from "../supabase/functions/in-home-simulation-worker/lib/corners-validate.ts";

const W = 1000;
const H = 1500;

function backWall(overrides = {}) {
  return {
    mode: "back_wall",
    topLeft: { x: 200, y: 200 },
    topRight: { x: 800, y: 200 },
    bottomLeft: { x: 200, y: 1300 },
    bottomRight: { x: 800, y: 1300 },
    ...overrides
  };
}

function corner(overrides = {}) {
  return {
    mode: "corner",
    topLeft: { x: 50, y: 200 },
    topCenter: { x: 500, y: 200 },
    topRight: { x: 950, y: 200 },
    bottomLeft: { x: 50, y: 1300 },
    bottomCenter: { x: 500, y: 1300 },
    bottomRight: { x: 950, y: 1300 },
    ...overrides
  };
}

describe("validateBackWallCorners", () => {
  it("accepts well-placed corners", () => {
    const result = validateBackWallCorners(backWall(), W, H);
    expect(result.ok).toBe(true);
  });

  it("rejects top-left stuck to the left frame edge", () => {
    const tooClose = Math.floor(W * FRAME_EDGE_AVOID_RATIO) - 1;
    const result = validateBackWallCorners(
      backWall({
        topLeft: { x: tooClose, y: 200 },
        bottomLeft: { x: tooClose, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/top-left.*frame edge/);
    }
  });

  it("rejects bottom-left stuck to the left frame edge", () => {
    const tooClose = Math.floor(W * FRAME_EDGE_AVOID_RATIO) - 1;
    const result = validateBackWallCorners(
      backWall({ bottomLeft: { x: tooClose, y: 1300 } }),
      W,
      H
    );
    expect(result.ok).toBe(false);
  });

  it("rejects top-right stuck to the right frame edge", () => {
    const tooClose = Math.ceil(W - W * FRAME_EDGE_AVOID_RATIO) + 1;
    const result = validateBackWallCorners(
      backWall({
        topRight: { x: tooClose, y: 200 },
        bottomRight: { x: tooClose, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/top-right.*frame edge/);
    }
  });

  it("rejects left seam dots on different verticals", () => {
    const tolerance = W * VERTICAL_ALIGN_TOLERANCE_RATIO;
    const result = validateBackWallCorners(
      backWall({
        topLeft: { x: 100, y: 200 },
        bottomLeft: { x: 100 + tolerance + 5, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/left seam.*same vertical/);
    }
  });

  it("rejects right seam dots on different verticals", () => {
    const tolerance = W * VERTICAL_ALIGN_TOLERANCE_RATIO;
    const result = validateBackWallCorners(
      backWall({
        topRight: { x: 800, y: 200 },
        bottomRight: { x: 800 + tolerance + 5, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/right seam.*same vertical/);
    }
  });

  it("rejects top-left below bottom-left", () => {
    const result = validateBackWallCorners(
      backWall({
        topLeft: { x: 200, y: 1400 },
        bottomLeft: { x: 200, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
  });

  it("rejects swapped left and right", () => {
    const result = validateBackWallCorners(
      backWall({
        topLeft: { x: 800, y: 200 },
        topRight: { x: 200, y: 200 },
        bottomLeft: { x: 800, y: 1300 },
        bottomRight: { x: 200, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
  });

  it("rejects the 2026-04-30 live miss (TL=82,216 BL=212,971 TR=1067,331 on 1083×1452)", () => {
    // Real coordinates from the live-harness gpt-image-2 miss.
    // Several rules trip on this input (TR is also too close to the
    // right frame edge); the contract is "reject", not "reject for one
    // specific reason".
    const result = validateBackWallCorners(
      {
        mode: "back_wall",
        topLeft: { x: 82, y: 216 },
        topRight: { x: 1067, y: 331 },
        bottomLeft: { x: 212, y: 971 },
        bottomRight: { x: 1016, y: 959 }
      },
      1083,
      1452
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateCornerCorners", () => {
  it("accepts well-placed 6 corners", () => {
    const result = validateCornerCorners(corner(), W, H);
    expect(result.ok).toBe(true);
  });

  it("rejects inner-edge dots on different verticals", () => {
    const tolerance = W * VERTICAL_ALIGN_TOLERANCE_RATIO;
    const result = validateCornerCorners(
      corner({
        topCenter: { x: 500, y: 200 },
        bottomCenter: { x: 500 + tolerance + 5, y: 1300 }
      }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/inner-edge.*same vertical/);
    }
  });

  it("rejects bottom-center floating above the floor", () => {
    const result = validateCornerCorners(
      corner({ bottomCenter: { x: 500, y: Math.floor(H * 0.4) } }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/bottom-center.*floor/);
    }
  });

  it("rejects top-center below the half-height", () => {
    const result = validateCornerCorners(
      corner({ topCenter: { x: 500, y: Math.ceil(H * 0.6) } }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/top-center.*ceiling/);
    }
  });

  it("rejects top-left stopped in the middle of the left wall", () => {
    const tooFar = Math.ceil(W * FRAME_EDGE_NEAR_RATIO) + 5;
    const result = validateCornerCorners(
      corner({ topLeft: { x: tooFar, y: 200 } }),
      W,
      H
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/top-left.*frame edge/);
    }
  });

  it("rejects bottom-right stopped in the middle of the right wall", () => {
    const tooFar = Math.floor(W - W * FRAME_EDGE_NEAR_RATIO) - 5;
    const result = validateCornerCorners(
      corner({ bottomRight: { x: tooFar, y: 1300 } }),
      W,
      H
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateClassifiedCorners dispatch", () => {
  it("routes back_wall to back-wall validator", () => {
    expect(validateClassifiedCorners(backWall(), W, H).ok).toBe(true);
  });

  it("routes corner to corner validator", () => {
    expect(validateClassifiedCorners(corner(), W, H).ok).toBe(true);
  });
});
