#!/usr/bin/env node
// SPEC-0007 alternative geometry visualization — gpt-image-2 marks the
// architectural corners and draws the dimension guide directly on the
// cleaned room photograph in a single call.
//
// Use this script when you only need a visual guide for the visitor
// (numerical coordinates are not required). It replaces the
// geometry + overlay pair with a single image-edit call.
//
// Usage:
//   pnpm sim:live:corners -- --photo /path/to/room_cleaned.png

import { decode } from "imagescript";

import {
  base64ToBytes,
  callOpenAIImagesEdit,
  defaultRunDir,
  detectMimeType,
  fail,
  info,
  parseArgs,
  readPhoto,
  requireEnv,
  writeArtifact
} from "./lib.mjs";

const MAX_CORNER_PLACEMENT_ATTEMPTS = 3;
const FRAME_EDGE_AVOID_RATIO = 0.01;
const VERTICAL_ALIGN_TOLERANCE_RATIO = 0.06;
const FRAME_EDGE_NEAR_RATIO = 0.15;
const HALF_HEIGHT_RATIO = 0.5;
const MIN_DOT_PIXELS = 30;

function isYellow(r, g, b) {
  return r > 220 && g > 190 && b < 110 && r - b > 120 && r - g < 80;
}

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

function validateBackWallCorners(c, w) {
  const avoid = w * FRAME_EDGE_AVOID_RATIO;
  const align = w * VERTICAL_ALIGN_TOLERANCE_RATIO;
  if (c.topLeft.x < avoid) {
    return { ok: false, failureReason: `top-left too close to frame edge (X=${c.topLeft.x})` };
  }
  if (c.bottomLeft.x < avoid) {
    return { ok: false, failureReason: `bottom-left too close to frame edge (X=${c.bottomLeft.x})` };
  }
  if (c.topRight.x > w - avoid) {
    return { ok: false, failureReason: `top-right too close to right frame edge (X=${c.topRight.x})` };
  }
  if (c.bottomRight.x > w - avoid) {
    return { ok: false, failureReason: `bottom-right too close to right frame edge (X=${c.bottomRight.x})` };
  }
  if (Math.abs(c.topLeft.x - c.bottomLeft.x) > align) {
    return { ok: false, failureReason: `left seam dots not on same vertical: TL.x=${c.topLeft.x} BL.x=${c.bottomLeft.x}` };
  }
  if (Math.abs(c.topRight.x - c.bottomRight.x) > align) {
    return { ok: false, failureReason: `right seam dots not on same vertical: TR.x=${c.topRight.x} BR.x=${c.bottomRight.x}` };
  }
  if (c.topLeft.y >= c.bottomLeft.y) {
    return { ok: false, failureReason: `top-left not above bottom-left` };
  }
  if (c.topRight.y >= c.bottomRight.y) {
    return { ok: false, failureReason: `top-right not above bottom-right` };
  }
  if (c.topLeft.x >= c.topRight.x || c.bottomLeft.x >= c.bottomRight.x) {
    return { ok: false, failureReason: `left/right swapped` };
  }
  return { ok: true };
}

function validateCornerCorners(c, w, h) {
  const near = w * FRAME_EDGE_NEAR_RATIO;
  const align = w * VERTICAL_ALIGN_TOLERANCE_RATIO;
  const half = h * HALF_HEIGHT_RATIO;
  if (Math.abs(c.topCenter.x - c.bottomCenter.x) > align) {
    return { ok: false, failureReason: `inner-edge dots not on same vertical: TC.x=${c.topCenter.x} BC.x=${c.bottomCenter.x}` };
  }
  if (c.bottomCenter.y < half) {
    return { ok: false, failureReason: `bottom-center not on floor (Y=${c.bottomCenter.y})` };
  }
  if (c.topCenter.y > half) {
    return { ok: false, failureReason: `top-center not on ceiling (Y=${c.topCenter.y})` };
  }
  if (c.topLeft.x > near || c.bottomLeft.x > near) {
    return { ok: false, failureReason: `left frame-edge dots stopped in middle of wall` };
  }
  if (c.topRight.x < w - near || c.bottomRight.x < w - near) {
    return { ok: false, failureReason: `right frame-edge dots stopped in middle of wall` };
  }
  if (c.topLeft.y >= c.bottomLeft.y || c.topRight.y >= c.bottomRight.y || c.topCenter.y >= c.bottomCenter.y) {
    return { ok: false, failureReason: `top/bottom Y ordering broken` };
  }
  return { ok: true };
}

