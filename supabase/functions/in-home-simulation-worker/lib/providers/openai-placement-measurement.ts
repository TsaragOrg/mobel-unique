// SPEC-0007 Stage 2 placement measurement — GPT-5 vision JSON.
//
// Used by `OpenAIPlacementProvider` self-correcting feedback loop. Given a
// placement output PNG, asks GPT-5 vision to estimate three numbers:
//   - sofa_width_pct  (sofa visible width / back-wall visible width × 100)
//   - sofa_height_pct (sofa visible height / room visible height × 100)
//   - position        ("left" | "center" | "right" — which third of the back
//                      wall the sofa center sits in)
//
// The pure helpers `buildMeasurementRequest` and `parseMeasurementResponse`
// are exercised by vitest. The `OpenAIPlacementMeasurementProvider` class
// wires fetch and lives only in the Deno runtime.
//
// Not all PlacementProvider instances need a measurement provider — when
// `selectStage2Providers` returns the mock or the Gemini provider in
// fallback mode, the feedback loop is disabled. The OpenAI primary uses it
// to retry up to 3 times when the rendered sofa misses the target ratios.

import {
  OpenAIFetchTimeoutError,
  openaiFetchWithTimeout
} from "./openai-fetch.ts";

export const OPENAI_MEASUREMENT_DEFAULT_MODEL = "gpt-5";

const SYSTEM_PROMPT =
  "You are measuring a sofa placement against the back wall of a residential room. Reply with strict JSON of shape {\"sofa_width_pct\": number, \"sofa_height_pct\": number, \"position\": \"left\"|\"center\"|\"right\"}.";

const DEFAULT_USER_PROMPT = [
  "You are looking at a photograph of a residential room with a sofa placed against the back wall.",
  "",
  "TASK: estimate three measurements as numeric percentages (0-100).",
  "",
  "1. sofa_width_pct — how much of the back wall the sofa occupies horizontally.",
  "   - Identify the leftmost X-pixel of the back wall (where it meets the LEFT side wall).",
  "   - Identify the rightmost X-pixel of the back wall (where it meets the RIGHT side wall).",
  "   - Identify the leftmost X-pixel of the visible sofa silhouette (left arm, cushion, or anything that belongs to the sofa).",
  "   - Identify the rightmost X-pixel of the visible sofa silhouette.",
  "   - Compute (sofa_pixel_width / back_wall_pixel_width) × 100.",
  "",
  "2. sofa_height_pct — how much of the room height the sofa occupies vertically.",
  "   - Identify the floor-line Y-pixel near the back wall.",
  "   - Identify the ceiling-line Y-pixel of the back wall.",
  "   - Identify the bottom-of-sofa Y-pixel (legs touching the floor).",
  "   - Identify the top-of-sofa Y-pixel (top of the backrest or pillows).",
  "   - Compute (sofa_pixel_height / room_pixel_height) × 100.",
  "",
  "3. position — where the sofa center sits horizontally on the back wall.",
  "   - Compute the sofa horizontal center pixel (midpoint of leftmost and rightmost sofa pixels).",
  "   - Divide the back wall into three equal horizontal thirds (left third / middle third / right third).",
  "   - If the sofa center is in the LEFT third → \"left\". MIDDLE third → \"center\". RIGHT third → \"right\".",
  "",
  "RULES:",
  "- Be precise. Do not round to nearest 10. Use the actual pixel ratios.",
  "- The sofa includes its arms, backrest, cushions, pillows, legs, and any visible part of its silhouette.",
  "- Doors, windows, AC units, sockets are part of the back wall, not part of the sofa — exclude them from the sofa measurement.",
  "- If a part of the sofa is occluded by another piece of furniture, estimate the silhouette as if the sofa were fully visible.",
  "",
  "Return STRICT JSON only. No prose, no markdown, no extra keys."
].join("\n");

export type MeasurementSuccess = {
  ok: true;
  sofaWidthPct: number;
  sofaHeightPct: number;
  position: "left" | "center" | "right";
};

