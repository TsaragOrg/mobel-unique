// SPEC-0007 sofa placement provider — gpt-image-2 image-edit.
//
// Stage 2 composes the cleaned room, the supplied wall dimensions, and
// the prepared sofa photo into a final visualization. This adapter
// wires the OpenAI Images API (`/v1/images/edits` with `gpt-image-2`)
// using prompt v002 in `prompts/sofa_placement_v002/placement.md`. The
// cleaned room and the prepared sofa are sent as multi-image references
// so the model can preserve sofa identity while editing the room.
//
// v002 supports two modes:
//   back_wall: sofa centered against the back wall.
//   corner:    L-shaped sofa anchored to the inner corner.
//
// The pure helpers `buildPlacementPrompt`, `buildPlacementFormData`,
// and `parsePlacementResponse` are exercised by vitest. The
// `OpenAIPlacementProvider` class wires fetch and lives only in the
// Deno runtime.

import type {
  PlacementInputs,
  PlacementProvider,
  PlacementResult
} from "../providers.ts";
import type { SceneMode } from "./openai-scene-classifier.ts";
import type {
  MeasurementResult,
  MeasurementSuccess,
  PlacementMeasurementProvider
} from "./openai-placement-measurement.ts";

export const OPENAI_PLACEMENT_DEFAULT_MODEL = "gpt-image-2";
export const OPENAI_PLACEMENT_DEFAULT_SIZE = "auto";
export const MAX_PLACEMENT_ATTEMPTS = 3;
export const PLACEMENT_TOLERANCE_PCT = 5;

