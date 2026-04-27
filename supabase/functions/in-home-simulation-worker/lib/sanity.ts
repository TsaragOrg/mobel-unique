// SPEC-0007 PLAN-0010 geometric sanity validation for room geometry
// returned by the geometry provider. These pure rules let the Edge
// Function reject obviously broken provider output before it reaches
// the dimension-guide overlay, matching the spec rule that "Validate
// the returned mode and points against geometric sanity rules and may
// retry room-geometry detection up to a worker-defined attempt limit
// before failing".

import type {
  BackWallGeometry,
  CornerGeometry,
  Point
} from "./geometry.ts";

export type SanityOk = { ok: true };
export type SanityFailure = { ok: false; failureReason: string };
export type SanityResult = SanityOk | SanityFailure;

export const REQUIRED_CORNER_POINT_KEYS = [
  "corner_floor",
  "corner_ceiling",
  "left_wall_floor_outer",
  "left_wall_ceiling_outer",
  "right_wall_floor_outer",
  "right_wall_ceiling_outer"
] as const;

function isWithinBounds(
  point: Point,
  imageWidth: number,
  imageHeight: number
): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= imageWidth &&
    point.y <= imageHeight
  );
}

export function validateBackWallGeometry(
  geometry: BackWallGeometry,
  imageWidth: number,
  imageHeight: number
): SanityResult {
  if (!Array.isArray(geometry.points) || geometry.points.length !== 4) {
    return {
      ok: false,
      failureReason: "back_wall mode requires exactly four points"
    };
  }
  for (let i = 0; i < geometry.points.length; i++) {
    if (!isWithinBounds(geometry.points[i], imageWidth, imageHeight)) {
      return {
        ok: false,
        failureReason: `back_wall point ${i} is out of image bounds`
      };
    }
  }
  const [bl, br, tr, tl] = geometry.points;
  if (br.x <= bl.x) {
    return {
      ok: false,
      failureReason: "back_wall bottom-right must be to the right of bottom-left"
    };
  }
  if (tr.x <= tl.x) {
    return {
      ok: false,
      failureReason: "back_wall top-right must be to the right of top-left"
    };
  }
  if (bl.y <= tl.y) {
    return {
      ok: false,
      failureReason: "back_wall bottom-left must be below top-left"
    };
  }
  if (br.y <= tr.y) {
    return {
      ok: false,
      failureReason: "back_wall bottom-right must be below top-right"
    };
  }
  return { ok: true };
}

export function validateCornerGeometry(
  geometry: CornerGeometry,
  imageWidth: number,
  imageHeight: number
): SanityResult {
  const points = geometry.points as Record<string, Point | undefined>;
  for (const key of REQUIRED_CORNER_POINT_KEYS) {
    const point = points[key];
    if (!point) {
      return {
        ok: false,
        failureReason: `corner geometry is missing required key: ${key}`
      };
    }
    if (!isWithinBounds(point, imageWidth, imageHeight)) {
      return {
        ok: false,
        failureReason: `corner point ${key} is out of image bounds`
      };
    }
  }
  if (geometry.points.corner_floor.y <= geometry.points.corner_ceiling.y) {
    return {
      ok: false,
      failureReason: "corner floor must be below corner ceiling"
    };
  }
  if (
    geometry.points.left_wall_floor_outer.y <=
    geometry.points.left_wall_ceiling_outer.y
  ) {
    return {
      ok: false,
      failureReason: "left wall floor must be below left wall ceiling"
    };
  }
  if (
    geometry.points.right_wall_floor_outer.y <=
    geometry.points.right_wall_ceiling_outer.y
  ) {
    return {
      ok: false,
      failureReason: "right wall floor must be below right wall ceiling"
    };
  }
  if (
    geometry.points.left_wall_floor_outer.x >=
    geometry.points.corner_floor.x
  ) {
    return {
      ok: false,
      failureReason:
        "left wall floor outer must be to the left of corner floor"
    };
  }
  if (
    geometry.points.right_wall_floor_outer.x <=
    geometry.points.corner_floor.x
  ) {
    return {
      ok: false,
      failureReason:
        "right wall floor outer must be to the right of corner floor"
    };
  }
  return { ok: true };
}