async function validateReturnedDots(bytes, expectedMode, expectedDots) {
  let image;
  try {
    image = await decode(Buffer.from(bytes));
  } catch (error) {
    return { ok: false, failureReason: `decode failed: ${error.message ?? error}` };
  }
  const dots = detectYellowDots(image);
  if (expectedDots !== null && dots.length !== expectedDots) {
    return {
      ok: false,
      failureReason: `expected ${expectedDots} dots, found ${dots.length}`
    };
  }
  if (dots.length !== 4 && dots.length !== 6) {
    return { ok: false, failureReason: `dot count ${dots.length} not 4 or 6` };
  }
  const corners = dots.length === 4 ? classifyBackWall(dots) : classifyCorner(dots);
  if (expectedMode && expectedMode !== "auto" && corners.mode !== expectedMode) {
    return {
      ok: false,
      failureReason: `mode ${corners.mode} != expected ${expectedMode}`
    };
  }
  return corners.mode === "back_wall"
    ? validateBackWallCorners(corners, image.width, image.height)
    : validateCornerCorners(corners, image.width, image.height);
}

const PROMPT_AUTO = [
  "You are looking at a residential room photograph. Place small bright yellow dots at the architectural corners of the room. Do not draw any lines, arrows, shapes, numbers, labels, or text — only yellow dots.",
  "",
  "FIRST decide which case this photo is:",
  "- CASE A — flat back wall: the camera points straight at ONE main wall. You can see the whole back wall as a roughly rectangular shape. There is no obvious vertical edge in the middle of the image where two walls meet at a corner.",
  "- CASE B — inner corner: the camera points INTO a corner. Two walls meet at a clear VERTICAL EDGE that runs from floor to ceiling somewhere near the middle of the image, and each of the two walls extends outward to one side.",
  "",
  "Decide A or B before placing any dot. Use the most obvious case. If unsure, choose CASE A.",
  "",
  "QUICK TEST to decide A vs B:",
  "- Is there ONE main flat wall facing the camera, occupying most of the frame? → CASE A.",
  "- Even if you can see PART of a side wall extending toward the camera on the left OR on the right, that does NOT make it CASE B. CASE A still applies as long as there is one obvious main flat wall facing the camera.",
  "- CASE B applies ONLY when the camera is pointed straight INTO a corner: there is a clear vertical edge near the middle of the image where two walls meet, AND both walls extend outward to BOTH sides of that edge with roughly equal prominence.",
  "- If you have to think hard about which case it is, choose CASE A.",
  "",
  "IF CASE A — place EXACTLY 4 dots. Not 3. Not 5. Not 6. EXACTLY 4. Count: 1, 2, 3, 4. Stop. The 4 corners are the corners OF THE BACK WALL, NOT corners along the side walls. The BACK WALL is the flat surface the camera is facing. It ENDS where it meets a side wall. Place the dots EXACTLY on that meeting seam — the vertical line where the back wall transitions into the side wall. Do NOT place a dot further along the side wall. If you can still see the side wall extending beyond your dot, the dot is too far — pull it back to the seam.",
  "- top-left: the seam where the back wall meets the LEFT side wall, at the CEILING.",
  "- top-right: the seam where the back wall meets the RIGHT side wall, at the CEILING.",
  "- bottom-left: the seam where the back wall meets the LEFT side wall, at the FLOOR.",
  "- bottom-right: the seam where the back wall meets the RIGHT side wall, at the FLOOR.",
  "Doors, windows, AC units, sockets, vents, frames, or any object in front of or set into the back wall do NOT change where the back wall ends. The back wall only ends at the perpendicular side wall.",
  "",
  "IF CASE B — place EXACTLY 6 dots. Not 5. Not 7. EXACTLY 6. Count: 1, 2, 3, 4, 5, 6. Stop. The 6 corners are:",
  "- top of the inner vertical edge: where the LEFT wall, the RIGHT wall, and the CEILING all meet.",
  "- bottom of the inner vertical edge: where the LEFT wall, the RIGHT wall, and the FLOOR all meet.",
  "- left wall, top: at the EXTREME FAR END of the LEFT wall along the ceiling — push the dot all the way to the next perpendicular wall or to the photo edge, whichever is first.",
  "- left wall, bottom: at the EXTREME FAR END of the LEFT wall along the floor (same rule).",
  "- right wall, top: at the EXTREME FAR END of the RIGHT wall along the ceiling (same rule).",
  "- right wall, bottom: at the EXTREME FAR END of the RIGHT wall along the floor (same rule).",
  "",
  "If you finish with more dots than required, erase the extras until only the correct count remains.",
  "",
  "GLOBAL RULES (both cases):",
  "- A door, window, air conditioner, socket, switch, vent, or any other object set into a wall does NOT end the wall. The wall continues past those objects until it physically meets the adjacent perpendicular wall. The corner dot goes on that true architectural meeting point.",
  "- Common mistake to avoid: do NOT place a dot in the middle of a wall. Each dot must sit on a true architectural corner, pushed all the way to the structural meeting point.",
  "- Do not modify the photograph in any other way. Preserve the original colors, lighting, and content.",
  "- Return only the annotated image."
].join("\n");