const PLACEMENT_BACK_WALL_TEMPLATE = `You are creating a photorealistic interior image edit from two reference images.

{{FEEDBACK_BLOCK}}INPUT IMAGE 1 = ROOM BASE PHOTO. Use this image as the locked scene to edit in place. Preserve the same camera position, lens feel, perspective, crop, room architecture, floor, walls, ceiling, lighting direction, color temperature, visible objects, and shadows except where the sofa must naturally occlude the scene.

INPUT IMAGE 2 = SOFA REFERENCE. Use this image only as the sofa to insert into the room. Preserve the sofa design, proportions, upholstery, color, visible legs/base, arms, cushions, backrest, seams, softness, and material feel. Remove the sofa's original background, floor, room, lighting setup, camera angle, and any unrelated objects from input image 2.

DOORS, WINDOWS, AC UNITS, AND OTHER WALL FEATURES DO NOT BLOCK THE SOFA:
- The customer's sofa width is the literal target. It is NOT reduced because a door, window, air conditioner, socket, switch, vent, radiator, light fixture, niche, alcove, or any other architectural feature appears on the back wall.
- If the sofa at its true real-world width visually covers part of a door, window, AC, or any feature, render the sofa IN FRONT of that feature at the full requested width. The sofa OCCLUDES the feature.
- NEVER shrink the sofa width to "make room" for a door.
- NEVER shift the sofa horizontally away from its requested position to "avoid" a door.
- NEVER tilt, rotate, or angle the sofa to fit around an architectural feature.
- The architectural feature is irrelevant to the sofa size. Treat it as if it were a flat painted surface.

REAL-WORLD DIMENSIONS:
- Room width: {{ROOM_WIDTH}} {{UNIT}}
- Room height: {{ROOM_HEIGHT}} {{UNIT}}
- Room depth: {{ROOM_DEPTH}} {{UNIT}}
- Sofa real width: {{SOFA_WIDTH}} {{UNIT}}
- Sofa real height: {{SOFA_HEIGHT}} {{UNIT}}
- Sofa / room-width ratio: {{SOFA_TO_ROOM_WIDTH_PERCENT}}%
- Sofa / room-height ratio: {{SOFA_TO_ROOM_HEIGHT_PERCENT}}%

LITERAL TARGET DIMENSIONS (use these as the truth, not as suggestions):
- Sofa width: EXACTLY {{SOFA_WIDTH}} {{UNIT}} (= {{SOFA_TO_ROOM_WIDTH_PERCENT}}% of the {{ROOM_WIDTH}} {{UNIT}} back wall).
- Sofa height: EXACTLY {{SOFA_HEIGHT}} {{UNIT}} (= {{SOFA_TO_ROOM_HEIGHT_PERCENT}}% of the {{ROOM_HEIGHT}} {{UNIT}} ceiling height).
- The full {{SOFA_WIDTH}} {{UNIT}} width MUST be visible against the back wall, even when it covers a door, window, AC unit, socket, vent, or any other architectural feature on or in front of that wall. The sofa renders IN FRONT of those features at full width.
- The full {{SOFA_HEIGHT}} {{UNIT}} height MUST be visible above the floor, even when the backrest visually overlaps a window sill, door header, AC unit, or wall switch. Do NOT shorten the sofa to clear those features.

PLACEMENT INTENT: {{PLACEMENT_INTENT}}

DIMENSION AND SCALE RULES:
- The sofa is rendered at EXACTLY the requested real-world dimensions ({{SOFA_WIDTH}} {{UNIT}} wide, {{SOFA_HEIGHT}} {{UNIT}} tall). Treat these as literal targets, not approximate suggestions.
- ANTI-REGRESSION: the requested sofa is intentionally non-standard. Do NOT regress to a generic stock sofa shape. Do NOT shrink toward "what a sofa usually looks like". The customer measured this sofa; the numbers are the truth.
- The sofa's visible width MUST occupy EXACTLY {{SOFA_TO_ROOM_WIDTH_PERCENT}}% of the back-wall visible width, adjusted only for perspective and camera angle. Not less. Not more.
- Visible height must match {{SOFA_TO_ROOM_HEIGHT_PERCENT}}% of the room height, after only perspective adjustment. A noticeably shorter result is unacceptable.
- Keep the sofa fully supported by the floor, with all visible legs/base touching the floor in the correct perspective.

ARCHITECTURE-OVERRIDES-NOTHING (ABSOLUTE):
- The customer's chosen size and position take ABSOLUTE priority over the existing room layout.
- Doors, windows, sockets, switches, vents, AC units, radiators, light fixtures, and any other architectural feature MUST NOT influence the sofa's size or position.
- Do NOT shrink, shorten, lower, narrow, or tilt the sofa to avoid overlapping a door, window, or any other architectural element.
- Do NOT shift the sofa horizontally or vertically away from the chosen position to avoid overlapping a door, window, or any other architectural element.
- If the chosen size + position causes the sofa to visually overlap a door, window, AC unit, or any other architectural feature, render the sofa IN FRONT of that feature anyway. The sofa occludes the architectural element.
- Treat doors, windows, AC units, etc. exactly the same as any other section of the wall when computing sofa placement.

COMPOSITING RULES:
- Match the room's perspective, horizon, vanishing points, camera height, focal length feel, and floor contact geometry.
- Match the room lighting: direction, softness, shadow density, ambient bounce, reflections, and color temperature.
- Add natural contact shadows under and behind the sofa.
- Apply correct occlusion where the sofa sits in front of room elements.
- Keep the final image photorealistic, as if the sofa was physically present when the room photo was taken.

HARD CONSTRAINTS:
- Do not redesign the room.
- Do not change the room dimensions, camera, crop, wall/floor perspective, or architectural layout.
- Do not change the sofa design, color, material, cushion count, arms, legs, silhouette, or proportions from input image 2.
- Do not copy the sofa reference background into the room.
- Do not place the sofa floating or tilted incorrectly.
- Do not add, replace, or modify ANY object in the room except for inserting the sofa. Do NOT add or change rugs, carpets, mats, plants, paintings, frames, mirrors, lamps, throw pillows, decorations, tables, chairs, vases, books, electronics, or any other furniture or decor.
- The cleaned room from input image 1 is the absolute source of truth. The ONLY change you may make is to add the sofa from input image 2 in the chosen location. Everything else — floor texture, rug pattern (if any), wall color, ceiling, lighting, and every existing object — must remain bit-identical to input image 1.
- Do not add text, labels, logos, watermarks, or annotations.

Generate one final photorealistic image: the same room from input image 1, with the sofa from input image 2 realistically placed in the room at the correct real-world scale and at the chosen position, ignoring any architectural feature that would otherwise tempt a shift.`;

