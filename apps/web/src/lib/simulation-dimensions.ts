// SPEC-0015 PLAN-0040 numeric validation for visitor-supplied wall
// dimensions.
//
// The shape and number ranges mirror the worker-side validator at
// `supabase/functions/in-home-simulation-worker/lib/dimensions.ts`
// after PLAN-0038, including the CR-SPEC-0012 promotion of
// `room_depth` from optional to required for both `back_wall` and
// `corner` modes. Keeping the API-side and worker-side validators in
// lockstep is the binding parity rule for SPEC-0015 launch.

import type {
  BackWallSuppliedDimensions,
  CornerSuppliedDimensions
} from "./simulation-public-api";

export const SIMULATION_DIMENSION_MIN_M = 0.5;
export const SIMULATION_DIMENSION_MAX_M = 20.0;

export type ValidatedBackWallDimensions =
  | { ok: true; dimensions: BackWallSuppliedDimensions }
  | { ok: false; message: string };

export type ValidatedCornerDimensions =
  | { ok: true; dimensions: CornerSuppliedDimensions }
  | { ok: false; message: string };

export function validateBackWallSubmittedDimensions(
  body: unknown
): ValidatedBackWallDimensions {
  if (!isObject(body)) {
    return { ok: false, message: "body must be a JSON object" };
  }
  const wallWidth = body.wall_width;
  const wallHeight = body.wall_height;
  const roomDepth = body.room_depth;

  if (
    wallWidth === undefined ||
    wallHeight === undefined ||
    roomDepth === undefined
  ) {
    return {
      ok: false,
      message:
        "back_wall mode requires wall_width, wall_height, and room_depth"
    };
  }
  const widthCheck = checkRangedNumber("wall_width", wallWidth);
  if (!widthCheck.ok) return widthCheck;
  const heightCheck = checkRangedNumber("wall_height", wallHeight);
  if (!heightCheck.ok) return heightCheck;
  const depthCheck = checkRangedNumber("room_depth", roomDepth);
  if (!depthCheck.ok) return depthCheck;

  return {
    ok: true,
    dimensions: {
      wall_width: widthCheck.value,
      wall_height: heightCheck.value,
      room_depth: depthCheck.value
    }
  };
}

export function validateCornerSubmittedDimensions(
  body: unknown
): ValidatedCornerDimensions {
  if (!isObject(body)) {
    return { ok: false, message: "body must be a JSON object" };
  }
  const left = body.left_wall_width;
  const right = body.right_wall_width;
  const height = body.room_height;
  const roomDepth = body.room_depth;

  if (
    left === undefined ||
    right === undefined ||
    height === undefined ||
    roomDepth === undefined
  ) {
    return {
      ok: false,
      message:
        "corner mode requires left_wall_width, right_wall_width, room_height, and room_depth"
    };
  }
  const leftCheck = checkRangedNumber("left_wall_width", left);
  if (!leftCheck.ok) return leftCheck;
  const rightCheck = checkRangedNumber("right_wall_width", right);
  if (!rightCheck.ok) return rightCheck;
  const heightCheck = checkRangedNumber("room_height", height);
  if (!heightCheck.ok) return heightCheck;
  const depthCheck = checkRangedNumber("room_depth", roomDepth);
  if (!depthCheck.ok) return depthCheck;

  return {
    ok: true,
    dimensions: {
      left_wall_width: leftCheck.value,
      right_wall_width: rightCheck.value,
      room_height: heightCheck.value,
      room_depth: depthCheck.value
    }
  };
}

function checkRangedNumber(
  name: string,
  value: unknown
):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < SIMULATION_DIMENSION_MIN_M ||
    value > SIMULATION_DIMENSION_MAX_M
  ) {
    return {
      ok: false,
      message:
        `${name} must be a number between ${SIMULATION_DIMENSION_MIN_M} and ${SIMULATION_DIMENSION_MAX_M} metres`
    };
  }
  return { ok: true, value };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