const PROMPT_BACK_WALL = [
  "You are looking at a residential room photograph. Place small bright yellow dots at the architectural corners of the room.",
  "",
  "GENERAL RULE — how many dots:",
  "- If the camera points flat at one wall (one main wall in front of you), place EXACTLY 4 dots, one at each corner of that wall.",
  "- If the camera points into a corner (two walls meet at a vertical edge in the middle of the image), place EXACTLY 6 dots.",
  "",
  "THIS PHOTO is a flat back wall. You MUST place EXACTLY 4 dots. Not 3. Not 5. Not 6. EXACTLY 4. Count out loud as you place them: 1, 2, 3, 4. Stop. If you ever consider placing a 5th dot, do not. If you finish with more than 4 dots, erase the extras until only 4 remain.",
  "",
  "The 4 corners are the corners OF THE BACK WALL itself — the flat surface the camera is facing. The back wall ENDS where it meets a side wall. Place the dots EXACTLY on that meeting seam — the vertical line where the back wall transitions into the side wall. Do NOT place a dot further along the side wall. If you can still see the side wall extending beyond your dot, the dot is too far — pull it back to the seam.",
  "- top-left: the seam where the back wall meets the LEFT side wall, at the CEILING.",
  "- top-right: the seam where the back wall meets the RIGHT side wall, at the CEILING.",
  "- bottom-left: the seam where the back wall meets the LEFT side wall, at the FLOOR.",
  "- bottom-right: the seam where the back wall meets the RIGHT side wall, at the FLOOR.",
  "",
  "FRAME-EDGE WARNING — common mistake on back_wall photos:",
  "- The frame edge of the photograph is NOT the seam. Do NOT place dots at the very LEFT or RIGHT edge of the photo (X near 0, or X near image width). The back wall ends at an architectural seam INSIDE the frame, not on the frame edge itself.",
  "- If you can see ANY portion of the side wall extending toward the camera on the left, the LEFT seam is several percent of width away from X=0, not on the frame. Place top-left and bottom-left ON that interior seam, not on the frame edge.",
  "- Same on the right: if any side wall is visible on the right, the RIGHT seam is several percent of width away from the right edge. Do not push the right dots to the photo edge.",
  "- A dot whose X is within 3% of the photo edge is almost certainly wrong unless the back wall genuinely fills the photo edge-to-edge with no visible side wall at all.",
  "",
  "VERTICAL ALIGNMENT — STRICT REQUIREMENT:",
  "- The LEFT seam (where the back wall meets the LEFT side wall) is ONE single vertical line that runs from the FLOOR to the CEILING. The top-left dot and the bottom-left dot must BOTH sit on that same vertical line — top-left at the very top of the seam, bottom-left at the very bottom of the same seam. The top-left dot must appear DIRECTLY ABOVE the bottom-left dot — same column of pixels. If they are not vertically aligned, one of them is misplaced.",
  "- The RIGHT seam works the same way: the top-right dot must appear DIRECTLY ABOVE the bottom-right dot, both sitting on the single vertical line where the back wall meets the RIGHT side wall.",
  "- Together, the 4 dots outline the back wall as a quadrilateral whose LEFT edge is one vertical line and whose RIGHT edge is one vertical line.",
  "- SELF-CHECK before returning: top-left and bottom-left should share the same X (column of pixels) within a few percent of width; top-right and bottom-right the same. If the two left dots are clearly on different X coordinates, you have not traced one single seam — pick the actual seam and place both dots on it.",
  "",
  "A door, window, air conditioner, socket, switch, vent, radiator, or any other object set into the wall does NOT end the wall. The back wall continues past these objects until it physically meets the adjacent perpendicular side wall. The corner dot goes on that true architectural meeting point, not on a door frame, not on a window frame, not on any object.",
  "",
  "If a door, niche, or built-in feature appears at the very edge of the back wall on the right side, the bottom-right dot must be placed AFTER that feature, where the back wall finally meets the right side wall and the floor — not on the feature itself.",
  "",
  "Do not draw lines, arrows, shapes, numbers, labels, text, or any other markings. Only the yellow dots.",
  "Do not change colors, lighting, or content. Keep the photograph exactly as-is, only add the yellow dots.",
  "Return only the annotated image."
].join("\n");