const PLACEMENT_CORNER_TEMPLATE = `You are creating a photorealistic interior image edit from two reference images.

{{FEEDBACK_BLOCK}}INPUT IMAGE 1 = ROOM BASE PHOTO. Use this image as the locked scene to edit in place. Preserve the same camera position, lens feel, perspective, crop, room architecture, floor, walls, ceiling, lighting direction, color temperature, visible objects, and shadows except where the sofa must naturally occlude the scene.

INPUT IMAGE 2 = SOFA REFERENCE. Use this image only as the sofa to insert into the room. Preserve the sofa design, proportions, upholstery, color, visible legs/base, arms, cushions, backrest, seams, softness, and material feel. Remove the sofa's original background, floor, room, lighting setup, camera angle, and any unrelated objects from input image 2.

DOORS, WINDOWS, AC UNITS, AND OTHER WALL FEATURES DO NOT BLOCK THE SOFA:
- The customer's sofa dimensions are literal targets. They are NOT reduced because a door, window, AC unit, socket, switch, vent, radiator, or light fixture appears on either wall.
- The sofa's left side fills the requested length along the LEFT wall, and the right side fills the requested length along the RIGHT wall, even if either wall has a door or window in the way. The sofa OCCLUDES those features.
- NEVER shrink either L-side to "make room" for a door, window, or any architectural feature.
- NEVER shift the sofa away from the inner corner to avoid a feature.
- Treat doors, windows, AC units exactly like any other section of the wall when fitting the sofa.

ANTI-REGRESSION: the requested L-shaped corner sofa is intentionally large and intentionally non-standard. Do NOT regress to a generic stock corner-sofa shape. Do NOT shrink toward "what a corner sofa usually looks like". The customer measured this sofa; the numbers are the truth.

REAL-WORLD DIMENSIONS for an L-shaped corner sofa:
- Left wall length: {{WALL_LEFT}} {{UNIT}}
- Right wall length: {{WALL_RIGHT}} {{UNIT}}
- Wall height: {{WALL_HEIGHT}} {{UNIT}}
- Room depth: {{ROOM_DEPTH}} {{UNIT}}
- Sofa LEFT side length: {{SOFA_LEFT}} {{UNIT}} (along the left wall, fills {{SOFA_TO_LEFT_PERCENT}}% of it)
- Sofa RIGHT side length: {{SOFA_RIGHT}} {{UNIT}} (along the right wall, fills {{SOFA_TO_RIGHT_PERCENT}}% of it)
- Sofa height: {{SOFA_HEIGHT}} {{UNIT}}

PLACEMENT INTENT: This is an L-shaped CORNER SOFA. Place it inside the inner architectural corner of the room where the LEFT and RIGHT walls meet. The LEFT side of the sofa ({{SOFA_LEFT}} {{UNIT}}) must run flush against the LEFT wall. The RIGHT side of the sofa ({{SOFA_RIGHT}} {{UNIT}}) must run flush against the RIGHT wall. The inner corner of the sofa must sit exactly at the inner architectural corner of the room (where the two walls join the floor). Both straight sides of the sofa must touch their walls along their entire length. Visible base/legs/feet of the sofa rest on the floor with correct perspective. Do NOT center the sofa against a single wall and do NOT place it floating away from the corner.

ARCHITECTURE-OVERRIDES-NOTHING (ABSOLUTE):
- The customer's chosen size and corner placement take ABSOLUTE priority over the existing room layout.
- Doors, windows, sockets, switches, vents, AC units, radiators, light fixtures, and any other architectural feature MUST NOT influence the sofa's size or position.
- Do NOT shrink, shorten, narrow, or tilt the sofa to avoid overlapping a door, window, or any other architectural element.
- Do NOT shift the sofa away from the inner corner to avoid overlapping a door, window, or any other architectural element.
- If the chosen size causes the sofa to visually overlap a door, window, AC unit, or any other architectural feature on either wall, render the sofa IN FRONT of that feature anyway.

COMPOSITING RULES:
- Match the room's perspective, horizon, vanishing points, camera height, focal length feel, and floor contact geometry.
- Match the room lighting: direction, softness, shadow density, ambient bounce, reflections, and color temperature.
- Add natural contact shadows under and behind the sofa.
- Apply correct occlusion where the sofa sits in front of room elements.
- Keep the final image photorealistic, as if the sofa was physically present when the room photo was taken.

HARD CONSTRAINTS:
- Do not redesign the room.
- Do not change the room dimensions, camera, crop, wall/floor perspective, or architectural layout.
- Do not change the sofa design, color, material, cushion count, arms, legs, silhouette, or proportions from input image 2.
- Do not copy the sofa reference background into the room.
- Do not add, replace, or modify ANY object in the room except for inserting the sofa. Do NOT add or change rugs, carpets, mats, plants, paintings, frames, mirrors, lamps, throw pillows, decorations, tables, chairs, vases, books, electronics, or any other furniture or decor.
- The cleaned room from input image 1 is the absolute source of truth. The ONLY change you may make is to add the sofa from input image 2 in the chosen location. Everything else — floor texture, rug pattern (if any), wall color, ceiling, lighting, and every existing object — must remain bit-identical to input image 1.
- Do not add text, labels, logos, watermarks, or annotations.

Generate one final photorealistic image: the same room from input image 1, with the L-shaped sofa from input image 2 realistically placed in the room corner at the correct real-world scale.`;

