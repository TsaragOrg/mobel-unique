#!/usr/bin/env node
// SPEC-0007 PLAN-0011 Stage 2 placement step — live OpenAI image-edit.
//
// Usage:
//   pnpm sim:live:place -- \
//     --room       /path/to/room_cleaned.png \
//     --sofa       /path/to/sofa_prepared.png \
//     [--guide     /path/to/placement_guide.png] \
//     --wall-width 4.2 --wall-height 2.9 --room-depth 3.5 \
//     --sofa-width 3.3 --sofa-height 1.4 \
//     [--unit m] [--out tmp/sim-live/...]
//
// Output: writes <run-dir>/output.png with the sofa placed into the
// cleaned room and prints the absolute path.

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

const PROMPT_TEMPLATE = `You are creating a photorealistic interior image edit from two reference images.

{{FEEDBACK_BLOCK}}{{INPUTS_BLOCK}}
INPUT IMAGE 1 = ROOM BASE PHOTO.
Use this image as the locked scene to edit in place. Preserve the same camera
position, lens feel, perspective, crop, room architecture, floor, walls,
ceiling, lighting direction, color temperature, visible objects, and shadows
except where the sofa must naturally occlude the scene.

INPUT IMAGE 2 = SOFA REFERENCE.
Use this image only as the sofa to insert into the room. Preserve the sofa
design, proportions, upholstery, color, visible legs/base, arms, cushions,
backrest, seams, softness, and material feel. Remove the sofa's original
background, floor, room, lighting setup, camera angle, and any unrelated
objects from input image 2.

DOORS, WINDOWS, AC UNITS, AND OTHER WALL FEATURES DO NOT BLOCK THE SOFA:
- The customer's sofa width is the literal target. It is NOT reduced because a
  door, window, air conditioner, socket, switch, vent, radiator, light fixture,
  niche, alcove, or any other architectural feature appears on the back wall.
- If the sofa at its true real-world width visually covers part of a door,
  window, AC, or any feature, render the sofa IN FRONT of that feature at the
  full requested width. The sofa OCCLUDES the feature.
- NEVER shrink the sofa width to "make room" for a door.
- NEVER shift the sofa horizontally away from its requested position to "avoid"
  a door.
- NEVER tilt, rotate, or angle the sofa to fit around an architectural feature.
- The architectural feature is irrelevant to the sofa size. Treat it as if it
  were a flat painted surface.

INPUT IMAGE 3 = PLACEMENT GUIDE, when provided.
Use this image only as a geometric placement map. It is the same room image with
a bright magenta target rectangle or projected quadrilateral and a green bottom
floor-contact line added by the script. The magenta guide is the exact visible
geometry the sofa must occupy. The green bottom line is where the sofa legs/base
must touch the floor. Do not render the magenta guide, green line, blue wall
calibration, or any guide marks in the final image.

ABSOLUTE GUIDE-LOCK REQUIREMENT:
When INPUT IMAGE 3 is provided, the magenta guide is not a suggestion. It is the
exact final sofa footprint and visible bounding geometry. The generated sofa
must be completely inside the magenta guide. No part of the sofa may extend
outside it: not arms, backrest, cushions, legs, shadows, pillows, fabric edges,
or perspective continuation. Do not move the sofa away from the guide. Do not
make it larger, smaller, taller, shorter, wider, narrower, closer, farther,
higher, lower, or differently rotated than the guide geometry.

REAL-WORLD DIMENSIONS:
- Room width: {{ROOM_WIDTH}} {{UNIT}}
- Room height: {{ROOM_HEIGHT}} {{UNIT}}
- Room depth: {{ROOM_DEPTH}} {{UNIT}}
- Sofa real width: {{SOFA_WIDTH}} {{UNIT}}
- Sofa real height: {{SOFA_HEIGHT}} {{UNIT}}
- Sofa / room-width ratio: {{SOFA_TO_ROOM_WIDTH_PERCENT}}%
- Sofa / room-height ratio: {{SOFA_TO_ROOM_HEIGHT_PERCENT}}%

SCRIPT-CALCULATED DIMENSION PLAN:
{{DIMENSION_CALCULATION}}

SCRIPT-CALCULATED PLACEMENT GUIDE:
{{PLACEMENT_GUIDE_RULES}}

MANDATORY PRE-GENERATION SCALE STEP:
Before generating the final image, use the SCRIPT-CALCULATED DIMENSION PLAN as
the scale plan and use INPUT IMAGE 3 as the exact visible placement box when it
is provided. First determine the room floor plane, wall plane, floor-ceiling
height, horizon, and vanishing points in INPUT IMAGE 1. Then place the sofa only
after converting the real-world sofa width and height into the same perspective
scale. This calculation and the guide box are more important than making the
sofa look like a generic stock sofa size.

If INPUT IMAGE 3 is provided, perform this order of operations:
1. Copy the magenta guide geometry from INPUT IMAGE 3 as the placement boundary.
2. Fit the sofa from INPUT IMAGE 2 inside that boundary.
3. Align the sofa bottom/base/legs exactly to the green guide line.
4. Only after the geometry is locked, blend lighting, shadows, and realism.

DIMENSION AND SCALE RULES:
- The sofa is rendered at EXACTLY the requested real-world dimensions
  ({{SOFA_WIDTH}} {{UNIT}} wide, {{SOFA_HEIGHT}} {{UNIT}} tall). Treat these as
  literal targets, not approximate suggestions.
- ANTI-REGRESSION: the requested sofa is intentionally non-standard. Width
  {{SOFA_WIDTH}} {{UNIT}} is larger than a typical 1.8–2.2 {{UNIT}} sofa;
  height {{SOFA_HEIGHT}} {{UNIT}} is larger than a typical 0.8–0.95 {{UNIT}}
  sofa. Do NOT regress to a generic stock sofa shape. Do NOT shrink toward
  "what a sofa usually looks like". The customer measured this sofa; the
  numbers are the truth.
- If the sofa is placed against the back wall, its visible width MUST occupy
  EXACTLY {{SOFA_TO_ROOM_WIDTH_PERCENT}}% of the real back-wall width,
  adjusted only for perspective and camera angle. Not less. Not more.
- Its visible height MUST be EXACTLY {{SOFA_TO_ROOM_HEIGHT_PERCENT}}% of the
  real room height, adjusted only for perspective and camera angle. A noticeably
  shorter result is unacceptable.
- If INPUT IMAGE 3 is provided, the sofa must fit inside the guide rectangle or
  projected quadrilateral: left edge aligned with the guide left edge, right
  edge aligned with the guide right edge, top aligned with the guide top, and
  visible base or legs on the green bottom line.
- If the sofa design has arms, back cushions, pillows, legs, or protruding
  details, they must still remain inside the magenta guide. The magenta guide is
  the outermost allowed silhouette.
- If INPUT IMAGE 3 uses a magenta quadrilateral instead of an axis-aligned
  rectangle, the sofa front/back silhouette must follow that quadrilateral's
  perspective: bottom-left, bottom-right, top-right, and top-left are the
  projected real-world sofa corners.
- If INPUT IMAGE 3 is provided, do not choose a different sofa height for visual
  convenience. The guide geometry overrides generic sofa-size priors.
- The sofa top must remain clearly below the ceiling according to the calculated
  free vertical space. Do not make the sofa visually taller than the calculated
  {{SOFA_HEIGHT}} {{UNIT}} height.
- If width and height cues conflict, preserve the real sofa height and width
  ratios from the calculated plan, then adjust perspective and placement around
  those ratios.
- Infer sofa depth from input image 2 proportions and normal sofa proportions;
  do not make it miniature, oversized, flat, stretched, or compressed.
- Keep the sofa fully supported by the floor plane, with all visible legs/base
  touching the floor in the correct perspective.
- If the customer's sofa width or height makes it visually overlap a door,
  window, AC unit, socket, switch, vent, radiator, or light fixture, render the
  sofa IN FRONT of that feature at the chosen size and position. The customer's
  dimensions and chosen position take priority over architectural features. Do
  not shrink, shift, or tilt the sofa to avoid them.
- If the requested dimensions make the first obvious placement impossible,
  choose the nearest physically plausible placement, orientation, or wall while
  keeping the sofa scale true to the provided width.

PLACEMENT INTENT:
{{PLACEMENT_NOTE}}

COMPOSITING RULES:
- Match the room's perspective, horizon, vanishing points, camera height, focal
  length feel, and floor contact geometry.
- Match the room lighting: direction, softness, shadow density, ambient bounce,
  reflections, and color temperature.
- Add natural contact shadows under and behind the sofa.
- Apply correct occlusion where the sofa sits in front of room elements.
- Keep the final image photorealistic, as if the sofa was physically present
  when the room photo was taken.

HARD CONSTRAINTS:
- Do not redesign the room.
- Do not change the room dimensions, camera, crop, wall/floor perspective, or
  architectural layout.
- Do not change the sofa design, color, material, cushion count, arms, legs,
  silhouette, or proportions from input image 2.
- Do not copy the sofa reference background into the room.
- Do not place the sofa floating, tilted incorrectly, intersecting geometry, or
  at a scale inconsistent with the provided dimensions.
- Do not ignore the calculated sofa height. A result is unacceptable if the sofa
  height appears substantially taller or shorter than {{SOFA_TO_ROOM_HEIGHT_PERCENT}}%
  of the real room height after perspective adjustment.
- Do not ignore the placement guide. A result is unacceptable if the generated
  sofa does not occupy the target guide geometry when INPUT IMAGE 3 is
  provided.
- Do not place the sofa outside the guide, partially outside the guide, next to
  the guide, below the guide, above the guide, in front of the guide, or behind
  the guide. The guide is the sofa position.
- Do not use the guide as approximate scale only. Use it as exact location,
  exact width, exact height, and exact perspective footprint.
- Do not show guide marks in the final image.
- Do not add, replace, or modify ANY object in the room except for inserting
  the sofa. Do NOT add or change rugs, carpets, mats, plants, paintings,
  frames, mirrors, lamps, throw pillows, decorations, tables, chairs, vases,
  books, electronics, or any other furniture or decor.
- The cleaned room from input image 1 is the absolute source of truth. The
  ONLY change you may make is to add the sofa from input image 2 in the
  chosen location. Everything else — floor texture, rug pattern (if any),
  wall color, ceiling, lighting, and every existing object — must remain
  bit-identical to input image 1.
- Do not add text, labels, logos, watermarks, or annotations.

Generate one final photorealistic image: the same room from input image 1, with
the sofa from input image 2 realistically placed in the room at the correct
real-world scale.`;

