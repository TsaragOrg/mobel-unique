// SPEC-0007 corner-placement validation rules.
//
// Pure functions that catch the common gpt-image-2 mistakes on the
// corners step:
//   - back_wall dots stuck to the photo frame edge instead of the seam
//   - top/bottom dots on different vertical columns (left or right
//     seam not actually traced)
//   - corner mode bottom-center floating above floor level
//   - corner mode frame-edge dots stopped in the middle of the wall
//
// Used by `OpenAICornersProvider` to decide when to retry, and by the
// `corners.mjs` live-pipeline script for the same self-healing loop.
//
// The thresholds below are tuned for the failure modes observed on
// real customer photos: cf. memory `feedback_corner_dots_floor_anchor`
// and the live-harness 2026-04-30 back_wall miss where TL landed at
// X=82 / BL at X=212 on a 1083-wide image (Δ≈12% of width).

import type {
  BackWallCorners,
  ClassifiedCorners,
  CornerCorners
} from "./lines-classify.ts";

export const FRAME_EDGE_AVOID_RATIO = 0.01;
export const VERTICAL_ALIGN_TOLERANCE_RATIO = 0.06;
export const FRAME_EDGE_NEAR_RATIO = 0.15;
export const HALF_HEIGHT_RATIO = 0.5;

export type CornerValidationResult =
  | { ok: true }
  | { ok: false; failureReason: string };

export function validateBackWallCorners(
  corners: BackWallCorners,
  imageWidth: number,
  imageHeight: number
): CornerValidationResult {
  const avoidMargin = imageWidth * FRAME_EDGE_AVOID_RATIO;
  const alignTol = imageWidth * VERTICAL_ALIGN_TOLERANCE_RATIO;
  const { topLeft, topRight, bottomLeft, bottomRight } = corners;

  if (topLeft.x < avoidMargin) {
    return {
      ok: false,
      failureReason:
        `top-left dot too close to frame edge (X=${topLeft.x}, expected >= ${Math.round(avoidMargin)}); back-wall seam is inside the frame, not on the photo edge`
    };
  }
  if (bottomLeft.x < avoidMargin) {
    return {
      ok: false,
      failureReason:
        `bottom-left dot too close to frame edge (X=${bottomLeft.x})`
    };
  }
  if (topRight.x > imageWidth - avoidMargin) {
    return {
      ok: false,
      failureReason:
        `top-right dot too close to right frame edge (X=${topRight.x}, max=${Math.round(imageWidth - avoidMargin)})`
    };
  }
  if (bottomRight.x > imageWidth - avoidMargin) {
    return {
      ok: false,
      failureReason:
        `bottom-right dot too close to right frame edge (X=${bottomRight.x})`
    };
  }
  if (Math.abs(topLeft.x - bottomLeft.x) > alignTol) {
    return {
      ok: false,
      failureReason:
        `left seam dots not on the same vertical: TL.x=${topLeft.x} BL.x=${bottomLeft.x} (Δ=${Math.abs(topLeft.x - bottomLeft.x)} > ${Math.round(alignTol)})`
    };
  }
  if (Math.abs(topRight.x - bottomRight.x) > alignTol) {
    return {
      ok: false,
      failureReason:
        `right seam dots not on the same vertical: TR.x=${topRight.x} BR.x=${bottomRight.x}`
    };
  }
  if (topLeft.y >= bottomLeft.y) {
    return {
      ok: false,
      failureReason:
        `top-left not above bottom-left (TL.y=${topLeft.y} BL.y=${bottomLeft.y})`
    };
  }
  if (topRight.y >= bottomRight.y) {
    return {
      ok: false,
      failureReason:
        `top-right not above bottom-right (TR.y=${topRight.y} BR.y=${bottomRight.y})`
    };
  }
  if (topLeft.x >= topRight.x) {
    return {
      ok: false,
      failureReason: `top-left not left of top-right`
    };
  }
  if (bottomLeft.x >= bottomRight.x) {
    return {
      ok: false,
      failureReason: `bottom-left not left of bottom-right`
    };
  }
  if (imageHeight <= 0) {
    return {
      ok: false,
      failureReason: `image height must be positive (got ${imageHeight})`
    };
  }
  return { ok: true };
}

export function validateCornerCorners(
  corners: CornerCorners,
  imageWidth: number,
  imageHeight: number
): CornerValidationResult {
  const nearMargin = imageWidth * FRAME_EDGE_NEAR_RATIO;
  const alignTol = imageWidth * VERTICAL_ALIGN_TOLERANCE_RATIO;
  const halfHeight = imageHeight * HALF_HEIGHT_RATIO;
  const {
    topLeft,
    topCenter,
    topRight,
    bottomLeft,
    bottomCenter,
    bottomRight
  } = corners;

  if (Math.abs(topCenter.x - bottomCenter.x) > alignTol) {
    return {
      ok: false,
      failureReason:
        `inner-edge dots not on the same vertical: TC.x=${topCenter.x} BC.x=${bottomCenter.x} (Δ=${Math.abs(topCenter.x - bottomCenter.x)} > ${Math.round(alignTol)})`
    };
  }
  if (bottomCenter.y < halfHeight) {
    return {
      ok: false,
      failureReason:
        `bottom-center not on the floor (Y=${bottomCenter.y} < half=${Math.round(halfHeight)})`
    };
  }
  if (topCenter.y > halfHeight) {
    return {
      ok: false,
      failureReason:
        `top-center not on the ceiling (Y=${topCenter.y} > half=${Math.round(halfHeight)})`
    };
  }
  if (topLeft.x > nearMargin) {
    return {
      ok: false,
      failureReason:
        `top-left not at left frame edge (X=${topLeft.x} > ${Math.round(nearMargin)})`
    };
  }
  if (bottomLeft.x > nearMargin) {
    return {
      ok: false,
      failureReason:
        `bottom-left not at left frame edge (X=${bottomLeft.x} > ${Math.round(nearMargin)})`
    };
  }
  if (topRight.x < imageWidth - nearMargin) {
    return {
      ok: false,
      failureReason:
        `top-right not at right frame edge (X=${topRight.x} < ${Math.round(imageWidth - nearMargin)})`
    };
  }
  if (bottomRight.x < imageWidth - nearMargin) {
    return {
      ok: false,
      failureReason:
        `bottom-right not at right frame edge (X=${bottomRight.x})`
    };
  }
  if (topLeft.y >= bottomLeft.y) {
    return { ok: false, failureReason: `top-left not above bottom-left` };
  }
  if (topRight.y >= bottomRight.y) {
    return { ok: false, failureReason: `top-right not above bottom-right` };
  }
  if (topCenter.y >= bottomCenter.y) {
    return { ok: false, failureReason: `top-center not above bottom-center` };
  }
  return { ok: true };
}

export function validateClassifiedCorners(
  corners: ClassifiedCorners,
  imageWidth: number,
  imageHeight: number
): CornerValidationResult {
  if (corners.mode === "back_wall") {
    return validateBackWallCorners(corners, imageWidth, imageHeight);
  }
  return validateCornerCorners(corners, imageWidth, imageHeight);
}
