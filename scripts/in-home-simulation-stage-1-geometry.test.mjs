import { describe, expect, it } from "vitest";

import {
  dimensionGuideArrowsForBackWall,
  dimensionGuideArrowsForCorner,
  isHeicLikeExtension,
  placeholderBackWallGeometry
} from "../supabase/functions/in-home-simulation-worker/lib/geometry.ts";

describe("placeholderBackWallGeometry", () => {
  it("returns four points ordered bottom-left, bottom-right, top-right, top-left", () => {
    const geometry = placeholderBackWallGeometry(1000, 800);

    expect(geometry.mode).toBe("back_wall");
    expect(geometry.points).toHaveLength(4);
    const [bl, br, tr, tl] = geometry.points;
    expect(bl.y).toBeGreaterThan(tl.y);
    expect(br.y).toBeGreaterThan(tr.y);
    expect(br.x).toBeGreaterThan(bl.x);
    expect(tr.x).toBeGreaterThan(tl.x);
    expect(bl.x).toBe(tl.x);
    expect(br.x).toBe(tr.x);
    expect(bl.y).toBe(br.y);
    expect(tl.y).toBe(tr.y);
  });

  it("insets by 10 percent of the matching dimension", () => {
    const geometry = placeholderBackWallGeometry(1000, 800);
    const [bl, br, tr, tl] = geometry.points;

    expect(bl.x).toBe(100);
    expect(br.x).toBe(900);
    expect(tl.y).toBe(80);
    expect(bl.y).toBe(720);
    expect(tr.x).toBe(900);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => placeholderBackWallGeometry(0, 100)).toThrow(/positive width/);
    expect(() => placeholderBackWallGeometry(100, 0)).toThrow(/positive height/);
    expect(() => placeholderBackWallGeometry(-1, 100)).toThrow(/positive width/);
    expect(() => placeholderBackWallGeometry(100, -1)).toThrow(/positive height/);
  });
});

describe("dimensionGuideArrowsForBackWall", () => {
  const geometry = placeholderBackWallGeometry(1000, 800);
  const labels = { wallWidth: "Largeur mur", wallHeight: "Hauteur mur" };
  const arrows = dimensionGuideArrowsForBackWall(geometry, 1000, 800, labels);

  it("emits three arrows for the back-wall mode", () => {
    expect(arrows).toHaveLength(3);
  });

  it("places the bottom width arrow below the floor anchors", () => {
    const bottom = arrows[0];
    expect(bottom.label).toBe(labels.wallWidth);
    expect(bottom.from.y).toBeGreaterThan(geometry.points[0].y);
    expect(bottom.to.y).toBe(bottom.from.y);
  });

  it("places the height arrow to the right of the right wall", () => {
    const height = arrows[1];
    expect(height.label).toBe(labels.wallHeight);
    expect(height.from.x).toBeGreaterThan(geometry.points[1].x);
    expect(height.from.x).toBe(height.to.x);
    expect(height.from.y).toBeGreaterThan(height.to.y);
  });

  it("uses language-tagged labels rather than numeric measurements", () => {
    for (const arrow of arrows) {
      expect(arrow.label).not.toMatch(/\d/);
      expect(arrow.label.length).toBeGreaterThan(0);
    }
  });
});

describe("dimensionGuideArrowsForCorner", () => {
  const geometry = {
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
  const labels = {
    leftWallWidth: "Largeur mur gauche",
    rightWallWidth: "Largeur mur droit",
    roomHeight: "Hauteur pièce"
  };
  const arrows = dimensionGuideArrowsForCorner(geometry, 1000, 800, labels);

  it("emits three arrows for the corner mode", () => {
    expect(arrows).toHaveLength(3);
  });

  it("emits the three required corner labels", () => {
    const labelsFound = new Set(arrows.map((a) => a.label));
    expect(labelsFound).toEqual(
      new Set([labels.leftWallWidth, labels.rightWallWidth, labels.roomHeight])
    );
  });

  it("places horizontal width arrows below the floor", () => {
    const horizontal = arrows.filter((a) => a.from.y === a.to.y);
    expect(horizontal).toHaveLength(2);
    for (const arrow of horizontal) {
      expect(arrow.from.y).toBeGreaterThan(700);
    }
  });
});

describe("isHeicLikeExtension", () => {
  it("matches .heic and .heif (case-insensitive)", () => {
    expect(isHeicLikeExtension("photo.heic")).toBe(true);
    expect(isHeicLikeExtension("photo.HEIF")).toBe(true);
    expect(isHeicLikeExtension("foo.HeIc")).toBe(true);
  });

  it("rejects other extensions and empty inputs", () => {
    expect(isHeicLikeExtension("photo.jpg")).toBe(false);
    expect(isHeicLikeExtension("photo.png")).toBe(false);
    expect(isHeicLikeExtension("")).toBe(false);
    expect(isHeicLikeExtension(null)).toBe(false);
    expect(isHeicLikeExtension(undefined)).toBe(false);
  });
});