const PROMPT_CORNER = [
  "You are looking at a residential room photograph. Place small bright yellow dots at the architectural corners of the room.",
  "",
  "GENERAL RULE — how many dots:",
  "- If the camera points flat at one wall (one main wall in front of you), place EXACTLY 4 dots.",
  "- If the camera points into a corner (you see two walls meeting at a vertical edge), place EXACTLY 6 dots.",
  "",
  "THIS PHOTO is a corner — the camera points at where two walls meet. You MUST place EXACTLY 6 dots. Not 5. Not 7. EXACTLY 6. Count out loud as you place them: 1, 2, 3, 4, 5, 6. Stop. If you finish with more than 6 dots, erase the extras until only 6 remain.",
  "",
  "The 6 dots are TWO inner-edge dots (in the middle of the image) and FOUR frame-edge dots (at the left and right edges of the photo):",
  "",
  "INNER VERTICAL EDGE — 2 dots in the middle of the image, where the LEFT wall and the RIGHT wall meet at one vertical line:",
  "- TOP inner-edge dot: where the LEFT wall, the RIGHT wall, and the CEILING all meet.",
  "- BOTTOM inner-edge dot: where the LEFT wall, the RIGHT wall, and the FLOOR all meet. THIS DOT MUST BE ON THE FLOOR. It sits at the deepest visible point of the room — the architectural corner where the two walls and the floor all touch. NEVER place this dot on a wall surface, near an AC unit, near a window, near a switch, near a socket, or anywhere above the floor. Its vertical position must be at floor level — the lowest meeting point of the two walls. If you find yourself placing this dot mid-height on a wall, you are wrong; drop it down to the floor seam.",
  "",
  "FRAME EDGE — 4 dots at the very LEFT and RIGHT edges of the photograph:",
  "- LEFT wall, TOP: trace the ceiling-wall line of the LEFT wall outward from the inner vertical edge toward the LEFT side of the photo. Place the dot exactly where this ceiling-wall line meets the LEFT EDGE of the photograph (X near 0).",
  "- LEFT wall, BOTTOM: trace the floor-wall line of the LEFT wall outward toward the LEFT and place the dot where it meets the LEFT EDGE of the photograph (X near 0).",
  "- RIGHT wall, TOP: trace the ceiling-wall line of the RIGHT wall outward toward the RIGHT and place the dot where it meets the RIGHT EDGE of the photograph (X near image width).",
  "- RIGHT wall, BOTTOM: trace the floor-wall line of the RIGHT wall outward toward the RIGHT and place the dot where it meets the RIGHT EDGE of the photograph (X near image width).",
  "",
  "In this corner mode, the LEFT wall and the RIGHT wall ALWAYS extend out all the way to the LEFT and RIGHT edges of the photograph. There is NO perpendicular wall ending them inside the frame. If you stop a dot in the middle of a wall, you are wrong — push it all the way to the photo edge.",
  "",
  "FLOOR-LEVEL / CEILING-LEVEL CHECK — apply BEFORE returning the image:",
  "- Of the 6 dots, exactly THREE must sit at floor level: left wall bottom, bottom inner-edge, right wall bottom. Their Y-coordinate must be in the LOWER portion of the image, near the floor seam.",
  "- Of the 6 dots, exactly THREE must sit at ceiling level: left wall top, top inner-edge, right wall top. Their Y-coordinate must be in the UPPER portion of the image, near the ceiling seam.",
  "- If your bottom inner-edge dot is ABOVE the half-height of the image, it is wrong. Move it down to the actual floor where the two walls meet.",
  "",
  "VERTICAL-EDGE CHECK — apply BEFORE returning the image:",
  "- The TOP inner-edge dot and the BOTTOM inner-edge dot are the two ends of ONE single vertical line in the real room — the corner where the two walls meet. In the photo, that real-world vertical line stays vertical: it appears as a single column of pixels running from ceiling to floor.",
  "- Therefore the TOP inner-edge dot MUST sit DIRECTLY ABOVE the BOTTOM inner-edge dot — same X coordinate (same column of pixels). The horizontal distance between them must be zero or near zero.",
  "- If you place the top inner-edge dot at one X and the bottom inner-edge dot at a clearly different X, you are wrong. Move them so they share one vertical column.",
  "",
  "FRAME-EDGE CHECK for the 4 outer dots — apply BEFORE returning the image:",
  "- Left wall TOP and Left wall BOTTOM must sit at the LEFT EDGE of the photograph: X coordinate near 0.",
  "- Right wall TOP and Right wall BOTTOM must sit at the RIGHT EDGE of the photograph: X coordinate near the image width.",
  "- If your left-wall outer dots are at X=300 or X=500 in a 1000-wide image, they are wrong: push them to X near 0 (the left photo edge).",
  "- Same on the right side: push the right-wall outer dots to the right photo edge.",
  "",
  "VERY IMPORTANT — common mistake to avoid: do NOT place the four outer dots in the middle of a wall. They must be at the very LEFT and RIGHT edges of the photograph. If you can still see wall to the LEFT of your left-edge dot, the dot is in the wrong place — move it further left until it reaches the photo edge.",
  "",
  "SELF-CHECK before returning, in this exact order:",
  "1. Bottom inner-edge dot Y is in the LOWER half of the image (near the floor seam). If above the half-line, move it down.",
  "2. Top inner-edge dot Y is in the UPPER half of the image (near the ceiling seam).",
  "3. Top inner-edge X equals bottom inner-edge X within a few percent of width — they sit on one vertical column.",
  "4. Left wall TOP and Left wall BOTTOM both have X within ~15% of 0.",
  "5. Right wall TOP and Right wall BOTTOM both have X within ~15% of image width.",
  "If any of these checks fail, fix the offending dot before returning.",
  "",
  "A door, window, air conditioner, socket, switch, vent, COLUMN, pilaster, wall protrusion, niche, alcove, radiator, or any other object on or set into a wall does NOT change anything. Trace past these objects along the visible base or ceiling line of the wall all the way to the photo edge. The corner dot goes on the photo edge, never on an object.",
  "",
  "Do not draw lines, arrows, shapes, numbers, labels, text, or any other markings. Only the yellow dots.",
  "Do not change colors, lighting, or content. Keep the photograph exactly as-is, only add the yellow dots.",
  "Return only the annotated image."
].join("\n");