export type BackWallPosition = "left" | "center" | "right";

export type PlacementPromptInput = {
  mode: SceneMode;
  suppliedDimensions: Record<string, number>;
  position?: BackWallPosition;
  feedback?: string;
};

function fmtMetres(value: unknown, unit = "m"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "?";
  return `${value} ${unit}`;
}

function fmtNumber(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "?";
  return String(value);
}

function fmtPercent(numerator: unknown, denominator: unknown): string {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return "?";
  }
  return ((numerator / denominator) * 100).toFixed(1);
}

export function buildPlacementPrompt(input: PlacementPromptInput): string {
  const dims = input.suppliedDimensions ?? {};
  const unit = "m";
  const roomDepth = typeof dims.room_depth === "number" && Number.isFinite(dims.room_depth) && dims.room_depth > 0
    ? `${dims.room_depth} ${unit}`
    : "unspecified";
  const feedbackBlock = typeof input.feedback === "string" && input.feedback.trim().length > 0
    ? `${input.feedback.trim()}\n\n`
    : "";

  if (input.mode === "back_wall") {
    const ww = typeof dims.wall_width === "number" ? dims.wall_width : 0;
    const sw = typeof dims.sofa_width === "number" ? dims.sofa_width : 0;
    const sh = typeof dims.sofa_height === "number" ? dims.sofa_height : 0;
    const totalFree = Math.max(0, ww - sw);
    const positionRaw =
      typeof input.position === "string" ? input.position.toLowerCase() : "center";
    const position: "left" | "center" | "right" =
      positionRaw === "left" || positionRaw === "right" ? positionRaw : "center";
    let placementIntent: string;
    if (position === "left") {
      placementIntent =
        `Place the sofa against the LEFT side of the back wall.\n` +
        `Calibrated corner positions:\n` +
        `- Sofa BOTTOM-LEFT corner: 0 ${unit} from the LEFT back-wall seam (flush against the left side wall).\n` +
        `- Sofa BOTTOM-RIGHT corner: ${totalFree.toFixed(2)} ${unit} from the RIGHT back-wall seam.\n` +
        `- Sofa TOP-LEFT and TOP-RIGHT sit ${sh} ${unit} above the bottom corners.\n` +
        `Empty floor space remaining to the right of the sofa: ${totalFree.toFixed(2)} ${unit}. Do NOT center the sofa. Do NOT push the sofa to the right side.`;
    } else if (position === "right") {
      placementIntent =
        `Place the sofa against the RIGHT side of the back wall.\n` +
        `Calibrated corner positions:\n` +
        `- Sofa BOTTOM-RIGHT corner: 0 ${unit} from the RIGHT back-wall seam (flush against the right side wall).\n` +
        `- Sofa BOTTOM-LEFT corner: ${totalFree.toFixed(2)} ${unit} from the LEFT back-wall seam.\n` +
        `- Sofa TOP-LEFT and TOP-RIGHT sit ${sh} ${unit} above the bottom corners.\n` +
        `Empty floor space remaining to the left of the sofa: ${totalFree.toFixed(2)} ${unit}. Do NOT center the sofa. Do NOT push the sofa to the left side.`;
    } else {
      const halfFree = (totalFree / 2).toFixed(2);
      placementIntent =
        `Place the sofa EXACTLY centered against the back wall.\n` +
        `Calibrated corner positions along the back wall:\n` +
        `- Sofa BOTTOM-LEFT corner: ${halfFree} ${unit} to the right of the LEFT back-wall seam.\n` +
        `- Sofa BOTTOM-RIGHT corner: ${halfFree} ${unit} to the left of the RIGHT back-wall seam.\n` +
        `- Sofa width fills ${sw} ${unit} between those two corners.\n` +
        `- Sofa TOP-LEFT and TOP-RIGHT sit ${sh} ${unit} above the bottom corners.\n` +
        `The empty space to the LEFT of the sofa equals the empty space to the RIGHT of the sofa, both ${halfFree} ${unit}. The sofa's vertical center line aligns with the vertical center line of the back wall. Do NOT shift the sofa toward the left side or the right side, even if a door, window, AC unit, socket, or any architectural feature is on the back wall. The sofa renders in front of those features at the centered position.`;
    }
    return PLACEMENT_BACK_WALL_TEMPLATE
      .replaceAll("{{FEEDBACK_BLOCK}}", feedbackBlock)
      .replaceAll("{{ROOM_WIDTH}}", fmtNumber(dims.wall_width))
      .replaceAll("{{ROOM_HEIGHT}}", fmtNumber(dims.wall_height))
      .replaceAll("{{ROOM_DEPTH}}", roomDepth.replace(` ${unit}`, ""))
      .replaceAll("{{SOFA_WIDTH}}", fmtNumber(dims.sofa_width))
      .replaceAll("{{SOFA_HEIGHT}}", fmtNumber(dims.sofa_height))
      .replaceAll("{{UNIT}}", unit)
      .replaceAll(
        "{{SOFA_TO_ROOM_WIDTH_PERCENT}}",
        fmtPercent(dims.sofa_width, dims.wall_width)
      )
      .replaceAll(
        "{{SOFA_TO_ROOM_HEIGHT_PERCENT}}",
        fmtPercent(dims.sofa_height, dims.wall_height)
      )
      .replaceAll("{{PLACEMENT_INTENT}}", placementIntent);
  }

  return PLACEMENT_CORNER_TEMPLATE
    .replaceAll("{{FEEDBACK_BLOCK}}", feedbackBlock)
    .replaceAll("{{WALL_LEFT}}", fmtNumber(dims.left_wall_width))
    .replaceAll("{{WALL_RIGHT}}", fmtNumber(dims.right_wall_width))
    .replaceAll("{{WALL_HEIGHT}}", fmtNumber(dims.room_height))
    .replaceAll("{{ROOM_DEPTH}}", roomDepth.replace(` ${unit}`, ""))
    .replaceAll("{{SOFA_LEFT}}", fmtNumber(dims.sofa_left))
    .replaceAll("{{SOFA_RIGHT}}", fmtNumber(dims.sofa_right))
    .replaceAll("{{SOFA_HEIGHT}}", fmtNumber(dims.sofa_height))
    .replaceAll("{{UNIT}}", unit)
    .replaceAll(
      "{{SOFA_TO_LEFT_PERCENT}}",
      fmtPercent(dims.sofa_left, dims.left_wall_width)
    )
    .replaceAll(
      "{{SOFA_TO_RIGHT_PERCENT}}",
      fmtPercent(dims.sofa_right, dims.right_wall_width)
    );
}

