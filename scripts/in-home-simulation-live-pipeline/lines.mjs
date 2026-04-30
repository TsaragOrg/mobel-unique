#!/usr/bin/env node
// SPEC-0007 dimension-lines step.
//
// Reads room_corners.png produced by sim:live:corners (image with 4
// yellow architectural-corner dots from gpt-image-2) and renders the
// three dimension guides — width, height, depth — plus Russian labels
// directly on top of it. The step is pure local code: gpt-image-2 only
// provides the dot positions, the geometry math runs here.
//
// Usage:
//   pnpm sim:live:lines -- --photo /path/to/room_corners.png \
//     [--out tmp/sim-live/...]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Image, decode } from "imagescript";
import {
  defaultRunDir,
  fail,
  info,
  parseArgs,
  readPhoto,
  writeArtifact
} from "./lib.mjs";

const FONT_URL =
  "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf";
const FONT_CACHE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".font-cache",
  "Roboto-Regular.ttf"
);

const COLOR_WIDTH = 0xff3b30ff;
const COLOR_HEIGHT = 0x3498dbff;
const COLOR_DEPTH = 0x2ecc71ff;

const LABEL_BG = 0x000000d0;
const LABEL_FG = 0xffffffff;

const LINE_THICKNESS = 8;
const LABEL_PADDING = 8;
const FONT_RATIO = 0.025;

let cachedFont = null;
async function loadFont() {
  if (cachedFont) return cachedFont;
  if (existsSync(FONT_CACHE_PATH)) {
    cachedFont = new Uint8Array(await readFile(FONT_CACHE_PATH));
    return cachedFont;
  }
  const response = await fetch(FONT_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`could not load font: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  cachedFont = new Uint8Array(buffer);
  await mkdir(dirname(FONT_CACHE_PATH), { recursive: true });
  await writeFile(FONT_CACHE_PATH, cachedFont);
  return cachedFont;
}

function isYellow(r, g, b) {
  return r > 220 && g > 190 && b < 110 && r - b > 120 && r - g < 80;
}

const MIN_DOT_PIXELS = 30;

function detectYellowDots(image) {
  const w = image.width;
  const h = image.height;
  const visited = new Uint8Array(w * h);
  const clusters = [];

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
      const stack = [[x, y]];
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
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

function classifyDots(dots) {
  if (dots.length === 4) return classifyBackWall(dots);
  if (dots.length === 6) return classifyCorner(dots);
  fail(
    `expected 4 or 6 yellow dots, found ${dots.length}. Re-run sim:live:corners or relax the yellow threshold.`
  );
}

function classifyBackWall(dots) {
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

function classifyCorner(dots) {
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

function drawThickLine(image, from, to, color, thickness) {
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

async function drawLabel(image, font, fontSize, text, anchor) {
  let textImage;
  try {
    textImage = await Image.renderText(font, fontSize, text, LABEL_FG);
  } catch (error) {
    info(`label render skipped (${text}): ${error.message ?? error}`);
    return;
  }
  const boxW = textImage.width + LABEL_PADDING * 2;
  const boxH = textImage.height + LABEL_PADDING * 2;
  const boxX = Math.max(0, Math.min(image.width - boxW, anchor.x - Math.round(boxW / 2)));
  const boxY = Math.max(0, Math.min(image.height - boxH, anchor.y - Math.round(boxH / 2)));
  image.drawBox(boxX, boxY, boxW, boxH, LABEL_BG);
  image.composite(textImage, boxX + LABEL_PADDING, boxY + LABEL_PADDING);
}

function midpoint(a, b) {
  return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
}

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const runDir = args.out ?? defaultRunDir("lines");

let image;
try {
  image = await decode(photo.bytes);
} catch (error) {
  fail(`could not decode photo: ${error.message}`);
}

info(`lines: photo=${photo.absolute} size=${image.width}x${image.height}`);

const dots = detectYellowDots(image);
const corners = classifyDots(dots);
const cameraPoint = { x: Math.round(image.width / 2), y: image.height - 4 };
const fontSize = Math.max(28, Math.round(image.height * FONT_RATIO));
const font = await loadFont();

if (corners.mode === "back_wall") {
  info(
    `lines: back_wall — TL=${corners.topLeft.x},${corners.topLeft.y} ` +
    `TR=${corners.topRight.x},${corners.topRight.y} ` +
    `BL=${corners.bottomLeft.x},${corners.bottomLeft.y} ` +
    `BR=${corners.bottomRight.x},${corners.bottomRight.y}`
  );
  const widthMid = midpoint(corners.bottomLeft, corners.bottomRight);
  const heightMid = midpoint(corners.bottomLeft, corners.topLeft);
  const depthMid = midpoint(cameraPoint, widthMid);
  drawThickLine(image, corners.bottomLeft, corners.bottomRight, COLOR_WIDTH, LINE_THICKNESS);
  drawThickLine(image, corners.bottomLeft, corners.topLeft, COLOR_HEIGHT, LINE_THICKNESS);
  drawThickLine(image, cameraPoint, widthMid, COLOR_DEPTH, LINE_THICKNESS);
  await drawLabel(image, font, fontSize, "Ширина", widthMid);
  await drawLabel(image, font, fontSize, "Высота", heightMid);
  await drawLabel(image, font, fontSize, "Глубина", depthMid);
} else {
  info(
    `lines: corner — TL=${corners.topLeft.x},${corners.topLeft.y} ` +
    `TC=${corners.topCenter.x},${corners.topCenter.y} ` +
    `TR=${corners.topRight.x},${corners.topRight.y} ` +
    `BL=${corners.bottomLeft.x},${corners.bottomLeft.y} ` +
    `BC=${corners.bottomCenter.x},${corners.bottomCenter.y} ` +
    `BR=${corners.bottomRight.x},${corners.bottomRight.y}`
  );
  const leftWidthMid = midpoint(corners.bottomLeft, corners.bottomCenter);
  const rightWidthMid = midpoint(corners.bottomCenter, corners.bottomRight);
  const heightMid = midpoint(corners.bottomCenter, corners.topCenter);
  const depthMid = midpoint(cameraPoint, corners.bottomCenter);
  drawThickLine(image, corners.bottomLeft, corners.bottomCenter, COLOR_WIDTH, LINE_THICKNESS);
  drawThickLine(image, corners.bottomCenter, corners.bottomRight, COLOR_WIDTH, LINE_THICKNESS);
  drawThickLine(image, corners.bottomCenter, corners.topCenter, COLOR_HEIGHT, LINE_THICKNESS);
  drawThickLine(image, cameraPoint, corners.bottomCenter, COLOR_DEPTH, LINE_THICKNESS);
  await drawLabel(image, font, fontSize, "Лев. стена", leftWidthMid);
  await drawLabel(image, font, fontSize, "Прав. стена", rightWidthMid);
  await drawLabel(image, font, fontSize, "Высота", heightMid);
  await drawLabel(image, font, fontSize, "Глубина", depthMid);
}

const outBytes = await image.encode(0);
const path = await writeArtifact(runDir, "room_dimensions.png", Buffer.from(outBytes));
info(`lines: saved ${path} (${outBytes.length} bytes)`);
console.log(path);