function selectPrompt(mode) {
  if (mode === "back_wall") return PROMPT_BACK_WALL;
  if (mode === "corner") return PROMPT_CORNER;
  return PROMPT_AUTO;
}

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-image-2";
const size = args.size ?? "auto";
const mode = args.mode ?? "auto";
const promptText = selectPrompt(mode);
const runDir = args.out ?? defaultRunDir(`corners-${mode}`);

info(`corners: model=${model} size=${size} mode=${mode} photo=${photo.absolute}`);

const expectedDots = mode === "corner" ? 6 : mode === "back_wall" ? 4 : null;
let chosenBytes = null;
let lastFailure = "";

for (let attempt = 1; attempt <= MAX_CORNER_PLACEMENT_ATTEMPTS; attempt++) {
  info(`corners: attempt ${attempt}/${MAX_CORNER_PLACEMENT_ATTEMPTS}`);
  const formData = new FormData();
  formData.set("model", model);
  formData.set("prompt", promptText);
  formData.set("size", size);
  formData.set(
    "image",
    new Blob([photo.bytes], { type: detectMimeType(photo.bytes) }),
    photo.name
  );
  let response;
  try {
    response = await callOpenAIImagesEdit({ apiKey, formData });
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
    info(`corners: attempt ${attempt} api error: ${lastFailure}`);
    continue;
  }
  const b64 = response?.data?.[0]?.b64_json;
  if (!b64 || b64.length === 0) {
    lastFailure = "no image data";
    info(`corners: attempt ${attempt} ${lastFailure}`);
    continue;
  }
  const bytes = base64ToBytes(b64);
  const validation = await validateReturnedDots(bytes, mode, expectedDots);
  if (validation.ok) {
    chosenBytes = bytes;
    info(`corners: attempt ${attempt} passed validation`);
    break;
  }
  lastFailure = validation.failureReason;
  info(`corners: attempt ${attempt} validation failed: ${lastFailure}`);
}

if (!chosenBytes) {
  fail(
    `corners: all ${MAX_CORNER_PLACEMENT_ATTEMPTS} attempts failed. Last: ${lastFailure}`
  );
}

const path = await writeArtifact(
  runDir,
  "room_corners.png",
  Buffer.from(chosenBytes)
);
info(`corners: saved ${path} (${chosenBytes.length} bytes)`);
console.log(path);