export type PlacementFormDataInput = {
  model: string;
  promptText: string;
  cleanedRoomBytes: Uint8Array;
  cleanedRoomMimeType: string;
  preparedSofaBytes: Uint8Array | null;
  preparedSofaMimeType: string | null;
  size: string;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildPlacementFormData(
  input: PlacementFormDataInput
): FormData {
  requireNonEmpty(input.model, "model");
  requireNonEmpty(input.promptText, "promptText");
  requireNonEmpty(input.cleanedRoomMimeType, "cleanedRoomMimeType");
  requireNonEmpty(input.size, "size");
  if (!input.cleanedRoomBytes || input.cleanedRoomBytes.length === 0) {
    throw new Error("cleanedRoomBytes must be a non-empty Uint8Array");
  }

  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.promptText);
  form.set("size", input.size);

  const roomBlob = new Blob([input.cleanedRoomBytes], {
    type: input.cleanedRoomMimeType
  });
  form.append("image[]", roomBlob, "room.png");

  if (
    input.preparedSofaBytes &&
    input.preparedSofaBytes.length > 0 &&
    input.preparedSofaMimeType
  ) {
    const sofaBlob = new Blob([input.preparedSofaBytes], {
      type: input.preparedSofaMimeType
    });
    form.append("image[]", sofaBlob, "sofa.png");
  }

  return form;
}