export type MeasurementFailure = {
  ok: false;
  failureReason: string;
};

export type MeasurementResult = MeasurementSuccess | MeasurementFailure;

export interface PlacementMeasurementProvider {
  readonly name: string;
  readonly modelId: string;
  measureSofa(imageBytes: Uint8Array): Promise<MeasurementResult>;
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

export type MeasurementRequestInput = {
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

export function buildMeasurementRequest(
  input: MeasurementRequestInput
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

export function parseMeasurementResponse(raw: unknown): MeasurementResult {
  const response = raw as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  if (
    !response ||
    !Array.isArray(response.choices) ||
    response.choices.length === 0
  ) {
    return { ok: false, failureReason: "measurement response had no choices" };
  }
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return {
      ok: false,
      failureReason: "measurement response had no message content"
    };
  }
  let parsed: {
    sofa_width_pct?: unknown;
    sofa_height_pct?: unknown;
    position?: unknown;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      failureReason: `measurement response was not JSON: ${content.slice(0, 80)}`
    };
  }
  const widthValid = typeof parsed.sofa_width_pct === "number" &&
    Number.isFinite(parsed.sofa_width_pct) &&
    parsed.sofa_width_pct >= 0 &&
    parsed.sofa_width_pct <= 100;
  if (!widthValid) {
    return {
      ok: false,
      failureReason: `measurement sofa_width_pct invalid: ${String(parsed.sofa_width_pct)}`
    };
  }
  const heightValid = typeof parsed.sofa_height_pct === "number" &&
    Number.isFinite(parsed.sofa_height_pct) &&
    parsed.sofa_height_pct >= 0 &&
    parsed.sofa_height_pct <= 100;
  if (!heightValid) {
    return {
      ok: false,
      failureReason: `measurement sofa_height_pct invalid: ${String(parsed.sofa_height_pct)}`
    };
  }
  if (
    parsed.position !== "left" &&
    parsed.position !== "center" &&
    parsed.position !== "right"
  ) {
    return {
      ok: false,
      failureReason: `measurement position invalid: ${String(parsed.position)}`
    };
  }
  return {
    ok: true,
    sofaWidthPct: parsed.sofa_width_pct as number,
    sofaHeightPct: parsed.sofa_height_pct as number,
    position: parsed.position
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

export class OpenAIPlacementMeasurementProvider
  implements PlacementMeasurementProvider {
  readonly name = "openai";
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly promptText: string;
  private readonly fetchTimeoutMs: number | undefined;

  constructor(options: {
    apiKey: string;
    model?: string;
    promptText?: string;
    fetchTimeoutMs?: number;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error(
        "OpenAIPlacementMeasurementProvider requires an apiKey"
      );
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_MEASUREMENT_DEFAULT_MODEL;
    this.promptText = options.promptText ?? DEFAULT_USER_PROMPT;
    this.fetchTimeoutMs = options.fetchTimeoutMs;
  }

  async measureSofa(imageBytes: Uint8Array): Promise<MeasurementResult> {
    if (!imageBytes || imageBytes.length === 0) {
      return {
        ok: false,
        failureReason: "measurement: imageBytes must be non-empty"
      };
    }
    const body = buildMeasurementRequest({
      model: this.modelId,
      promptText: this.promptText,
      imageBase64: bytesToBase64(imageBytes),
      imageMimeType: detectMimeType(imageBytes)
    });
    let response: Response;
    try {
      response = await openaiFetchWithTimeout(
        `${OPENAI_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        },
        { timeoutMs: this.fetchTimeoutMs }
      );
    } catch (error) {
      if (error instanceof OpenAIFetchTimeoutError) {
        return {
          ok: false,
          failureReason: `measurement timeout: ${error.message}`
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        failureReason: `measurement network error: ${message}`
      };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason:
          `measurement HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        ok: false,
        failureReason: "measurement returned non-JSON response"
      };
    }
    return parseMeasurementResponse(raw);
  }
}