function buildPrompt(args) {
  const mode = args.mode ?? "back_wall";
  const unit = args.unit ?? "m";
  const wh = parseFloat(args["wall-height"]);
  const wd = parseFloat(args["room-depth"] ?? args["wall-depth"] ?? "0");
  const sh = parseFloat(args["sofa-height"]);
  const guideProvided = Boolean(args.guide);
  const inputsBlock = guideProvided
    ? "INPUTS PROVIDED:\n- INPUT IMAGE 1: room photo.\n- INPUT IMAGE 2: sofa reference.\n- INPUT IMAGE 3: placement guide (PROVIDED — follow ALL guide rules).\n"
    : "INPUTS PROVIDED:\n- INPUT IMAGE 1: room photo.\n- INPUT IMAGE 2: sofa reference.\n- INPUT IMAGE 3: NOT PROVIDED in this run. IGNORE every rule that mentions a magenta guide, magenta target, magenta quadrilateral, green floor-contact line, blue wall calibration, or INPUT IMAGE 3.\n";
  const feedbackRaw = process.env.IN_HOME_SIMULATION_FEEDBACK ?? "";
  const feedbackBlock = feedbackRaw.trim().length > 0
    ? `${feedbackRaw.trim()}\n\n`
    : "";

  if (mode === "corner") {
    const wl = parseFloat(args["wall-left"]);
    const wr = parseFloat(args["wall-right"]);
    const sl = parseFloat(args["sofa-left"]);
    const sr = parseFloat(args["sofa-right"]);
    if (
      !Number.isFinite(wl) || !Number.isFinite(wr) || !Number.isFinite(wh) ||
      !Number.isFinite(sl) || !Number.isFinite(sr) || !Number.isFinite(sh)
    ) {
      fail(
        "place corner mode: --wall-left, --wall-right, --wall-height, --sofa-left, --sofa-right, --sofa-height are all required",
        2
      );
    }
    const ww = Math.max(wl, wr);
    const sw = Math.max(sl, sr);
    const widthPctLeft = ((sl / wl) * 100).toFixed(1);
    const widthPctRight = ((sr / wr) * 100).toFixed(1);
    const heightPct = ((sh / wh) * 100).toFixed(1);

    const dimensionCalculation =
      `L-shaped CORNER sofa. ` +
      `Left side: ${sl} ${unit} along the LEFT wall (left wall = ${wl} ${unit}, sofa fills ${widthPctLeft}% of it). ` +
      `Right side: ${sr} ${unit} along the RIGHT wall (right wall = ${wr} ${unit}, sofa fills ${widthPctRight}% of it). ` +
      `Sofa height / wall height = ${sh} / ${wh} = ${heightPct}%.`;
    const placementGuideRules =
      `Free LEFT wall remaining (left of sofa): ${(wl - sl).toFixed(2)} ${unit}. ` +
      `Free RIGHT wall remaining (right of sofa): ${(wr - sr).toFixed(2)} ${unit}.`;
    const placementNote =
      `This is an L-shaped CORNER SOFA. Place it inside the inner architectural corner of the room where the LEFT and RIGHT walls meet. The LEFT side of the sofa (${sl} ${unit}) must run flush against the LEFT wall. The RIGHT side of the sofa (${sr} ${unit}) must run flush against the RIGHT wall. The inner corner of the sofa must sit exactly at the inner architectural corner of the room (where the two walls join the floor). Both straight sides of the sofa must touch their walls along their entire length. Visible base/legs/feet of the sofa rest on the floor with correct perspective. Do NOT center the sofa against a single wall and do NOT place it floating away from the corner.`;

    return PROMPT_TEMPLATE
      .replaceAll("{{FEEDBACK_BLOCK}}", feedbackBlock)
      .replaceAll("{{INPUTS_BLOCK}}", inputsBlock)
      .replaceAll("{{ROOM_WIDTH}}", String(ww))
      .replaceAll("{{ROOM_HEIGHT}}", String(wh))
      .replaceAll("{{ROOM_DEPTH}}", Number.isFinite(wd) && wd > 0 ? String(wd) : "unspecified")
      .replaceAll("{{SOFA_WIDTH}}", String(sw))
      .replaceAll("{{SOFA_HEIGHT}}", String(sh))
      .replaceAll("{{UNIT}}", unit)
      .replaceAll("{{SOFA_TO_ROOM_WIDTH_PERCENT}}", widthPctLeft)
      .replaceAll("{{SOFA_TO_ROOM_HEIGHT_PERCENT}}", heightPct)
      .replaceAll("{{DIMENSION_CALCULATION}}", dimensionCalculation)
      .replaceAll("{{PLACEMENT_GUIDE_RULES}}", placementGuideRules)
      .replaceAll("{{PLACEMENT_NOTE}}", placementNote);
  }

  const ww = parseFloat(args["wall-width"]);
  const sw = parseFloat(args["sofa-width"]);

  if (!Number.isFinite(ww) || !Number.isFinite(wh) || !Number.isFinite(sw) || !Number.isFinite(sh)) {
    fail(
      "place: --wall-width, --wall-height, --sofa-width, --sofa-height are all required",
      2
    );
  }

  const widthPct = ((sw / ww) * 100).toFixed(1);
  const heightPct = ((sh / wh) * 100).toFixed(1);

  const dimensionCalculation =
    `LITERAL TARGET DIMENSIONS (use these as the truth, not as suggestions):\n` +
    `- Sofa width: EXACTLY ${sw} ${unit} (= ${widthPct}% of the ${ww} ${unit} back wall).\n` +
    `- Sofa height: EXACTLY ${sh} ${unit} (= ${heightPct}% of the ${wh} ${unit} ceiling height).\n` +
    `- The full ${sw} ${unit} width MUST be visible against the back wall, even when it covers a door, window, AC unit, socket, vent, or any other architectural feature on or in front of that wall. The sofa renders IN FRONT of those features at full width.\n` +
    `- The full ${sh} ${unit} height MUST be visible above the floor, even when the backrest visually overlaps a window sill, door header, AC unit, or wall switch. Do NOT shorten the sofa to clear those features.`;

  const positionRaw = (args.position ?? "center").toLowerCase();
  const position = positionRaw === "left" || positionRaw === "right"
    ? positionRaw
    : "center";

  const totalFree = Math.max(0, ww - sw);
  let leftFree;
  let rightFree;
  let placementNote;
  if (position === "left") {
    leftFree = 0;
    rightFree = totalFree;
    placementNote =
      `Place the sofa against the LEFT side of the back wall. The LEFT edge of the sofa must touch the LEFT side wall (where the back wall meets the left side wall). Empty floor space remaining to the right of the sofa: ${totalFree.toFixed(2)} ${unit}. Do NOT center the sofa. Do NOT push the sofa to the right side.`;
  } else if (position === "right") {
    leftFree = totalFree;
    rightFree = 0;
    placementNote =
      `Place the sofa against the RIGHT side of the back wall. The RIGHT edge of the sofa must touch the RIGHT side wall (where the back wall meets the right side wall). Empty floor space remaining to the left of the sofa: ${totalFree.toFixed(2)} ${unit}. Do NOT center the sofa. Do NOT push the sofa to the left side.`;
  } else {
    leftFree = totalFree / 2;
    rightFree = totalFree / 2;
    const halfFree = (totalFree / 2).toFixed(2);
    placementNote =
      `Place the sofa EXACTLY centered against the back wall.\n` +
      `Calibrated corner positions along the back wall:\n` +
      `- Sofa BOTTOM-LEFT corner: ${halfFree} ${unit} to the right of the LEFT back-wall seam (the line where the back wall meets the LEFT side wall at floor level).\n` +
      `- Sofa BOTTOM-RIGHT corner: ${halfFree} ${unit} to the left of the RIGHT back-wall seam.\n` +
      `- Sofa width fills ${sw} ${unit} between those two corners.\n` +
      `- Sofa TOP-LEFT corner sits ${sh} ${unit} above the BOTTOM-LEFT corner. Sofa TOP-RIGHT sits ${sh} ${unit} above BOTTOM-RIGHT.\n` +
      `The empty floor strip to the LEFT of the sofa equals the empty strip to the RIGHT, both ${halfFree} ${unit}.\n` +
      `The sofa's vertical center line aligns with the vertical center line of the back wall. Do NOT shift the sofa toward the left or the right side, even if a door, window, AC unit, socket, or any architectural feature is on the back wall. The sofa renders in front of those features at the centered position.`;
  }

  const placementGuideRules =
    `Position: ${position}. Empty wall to the LEFT of the sofa: ${leftFree.toFixed(2)} ${unit}. Empty wall to the RIGHT of the sofa: ${rightFree.toFixed(2)} ${unit}.`;

  return PROMPT_TEMPLATE
    .replaceAll("{{FEEDBACK_BLOCK}}", feedbackBlock)
    .replaceAll("{{INPUTS_BLOCK}}", inputsBlock)
    .replaceAll("{{ROOM_WIDTH}}", String(ww))
    .replaceAll("{{ROOM_HEIGHT}}", String(wh))
    .replaceAll("{{ROOM_DEPTH}}", Number.isFinite(wd) && wd > 0 ? String(wd) : "unspecified")
    .replaceAll("{{SOFA_WIDTH}}", String(sw))
    .replaceAll("{{SOFA_HEIGHT}}", String(sh))
    .replaceAll("{{UNIT}}", unit)
    .replaceAll("{{SOFA_TO_ROOM_WIDTH_PERCENT}}", widthPct)
    .replaceAll("{{SOFA_TO_ROOM_HEIGHT_PERCENT}}", heightPct)
    .replaceAll("{{DIMENSION_CALCULATION}}", dimensionCalculation)
    .replaceAll("{{PLACEMENT_GUIDE_RULES}}", placementGuideRules)
    .replaceAll("{{PLACEMENT_NOTE}}", placementNote);
}