export type PlacementSuccess = {
  ok: true;
  imageBytes: Uint8Array;
};

export type PlacementParseFailure = {
  ok: false;
  failureReason: string;
};

export type PlacementParseResult = PlacementSuccess | PlacementParseFailure;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function parsePlacementResponse(raw: unknown): PlacementParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, failureReason: "openai placement response was empty" };
  }
  const body = raw as {
    data?: Array<{ b64_json?: unknown }>;
    error?: { message?: unknown };
  };
  if (body.error && typeof body.error.message === "string") {
    return {
      ok: false,
      failureReason: `openai placement error: ${body.error.message}`
    };
  }
  if (!Array.isArray(body.data) || body.data.length === 0) {
    return {
      ok: false,
      failureReason: "openai placement response had no image data"
    };
  }
  const first = body.data[0];
  if (!first || typeof first.b64_json !== "string" || first.b64_json.length === 0) {
    return {
      ok: false,
      failureReason: "openai placement response had no b64_json image payload"
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(first.b64_json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      failureReason: `openai placement base64 decode failed: ${message}`
    };
  }
  if (bytes.length === 0) {
    return {
      ok: false,
      failureReason: "openai placement response decoded to zero bytes"
    };
  }
  return { ok: true, imageBytes: bytes };
}

const OPENAI_API_BASE = "https://api.openai.com/v1";

function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/png";
}

// Compute the back_wall target ratios from suppliedDimensions; returns null
// for corner mode or when the dimensions are missing/zero.
export function computeBackWallTargets(
  inputs: PlacementInputs
): { widthPct: number; heightPct: number; position: "left" | "center" | "right" } | null {
  if (inputs.mode !== "back_wall") return null;
  const dims = inputs.suppliedDimensions ?? {};
  const ww = typeof dims.wall_width === "number" ? dims.wall_width : 0;
  const wh = typeof dims.wall_height === "number" ? dims.wall_height : 0;
  const sw = typeof dims.sofa_width === "number" ? dims.sofa_width : 0;
  const sh = typeof dims.sofa_height === "number" ? dims.sofa_height : 0;
  if (ww <= 0 || wh <= 0 || sw <= 0 || sh <= 0) return null;
  const widthPct = (sw / ww) * 100;
  const heightPct = (sh / wh) * 100;
  const positionRaw =
    typeof inputs.position === "string" ? inputs.position : "center";
  const position: "left" | "center" | "right" =
    positionRaw === "left" || positionRaw === "right" ? positionRaw : "center";
  return { widthPct, heightPct, position };
}

// Pure: given a measurement and the targets, decide whether the attempt is
// inside the acceptance tolerances.
export function isPlacementWithinTolerance(
  measurement: MeasurementSuccess,
  targets: { widthPct: number; heightPct: number; position: "left" | "center" | "right" },
  tolerancePct: number = PLACEMENT_TOLERANCE_PCT
): boolean {
  const widthDelta = measurement.sofaWidthPct - targets.widthPct;
  const heightDelta = measurement.sofaHeightPct - targets.heightPct;
  const positionMatch = measurement.position === targets.position;
  return (
    Math.abs(widthDelta) <= tolerancePct &&
    Math.abs(heightDelta) <= tolerancePct &&
    positionMatch
  );
}

// Pure: total absolute delta used to rank attempts; lower is closer to target.
export function placementDeltaScore(
  measurement: MeasurementSuccess,
  targets: { widthPct: number; heightPct: number; position: "left" | "center" | "right" }
): number {
  const widthDelta = Math.abs(measurement.sofaWidthPct - targets.widthPct);
  const heightDelta = Math.abs(measurement.sofaHeightPct - targets.heightPct);
  const positionPenalty = measurement.position === targets.position ? 0 : 30;
  return widthDelta + heightDelta + positionPenalty;
}

