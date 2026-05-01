// SPEC-0007 Stage 1 scene classifier — GPT-5 vision JSON.
//
// The Stage 1 corners step needs to know whether the cleaned room is a
// back_wall view (camera faces ONE main flat wall) or a corner view
// (camera looks INTO an inner corner where two walls meet at a
// vertical edge). gpt-image-2 alone is not reliable at this decision —
// it leans toward 6 dots (corner) even on flat back-wall photos. To
// fix this we route the decision through a dedicated GPT-5 vision JSON
// call which is reliable and cheap.
//
// The pure helpers `buildSceneClassifierRequest` and
// `parseSceneClassifierResponse` are exercised by vitest. The
// `OpenAISceneClassifierProvider` class wires fetch and lives only in
// the Deno runtime.

export const OPENAI_SCENE_DEFAULT_MODEL = "gpt-5";

const SYSTEM_PROMPT =
  "You are classifying a residential room photograph for a furniture placement service. Reply with strict JSON of shape {\"mode\": \"back_wall\"|\"corner\"|\"reshoot\", \"confidence\": number, \"reason\": string}.";

const DEFAULT_USER_PROMPT = [
  "Decide ONE of three cases for this room photograph. The decision is based on the CENTRAL 30% of the image width — the vertical strip from 35% to 65% of the frame width. Mentally draw two vertical lines at X=35% and X=65% and only look at what is between them.",
  "",
  "CASE B — corner: anywhere INSIDE the central 30% strip there is a vertical architectural seam where TWO walls meet at an inner corner — a vertical line that runs from floor to ceiling where the room's two walls join. The seam does NOT have to be at the exact center; if it is anywhere between X=35% and X=65%, choose corner. The two walls do NOT need to be equally wide on screen — one can dominate the frame and the other can be smaller. If you can see such a seam in the central 30% strip, choose corner.",
  "",
  "CASE A — back_wall: the central 30% strip is fully a flat wall surface, with NO vertical wall-meeting seam inside it. The photographer aimed straight at one main wall, and that wall fills the central strip. A side-wall sliver visible only OUTSIDE the central strip (to the left of X=35% or to the right of X=65%) does NOT make it a corner case — those edge corners are normal for a frontal photo. As long as the central 30% strip is flat wall with no inner corner seam in it, choose back_wall.",
  "",
  "CASE C — reshoot: the photo cannot be used for furniture placement. Examples: too dark to see walls, camera heavily tilted, walls blocked by objects so you cannot see where they end, the back wall is cut off by the frame so its corners are not visible, you cannot distinguish floor from wall, the photographer aimed at the floor or ceiling instead of a wall. Anything where you cannot confidently choose A or B → choose reshoot.",
  "",
  "DECISION ORDER — apply in this exact order:",
  "1. Is there a vertical wall-meeting seam anywhere inside the central 30% strip (X between 35% and 65%)? → corner.",
  "2. Is the central 30% strip a flat wall surface with no inner seam in it? → back_wall.",
  "3. Cannot tell, blocked, or photo unusable → reshoot.",
  "",
  "Tie-breakers:",
  "- A side-wall sliver visible only at the LEFT or RIGHT edge of the frame (outside the central 30% strip) is NOT a corner case.",
  "- If a seam is exactly on the edge of the central strip (around X=35% or X=65%) and you are unsure, prefer corner.",
  "- If you still cannot decide → reshoot.",
  "",
  "Return strict JSON with mode (back_wall|corner|reshoot), confidence (0-1), and a short reason that names whether a seam is visible inside the central 30% strip and approximately at what X position."
].join("\n");

export type SceneMode = "back_wall" | "corner" | "reshoot";

export type SceneClassifierSuccess = {
  ok: true;
  mode: SceneMode;
  confidence: number | null;
  reason: string | null;
};

export type SceneClassifierFailure = {
  ok: false;
  failureReason: string;
};

export type SceneClassifierResult =
  | SceneClassifierSuccess
  | SceneClassifierFailure;

export interface SceneClassifierProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  classifyScene(imageBytes: Uint8Array): Promise<SceneClassifierResult>;
}

type ChatMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user";
  content: string | ChatMessageContentPart[];
};

export type ChatCompletionsRequest = {
  model: string;
  messages: ChatMessage[];
  response_format: { type: "json_object" };
};

export type SceneClassifierRequestInput = {
  model: string;
  promptText: string;
  imageBase64: string;
  imageMimeType: string;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildSceneClassifierRequest(
  input: SceneClassifierRequestInput
): ChatCompletionsRequest {
  requireNonEmpty(input.model, "model");
  requireNonEmpty(input.promptText, "promptText");
  requireNonEmpty(input.imageBase64, "imageBase64");
  requireNonEmpty(input.imageMimeType, "imageMimeType");
  return {
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: input.promptText },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.imageMimeType};base64,${input.imageBase64}`
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" }
  };
}

export function parseSceneClassifierResponse(
  raw: unknown
): SceneClassifierResult {
  const response = raw as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  if (
    !response ||
    !Array.isArray(response.choices) ||
    response.choices.length === 0
  ) {
    return { ok: false, failureReason: "scene response had no choices" };
  }
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, failureReason: "scene response had no message content" };
  }
  let parsed: { mode?: unknown; confidence?: unknown; reason?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      failureReason: `scene response was not JSON: ${content.slice(0, 80)}`
    };
  }
  if (
    parsed.mode !== "back_wall" &&
    parsed.mode !== "corner" &&
    parsed.mode !== "reshoot"
  ) {
    return {
      ok: false,
      failureReason: `scene response had unsupported mode: ${String(parsed.mode)}`
    };
  }
  return {
    ok: true,
    mode: parsed.mode,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? parsed.confidence
        : null,
    reason: typeof parsed.reason === "string" ? parsed.reason : null
  };
}

const OPENAI_API_BASE = "https://api.openai.com/v1";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
  return "image/jpeg";
}

export class OpenAISceneClassifierProvider
  implements SceneClassifierProvider {
  readonly name = "openai";
  readonly modelId: string;
  readonly promptVersion = "room_prep_v002";
  private readonly apiKey: string;
  private readonly promptText: string;

  constructor(options: {
    apiKey: string;
    model?: string;
    promptText?: string;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("OpenAISceneClassifierProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_SCENE_DEFAULT_MODEL;
    this.promptText = options.promptText ?? DEFAULT_USER_PROMPT;
  }

  async classifyScene(imageBytes: Uint8Array): Promise<SceneClassifierResult> {
    const body = buildSceneClassifierRequest({
      model: this.modelId,
      promptText: this.promptText,
      imageBase64: bytesToBase64(imageBytes),
      imageMimeType: detectMimeType(imageBytes)
    });
    let response: Response;
    try {
      response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, failureReason: `scene network error: ${message}` };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason: `scene HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return { ok: false, failureReason: "scene returned non-JSON response" };
    }
    return parseSceneClassifierResponse(raw);
  }
}
