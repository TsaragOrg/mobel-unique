// SPEC-0007 PLAN-0010 in-home simulation Stage 1 geometry helpers.
//
// These helpers compute deterministic placeholder room geometry and the
// dimension-guide arrow specifications used by the Stage 1 overlay
// renderer. They are pure functions with no Deno-specific imports so
// they can be exercised by vitest and reused inside the Edge Function.

export type Point = { x: number; y: number };

export type BackWallGeometry = {
  mode: "back_wall";
  // Order matches SPEC-0007: bottom-left, bottom-right, top-right, top-left.
  points: [Point, Point, Point, Point];
};

export type CornerPoints = {
  corner_floor: Point;
  corner_ceiling: Point;
  left_wall_floor_outer: Point;
  left_wall_ceiling_outer: Point;
  right_wall_floor_outer: Point;
  right_wall_ceiling_outer: Point;
};

export type CornerGeometry = {
  mode: "corner";
  points: CornerPoints;
};

export type GuideArrow = {
  from: Point;
  to: Point;
  label: string;
};

const BACK_WALL_INSET_RATIO = 0.1;
const ARROW_OFFSET_RATIO = 0.05;

export function placeholderBackWallGeometry(
  width: number,
  height: number
): BackWallGeometry {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error("placeholderBackWallGeometry requires a positive width");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("placeholderBackWallGeometry requires a positive height");
  }
  const insetX = Math.round(width * BACK_WALL_INSET_RATIO);
  const insetY = Math.round(height * BACK_WALL_INSET_RATIO);
  return {
    mode: "back_wall",
    points: [
      { x: insetX, y: height - insetY },
      { x: width - insetX, y: height - insetY },
      { x: width - insetX, y: insetY },
      { x: insetX, y: insetY }
    ]
  };
}

export function dimensionGuideArrowsForBackWall(
  geometry: BackWallGeometry,
  imageWidth: number,
  imageHeight: number,
  labels: { wallWidth: string; wallHeight: string }
): GuideArrow[] {
  const [bl, br, tr, tl] = geometry.points;
  const widthOffset = Math.max(8, Math.round(imageHeight * ARROW_OFFSET_RATIO));
  const heightOffset = Math.max(8, Math.round(imageWidth * ARROW_OFFSET_RATIO));
  return [
    {
      from: { x: bl.x, y: bl.y + widthOffset },
      to: { x: br.x, y: br.y + widthOffset },
      label: labels.wallWidth
    },
    {
      from: { x: br.x + heightOffset, y: br.y },
      to: { x: tr.x + heightOffset, y: tr.y },
      label: labels.wallHeight
    },
    {
      from: { x: tl.x, y: tl.y - widthOffset },
      to: { x: tr.x, y: tr.y - widthOffset },
      label: labels.wallWidth
    }
  ];
}

export function dimensionGuideArrowsForCorner(
  geometry: CornerGeometry,
  imageWidth: number,
  imageHeight: number,
  labels: { leftWallWidth: string; rightWallWidth: string; roomHeight: string }
): GuideArrow[] {
  const widthOffset = Math.max(8, Math.round(imageHeight * ARROW_OFFSET_RATIO));
  const heightOffset = Math.max(8, Math.round(imageWidth * ARROW_OFFSET_RATIO));
  const p = geometry.points;
  return [
    {
      from: {
        x: p.left_wall_floor_outer.x,
        y: p.left_wall_floor_outer.y + widthOffset
      },
      to: { x: p.corner_floor.x, y: p.corner_floor.y + widthOffset },
      label: labels.leftWallWidth
    },
    {
      from: { x: p.corner_floor.x, y: p.corner_floor.y + widthOffset },
      to: {
        x: p.right_wall_floor_outer.x,
        y: p.right_wall_floor_outer.y + widthOffset
      },
      label: labels.rightWallWidth
    },
    {
      from: {
        x: p.corner_floor.x - heightOffset,
        y: p.corner_floor.y
      },
      to: {
        x: p.corner_ceiling.x - heightOffset,
        y: p.corner_ceiling.y
      },
      label: labels.roomHeight
    }
  ];
}

export function isHeicLikeExtension(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}
