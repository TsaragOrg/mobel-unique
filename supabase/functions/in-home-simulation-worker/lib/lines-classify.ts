// SPEC-0007 Stage 1 lines — pure helpers (no Deno-only imports).
//
// These pure functions (isYellow, classifyBackWall, classifyCorner,
// classifyDots, midpoint, MIN_DOT_PIXELS) are exercised by vitest in
// Node. The Image-using helpers (detectYellowDots, drawThickLine,
// drawDimensionLines) live in `lines.ts` and depend on imagescript via
// the Deno-only URL import; they are exercised through smoke tests
// against the live worker rather than vitest unit tests.

export type Point = { x: number; y: number };

export type Cluster = Point & { size: number };

export type BackWallCorners = {
  mode: "back_wall";
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
};

export type CornerCorners = {
  mode: "corner";
  topLeft: Point;
  topCenter: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomCenter: Point;
  bottomRight: Point;
};

export type ClassifiedCorners = BackWallCorners | CornerCorners;

export type ClassifyResult =
  | { ok: true; corners: ClassifiedCorners }
  | { ok: false; failureReason: string };

export const MIN_DOT_PIXELS = 30;

export function isYellow(r: number, g: number, b: number): boolean {
  return r > 220 && g > 190 && b < 110 && r - b > 120 && r - g < 80;
}

export function classifyDots(dots: Cluster[]): ClassifyResult {
  if (dots.length === 4) {
    return { ok: true, corners: classifyBackWall(dots) };
  }
  if (dots.length === 6) {
    return { ok: true, corners: classifyCorner(dots) };
  }
  return {
    ok: false,
    failureReason: `expected 4 or 6 yellow dots, found ${dots.length}`
  };
}

export function classifyBackWall(dots: Cluster[]): BackWallCorners {
  const byY = [...dots].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = byY.slice(2, 4).sort((a, b) => a.x - b.x);
  return {
    mode: "back_wall",
    topLeft: { x: top[0].x, y: top[0].y },
    topRight: { x: top[1].x, y: top[1].y },
    bottomLeft: { x: bottom[0].x, y: bottom[0].y },
    bottomRight: { x: bottom[1].x, y: bottom[1].y }
  };
}

export function classifyCorner(dots: Cluster[]): CornerCorners {
  const byY = [...dots].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 3).sort((a, b) => a.x - b.x);
  const bottom = byY.slice(3, 6).sort((a, b) => a.x - b.x);
  return {
    mode: "corner",
    topLeft: { x: top[0].x, y: top[0].y },
    topCenter: { x: top[1].x, y: top[1].y },
    topRight: { x: top[2].x, y: top[2].y },
    bottomLeft: { x: bottom[0].x, y: bottom[0].y },
    bottomCenter: { x: bottom[1].x, y: bottom[1].y },
    bottomRight: { x: bottom[2].x, y: bottom[2].y }
  };
}

export function midpoint(a: Point, b: Point): Point {
  return {
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2)
  };
}