// Pure: build a corrective feedback string from a measured miss. Used as the
// {{FEEDBACK_BLOCK}} placeholder on the next attempt's prompt.
export function buildPlacementFeedback(
  measurement: MeasurementSuccess,
  targets: { widthPct: number; heightPct: number; position: "left" | "center" | "right" },
  unitLabel: string,
  sofaWidth: number,
  sofaHeight: number,
  tolerancePct: number = PLACEMENT_TOLERANCE_PCT
): string {
  const widthDelta = measurement.sofaWidthPct - targets.widthPct;
  const heightDelta = measurement.sofaHeightPct - targets.heightPct;
  const positionMatch = measurement.position === targets.position;

  const lines: string[] = [
    "PREVIOUS ATTEMPT FEEDBACK — apply these corrections BEFORE you generate again. This is not optional context, it is a measured failure of your previous output.",
    `- Target sofa width: ${targets.widthPct.toFixed(1)}% of the back wall (= ${sofaWidth} ${unitLabel}).`,
    `- Target sofa height: ${targets.heightPct.toFixed(1)}% of the room height (= ${sofaHeight} ${unitLabel}).`,
    `- Target position: ${targets.position}.`,
    `- You produced: ${measurement.sofaWidthPct.toFixed(1)}% width × ${measurement.sofaHeightPct.toFixed(1)}% height @ ${measurement.position}.`
  ];

  if (widthDelta < -tolerancePct) {
    lines.push(
      `- WIDTH FIX: your sofa was ${Math.abs(widthDelta).toFixed(1)} percentage points TOO NARROW. ENLARGE the sofa width. The full ${sofaWidth} ${unitLabel} must span ${targets.widthPct.toFixed(1)}% of the back wall, not ${measurement.sofaWidthPct.toFixed(1)}%.`
    );
  } else if (widthDelta > tolerancePct) {
    lines.push(
      `- WIDTH FIX: your sofa was ${widthDelta.toFixed(1)} percentage points TOO WIDE. SHRINK the sofa width.`
    );
  }

  if (heightDelta < -tolerancePct) {
    lines.push(
      `- HEIGHT FIX: your sofa was ${Math.abs(heightDelta).toFixed(1)} percentage points TOO SHORT. INCREASE the sofa height. The backrest must reach ${targets.heightPct.toFixed(1)}% of the ceiling height, not ${measurement.sofaHeightPct.toFixed(1)}%.`
    );
  } else if (heightDelta > tolerancePct) {
    lines.push(
      `- HEIGHT FIX: your sofa was ${heightDelta.toFixed(1)} percentage points TOO TALL. LOWER the backrest.`
    );
  }

  if (!positionMatch) {
    lines.push(
      `- POSITION FIX: your sofa was placed in the ${measurement.position} third of the back wall, but the target is the ${targets.position} third. Move the sofa to the ${targets.position}.`
    );
  }

  lines.push(
    `- ANTI-REGRESSION REMINDER: the customer physically measured this sofa. ${sofaWidth} ${unitLabel} × ${sofaHeight} ${unitLabel} is the literal truth. Do NOT shrink toward "what an average sofa looks like". Do NOT shorten the backrest because it "looks too tall". Do NOT shift the sofa to avoid a door, window, AC, or any architectural feature.`
  );

  return lines.join("\n");
}

export class OpenAIPlacementProvider implements PlacementProvider {
  readonly name = "openai";
  readonly modelId: string;
  readonly promptVersion = "sofa_placement_v003";
  private readonly apiKey: string;
  private readonly size: string;
  private readonly measurementProvider: PlacementMeasurementProvider | null;
  private readonly maxAttempts: number;
  private readonly tolerancePct: number;

