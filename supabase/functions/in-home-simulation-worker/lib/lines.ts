// SPEC-0007 Stage 1 lines step (pure local code, no AI).
//
// Reads the corners-annotated PNG, finds the yellow architectural-
// corner dots, classifies them as back_wall (4 points) or corner (6
// points), and renders the dimension lines and Russian labels on top.
//
// This is the Deno port of `scripts/in-home-simulation-live-pipeline/
// lines.mjs`. Pure helpers (`isYellow`, `classifyDots`, `midpoint`,
// type definitions, `MIN_DOT_PIXELS`) live in `lines-classify.ts` so
// they can be exercised by vitest without needing the Deno-only Image
// import; this file re-exports them for consumers (index.ts) and adds
// the Image-using helpers that depend on imagescript.

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import {
  MIN_DOT_PIXELS,
  classifyDots,
  isYellow,
  midpoint,
  type ClassifiedCorners,
  type Cluster,
  type Point
} from "./lines-classify.ts";

export {
  MIN_DOT_PIXELS,
  classifyBackWall,
  classifyCorner,
  classifyDots,
  isYellow,
  midpoint
} from "./lines-classify.ts";
export type {
  BackWallCorners,
  ClassifiedCorners,
  ClassifyResult,
  Cluster,
  CornerCorners,
  Point
} from "./lines-classify.ts";

export const COLOR_WIDTH = 0xff3b30ff;
export const COLOR_HEIGHT = 0x3498dbff;
export const COLOR_DEPTH = 0x2ecc71ff;

const LABEL_BG = 0x000000d0;
const LABEL_FG = 0xffffffff;

export const LINE_THICKNESS = 8;
const LABEL_PADDING = 8;
const FONT_RATIO = 0.025;

const FONT_URL =
  "https://raw.githubusercontent.com/matmen/ImageScript/master/tests/fonts/Roboto-Regular.ttf";

export function detectYellowDots(image: Image): Cluster[] {
  const w = image.width;
  const h = image.height;
  const visited = new Uint8Array(w * h);
  const clusters: Cluster[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const px = image.getPixelAt(x + 1, y + 1);
      const r = (px >> 24) & 0xff;
      const g = (px >> 16) & 0xff;
      const b = (px >> 8) & 0xff;
      if (!isYellow(r, g, b)) {
        visited[idx] = 1;
        continue;
      }
      const stack: Array<[number, number]> = [[x, y]];
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      while (stack.length > 0) {
        const cell = stack.pop();
        if (!cell) break;
        const [cx, cy] = cell;
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        const cidx = cy * w + cx;
        if (visited[cidx]) continue;
        visited[cidx] = 1;
        const cpx = image.getPixelAt(cx + 1, cy + 1);
        const cr = (cpx >> 24) & 0xff;
        const cg = (cpx >> 16) & 0xff;
        const cb = (cpx >> 8) & 0xff;
        if (!isYellow(cr, cg, cb)) continue;
        sumX += cx;
        sumY += cy;
        count += 1;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      if (count >= MIN_DOT_PIXELS) {
        clusters.push({
          x: Math.round(sumX / count),
          y: Math.round(sumY / count),
          size: count
        });
      }
    }
  }

  clusters.sort((a, b) => b.size - a.size);
  return clusters.slice(0, 6);
}

export function drawThickLine(
  image: Image,
  from: Point,
  to: Point,
  color: number,
  thickness: number
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return;
  const half = Math.floor(thickness / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(from.x + dx * t);
    const y = Math.round(from.y + dy * t);
    image.drawBox(
      Math.max(0, x - half),
      Math.max(0, y - half),
      thickness,
      thickness,
      color
    );
  }
}

let cachedFont: Uint8Array | null = null;
let fontLoadFailed = false;
async function loadFont(): Promise<Uint8Array | null> {
  if (cachedFont) return cachedFont;
  if (fontLoadFailed) return null;
  try {
    const response = await fetch(FONT_URL);
    if (!response.ok) {
      fontLoadFailed = true;
      return null;
    }
    const buffer = await response.arrayBuffer();
    cachedFont = new Uint8Array(buffer);
    return cachedFont;
  } catch (_error) {
    fontLoadFailed = true;
    return null;
  }
}

async function drawLabel(
  image: Image,
  font: Uint8Array | null,
  fontSize: number,
  text: string,
  anchor: Point
): Promise<void> {
  if (!font) return;
  let textImage: Image;
  try {
    textImage = await Image.renderText(font, fontSize, text, LABEL_FG);
  } catch (_error) {
    return;
  }
  const boxW = textImage.width + LABEL_PADDING * 2;
  const boxH = textImage.height + LABEL_PADDING * 2;
  const boxX = Math.max(
    0,
    Math.min(image.width - boxW, anchor.x - Math.round(boxW / 2))
  );
  const boxY = Math.max(
    0,
    Math.min(image.height - boxH, anchor.y - Math.round(boxH / 2))
  );
  image.drawBox(boxX, boxY, boxW, boxH, LABEL_BG);
  image.composite(textImage, boxX + LABEL_PADDING, boxY + LABEL_PADDING);
}

export async function drawDimensionLines(
  image: Image,
  corners: ClassifiedCorners
): Promise<void> {
  const cameraPoint: Point = {
    x: Math.round(image.width / 2),
    y: image.height - 4
  };
  const fontSize = Math.max(28, Math.round(image.height * FONT_RATIO));
  const font = await loadFont();

  if (corners.mode === "back_wall") {
    const widthMid = midpoint(corners.bottomLeft, corners.bottomRight);
    const heightMid = midpoint(corners.bottomLeft, corners.topLeft);
    const depthMid = midpoint(cameraPoint, widthMid);
    drawThickLine(
      image,
      corners.bottomLeft,
      corners.bottomRight,
      COLOR_WIDTH,
      LINE_THICKNESS
    );
    drawThickLine(
      image,
      corners.bottomLeft,
      corners.topLeft,
      COLOR_HEIGHT,
      LINE_THICKNESS
    );
    drawThickLine(image, cameraPoint, widthMid, COLOR_DEPTH, LINE_THICKNESS);
    await drawLabel(image, font, fontSize, "Ширина", widthMid);
    await drawLabel(image, font, fontSize, "Высота", heightMid);
    await drawLabel(image, font, fontSize, "Глубина", depthMid);
    return;
  }

  // corner mode
  const leftWidthMid = midpoint(corners.bottomLeft, corners.bottomCenter);
  const rightWidthMid = midpoint(corners.bottomCenter, corners.bottomRight);
  const heightMid = midpoint(corners.bottomCenter, corners.topCenter);
  const depthMid = midpoint(cameraPoint, corners.bottomCenter);
  drawThickLine(
    image,
    corners.bottomLeft,
    corners.bottomCenter,
    COLOR_WIDTH,
    LINE_THICKNESS
  );
  drawThickLine(
    image,
    corners.bottomCenter,
    corners.bottomRight,
    COLOR_WIDTH,
    LINE_THICKNESS
  );
  drawThickLine(
    image,
    corners.bottomCenter,
    corners.topCenter,
    COLOR_HEIGHT,
    LINE_THICKNESS
  );
  drawThickLine(
    image,
    cameraPoint,
    corners.bottomCenter,
    COLOR_DEPTH,
    LINE_THICKNESS
  );
  await drawLabel(image, font, fontSize, "Лев. стена", leftWidthMid);
  await drawLabel(image, font, fontSize, "Прав. стена", rightWidthMid);
  await drawLabel(image, font, fontSize, "Высота", heightMid);
  await drawLabel(image, font, fontSize, "Глубина", depthMid);
}
