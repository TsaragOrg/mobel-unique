// SPEC-0007 PLAN-0011 numeric dimension validation for Stage 2.
//
// The submit_in_home_simulation_dimensions SQL function enforces
// per-mode key presence. These pure helpers add the worker-side
// numeric range checks and the optional sofa-vs-wall sanity rules
// from `SPEC-0007 Stage 2: Sofa Placement`.

export type DimensionsValidationOk = { ok: true };
export type DimensionsValidationFailure = {
  ok: false;
  failureReason: string;
};
export type DimensionsValidationResult =
  | DimensionsValidationOk
  | DimensionsValidationFailure;

export const ABSOLUTE_MIN_DIMENSION_M = 0.5;
export const ABSOLUTE_MAX_DIMENSION_M = 20.0;

export type SofaSizeOptions = {
  sofaWidthM?: number;
  sofaHeightM?: number;
};

function isPositiveNumberInRange(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= ABSOLUTE_MIN_DIMENSION_M &&
    value <= ABSOLUTE_MAX_DIMENSION_M
  );
}

export function validateSuppliedBackWallDimensions(
  supplied: Record<string, unknown>,
  sofa: SofaSizeOptions = {}
): DimensionsValidationResult {
  const wallWidth = supplied.wall_width;
  const wallHeight = supplied.wall_height;

  if (wallWidth === undefined || wallHeight === undefined) {
    return {
      ok: false,
      failureReason: "back_wall mode requires wall_width and wall_height"
    };
  }
  if (!isPositiveNumberInRange(wallWidth)) {
    return {
      ok: false,
      failureReason:
        `wall_width must be a number between ${ABSOLUTE_MIN_DIMENSION_M} and ${ABSOLUTE_MAX_DIMENSION_M} metres`
    };
  }
  if (!isPositiveNumberInRange(wallHeight)) {
    return {
      ok: false,
      failureReason:
        `wall_height must be a number between ${ABSOLUTE_MIN_DIMENSION_M} and ${ABSOLUTE_MAX_DIMENSION_M} metres`
    };
  }

  if (
    typeof sofa.sofaWidthM === "number" &&
    Number.isFinite(sofa.sofaWidthM) &&
    sofa.sofaWidthM > wallWidth
  ) {
    return {
      ok: false,
      failureReason: `sofa wider than wall (sofa=${sofa.sofaWidthM}m, wall=${wallWidth}m)`
    };
  }

  if (
    typeof sofa.sofaHeightM === "number" &&
    Number.isFinite(sofa.sofaHeightM) &&
    sofa.sofaHeightM > wallHeight
  ) {
    return {
      ok: false,
      failureReason: `sofa taller than wall (sofa=${sofa.sofaHeightM}m, wall=${wallHeight}m)`
    };
  }

  return { ok: true };
}

export function validateSuppliedCornerDimensions(
  supplied: Record<string, unknown>,
  sofa: SofaSizeOptions = {}
): DimensionsValidationResult {
  const left = supplied.left_wall_width;
  const right = supplied.right_wall_width;
  const height = supplied.room_height;

  if (left === undefined || right === undefined || height === undefined) {
    return {
      ok: false,
      failureReason:
        "corner mode requires left_wall_width, right_wall_width, and room_height"
    };
  }
  for (const [name, value] of [
    ["left_wall_width", left],
    ["right_wall_width", right],
    ["room_height", height]
  ] as const) {
    if (!isPositiveNumberInRange(value)) {
      return {
        ok: false,
        failureReason:
          `${name} must be a number between ${ABSOLUTE_MIN_DIMENSION_M} and ${ABSOLUTE_MAX_DIMENSION_M} metres`
      };
    }
  }

  const leftN = left as number;
  const rightN = right as number;
  const heightN = height as number;

  if (
    typeof sofa.sofaWidthM === "number" &&
    Number.isFinite(sofa.sofaWidthM) &&
    (sofa.sofaWidthM > leftN || sofa.sofaWidthM > rightN)
  ) {
    return {
      ok: false,
      failureReason:
        `sofa wider than corner wall (sofa=${sofa.sofaWidthM}m, left=${leftN}m, right=${rightN}m)`
    };
  }

  if (
    typeof sofa.sofaHeightM === "number" &&
    Number.isFinite(sofa.sofaHeightM) &&
    sofa.sofaHeightM > heightN
  ) {
    return {
      ok: false,
      failureReason: `sofa taller than room (sofa=${sofa.sofaHeightM}m, room=${heightN}m)`
    };
  }

  return { ok: true };
}