  constructor(options: {
    apiKey: string;
    model?: string;
    size?: string;
    measurementProvider?: PlacementMeasurementProvider | null;
    maxAttempts?: number;
    tolerancePct?: number;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("OpenAIPlacementProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_PLACEMENT_DEFAULT_MODEL;
    this.size = options.size ?? OPENAI_PLACEMENT_DEFAULT_SIZE;
    this.measurementProvider = options.measurementProvider ?? null;
    this.maxAttempts = options.maxAttempts ?? MAX_PLACEMENT_ATTEMPTS;
    this.tolerancePct = options.tolerancePct ?? PLACEMENT_TOLERANCE_PCT;
  }

  async placeSofa(inputs: PlacementInputs): Promise<PlacementResult> {
    if (!inputs.preparedSofaBytes || inputs.preparedSofaBytes.length === 0) {
      return {
        ok: false,
        failureReason:
          "openai placement requires a prepared sofa asset; the catalog row did not resolve to a public-usable render"
      };
    }

    const targets = computeBackWallTargets(inputs);
    const useFeedbackLoop = this.measurementProvider !== null && targets !== null;

    if (!useFeedbackLoop) {
      // Single-attempt path: corner mode, missing measurement provider, or
      // dimensions that prevent computing the target ratios. Behaviour is
      // identical to the v002 provider — one image_edits call, return as-is.
      return await this.requestOnce(inputs, "");
    }

    type AttemptRecord = {
      result: Extract<PlacementResult, { ok: true }>;
      measurement: MeasurementSuccess;
      score: number;
    };
    const attempts: AttemptRecord[] = [];
    let lastFeedback = "";
    let lastFailure: string = "";

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const result = await this.requestOnce(inputs, lastFeedback);
      if (!result.ok) {
        lastFailure = `attempt ${attempt}: ${result.failureReason}`;
        // A network/HTTP/parse failure is not measurable; try again with the
        // same prompt, no extra feedback. The model's previous feedback (if
        // any) is preserved from the last successful attempt.
        continue;
      }

      // We have a candidate image. Measure it.
      const measurement = await this.measurementProvider!.measureSofa(
        result.pngBytes
      );
      if (!measurement.ok) {
        // Measurement failed: we still have a generated image. Accept this
        // attempt as best-effort rather than burning more retries on a
        // measurement-only problem.
        return result;
      }

      const score = placementDeltaScore(measurement, targets!);
      attempts.push({ result, measurement, score });

      if (isPlacementWithinTolerance(measurement, targets!, this.tolerancePct)) {
        return result;
      }

      lastFeedback = buildPlacementFeedback(
        measurement,
        targets!,
        "m",
        Number(inputs.suppliedDimensions.sofa_width ?? 0),
        Number(inputs.suppliedDimensions.sofa_height ?? 0),
        this.tolerancePct
      );
    }

    if (attempts.length === 0) {
      return {
        ok: false,
        failureReason:
          `openai placement failed after ${this.maxAttempts} attempts. Last: ${lastFailure}`
      };
    }
    // Return the closest attempt to the target ratios.
    attempts.sort((a, b) => a.score - b.score);
    return attempts[0].result;
  }

  private async requestOnce(
    inputs: PlacementInputs,
    feedback: string
  ): Promise<PlacementResult> {
    const promptText = buildPlacementPrompt({
      mode: inputs.mode,
      suppliedDimensions: inputs.suppliedDimensions,
      position: inputs.position,
      feedback
    });

    const form = buildPlacementFormData({
      model: this.modelId,
      promptText,
      cleanedRoomBytes: inputs.cleanedRoomBytes,
      cleanedRoomMimeType: detectMimeType(inputs.cleanedRoomBytes),
      preparedSofaBytes: inputs.preparedSofaBytes,
      preparedSofaMimeType: inputs.preparedSofaBytes
        ? detectMimeType(inputs.preparedSofaBytes)
        : null,
      size: this.size
    });

    let response: Response;
    try {
      response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: form
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        failureReason: `openai placement network error: ${message}`
      };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason: `openai placement HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        ok: false,
        failureReason: "openai placement returned non-JSON response"
      };
    }
    const parsed = parsePlacementResponse(raw);
    if (!parsed.ok) {
      return { ok: false, failureReason: parsed.failureReason };
    }
    return {
      ok: true,
      pngBytes: parsed.imageBytes,
      width: inputs.cleanedRoomWidth,
      height: inputs.cleanedRoomHeight
    };
  }
}

// Re-export types that consumers (providers.ts, tests) need.
export type { MeasurementResult } from "./openai-placement-measurement.ts";
