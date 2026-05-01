// SPEC-0007 Stage 1 corners — gpt-image-2 places yellow dots on the
// cleaned room's architectural corners. The dot count depends on the
// scene mode determined by the scene classifier:
//   - back_wall → EXACTLY 4 dots, one at each corner of the back wall.
//   - corner → EXACTLY 6 dots: 2 on the inner vertical edge, 2 at the
//     far end of each side wall.
//
// The annotated PNG returned by this provider is consumed by
// `lib/lines.ts`, which detects the yellow clusters and renders the
// dimension lines (Ширина / Высота / Глубина or Лев. стена / Прав.
// стена / Высота / Глубина) locally in pure code.
//
// Pure helpers `buildCornersFormData` and `parseCornersResponse` are
// exercised by vitest. The provider class wires fetch and lives only
// in the Deno runtime.

import { decode, type Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import { classifyDots } from "../lines-classify.ts";
import { detectYellowDots } from "../lines.ts";
import { validateClassifiedCorners } from "../corners-validate.ts";

import type { SceneMode } from "./openai-scene-classifier.ts";

export const OPENAI_CORNERS_DEFAULT_MODEL = "gpt-image-2";
export const OPENAI_CORNERS_DEFAULT_SIZE = "auto";
export const MAX_CORNER_PLACEMENT_ATTEMPTS = 3;

export const PROMPT_BACK_WALL = [
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

export const PROMPT_CORNER = [
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

export function selectCornersPrompt(mode: SceneMode): string {
  return mode === "corner" ? PROMPT_CORNER : PROMPT_BACK_WALL;
}

export type CornersSuccess = {
  ok: true;
  pngBytes: Uint8Array;
};

export type CornersFailure = {
  ok: false;
  failureReason: string;
};

export type CornersResult = CornersSuccess | CornersFailure;

export interface CornersProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  placeCornerDots(
    imageBytes: Uint8Array,
    mode: SceneMode
  ): Promise<CornersResult>;
}

export type CornersFormDataInput = {
  model: string;
  promptText: string;
  imageBytes: Uint8Array;
  imageMimeType: string;
  size: string;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildCornersFormData(input: CornersFormDataInput): FormData {
  requireNonEmpty(input.model, "model");
  requireNonEmpty(input.promptText, "promptText");
  requireNonEmpty(input.imageMimeType, "imageMimeType");
  requireNonEmpty(input.size, "size");
  if (!input.imageBytes || input.imageBytes.length === 0) {
    throw new Error("imageBytes must be a non-empty Uint8Array");
  }
  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.promptText);
  form.set("size", input.size);
  const blob = new Blob([input.imageBytes], { type: input.imageMimeType });
  form.set("image", blob, "room_cleaned.png");
  return form;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function parseCornersResponse(raw: unknown): CornersResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, failureReason: "corners response was empty" };
  }
  const body = raw as {
    data?: Array<{ b64_json?: unknown }>;
    error?: { message?: unknown };
  };
  if (body.error && typeof body.error.message === "string") {
    return {
      ok: false,
      failureReason: `corners error: ${body.error.message}`
    };
  }
  if (!Array.isArray(body.data) || body.data.length === 0) {
    return {
      ok: false,
      failureReason: "corners response had no image data"
    };
  }
  const first = body.data[0];
  if (
    !first ||
    typeof first.b64_json !== "string" ||
    first.b64_json.length === 0
  ) {
    return {
      ok: false,
      failureReason: "corners response had no b64_json image payload"
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(first.b64_json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      failureReason: `corners base64 decode failed: ${message}`
    };
  }
  if (bytes.length === 0) {
    return { ok: false, failureReason: "corners decoded to zero bytes" };
  }
  return { ok: true, pngBytes: bytes };
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

export class OpenAICornersProvider implements CornersProvider {
  readonly name = "openai";
  readonly modelId: string;
  readonly promptVersion = "room_prep_v003";
  private readonly apiKey: string;
  private readonly size: string;
  private readonly backWallPrompt: string;
  private readonly cornerPrompt: string;

  constructor(options: {
    apiKey: string;
    model?: string;
    size?: string;
    backWallPrompt?: string;
    cornerPrompt?: string;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("OpenAICornersProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_CORNERS_DEFAULT_MODEL;
    this.size = options.size ?? OPENAI_CORNERS_DEFAULT_SIZE;
    this.backWallPrompt = options.backWallPrompt ?? PROMPT_BACK_WALL;
    this.cornerPrompt = options.cornerPrompt ?? PROMPT_CORNER;
  }

  async placeCornerDots(
    imageBytes: Uint8Array,
    mode: SceneMode
  ): Promise<CornersResult> {
    const promptText =
      mode === "corner" ? this.cornerPrompt : this.backWallPrompt;
    const expectedDots = mode === "corner" ? 6 : 4;
    let lastFailure = "";
    for (let attempt = 1; attempt <= MAX_CORNER_PLACEMENT_ATTEMPTS; attempt++) {
      const apiResult = await this.requestOnce(imageBytes, promptText);
      if (!apiResult.ok) {
        lastFailure = `attempt ${attempt}: ${apiResult.failureReason}`;
        continue;
      }
      const validation = await validateReturnedDots(
        apiResult.pngBytes,
        mode,
        expectedDots
      );
      if (validation.ok) {
        return apiResult;
      }
      lastFailure = `attempt ${attempt}: ${validation.failureReason}`;
    }
    return {
      ok: false,
      failureReason:
        `corners failed after ${MAX_CORNER_PLACEMENT_ATTEMPTS} attempts. Last: ${lastFailure}`
    };
  }

  private async requestOnce(
    imageBytes: Uint8Array,
    promptText: string
  ): Promise<CornersResult> {
    const form = buildCornersFormData({
      model: this.modelId,
      promptText,
      imageBytes,
      imageMimeType: detectMimeType(imageBytes),
      size: this.size
    });
    let response: Response;
    try {
      response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.apiKey}` },
        body: form
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, failureReason: `corners network error: ${message}` };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason: `corners HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return { ok: false, failureReason: "corners returned non-JSON response" };
    }
    return parseCornersResponse(raw);
  }
}

export async function validateReturnedDots(
  pngBytes: Uint8Array,
  mode: SceneMode,
  expectedDots: number
): Promise<{ ok: true } | { ok: false; failureReason: string }> {
  let image: Image;
  try {
    image = (await decode(pngBytes)) as Image;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, failureReason: `decode failed: ${message}` };
  }
  const dots = detectYellowDots(image);
  if (dots.length !== expectedDots) {
    return {
      ok: false,
      failureReason: `expected ${expectedDots} dots, found ${dots.length}`
    };
  }
  const classification = classifyDots(dots);
  if (!classification.ok) {
    return { ok: false, failureReason: classification.failureReason };
  }
  if (classification.corners.mode !== mode) {
    return {
      ok: false,
      failureReason:
        `dot count produced mode ${classification.corners.mode}, expected ${mode}`
    };
  }
  return validateClassifiedCorners(
    classification.corners,
    image.width,
    image.height
  );
}