const args = parseArgs(process.argv.slice(2));
if (!args.room) fail("missing --room PATH", 2);
if (!args.sofa) fail("missing --sofa PATH", 2);
const room = await readPhoto(args.room);
const sofa = await readPhoto(args.sofa);
const guide = args.guide ? await readPhoto(args.guide) : null;
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-image-2";
const size = args.size ?? "auto";
const runDir = args.out ?? defaultRunDir("place");
const promptText = buildPrompt(args);

info(
  `place: model=${model} size=${size} room=${room.absolute} sofa=${sofa.absolute}${guide ? ` guide=${guide.absolute}` : ""}`
);

const formData = new FormData();
formData.set("model", model);
formData.set("prompt", promptText);
formData.set("size", size);
formData.append(
  "image[]",
  new Blob([room.bytes], { type: detectMimeType(room.bytes) }),
  "room.png"
);
formData.append(
  "image[]",
  new Blob([sofa.bytes], { type: detectMimeType(sofa.bytes) }),
  "sofa.png"
);
if (guide) {
  formData.append(
    "image[]",
    new Blob([guide.bytes], { type: detectMimeType(guide.bytes) }),
    "guide.png"
  );
}

let response;
try {
  response = await callOpenAIImagesEdit({ apiKey, formData });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const b64 = response?.data?.[0]?.b64_json;
if (!b64 || b64.length === 0) {
  fail(
    `placement response had no image data: ${JSON.stringify(response).slice(0, 200)}`
  );
}

const bytes = base64ToBytes(b64);
const path = await writeArtifact(runDir, "output.png", Buffer.from(bytes));
info(`place: saved ${path} (${bytes.length} bytes)`);
console.log(path);
