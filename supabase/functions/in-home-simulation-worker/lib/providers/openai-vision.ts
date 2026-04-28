// SPEC-0007 PLAN-0010 OpenAI vision adapter for room validation.
//
// `SPEC-0007 Providers` allows the implementation plan to pin one
// primary vision model per stage. This adapter targets the OpenAI
// Chat Completions API with multimodal inputs and the JSON object
// response format so the model returns the validation contract from
// `prompts/room_prep_v001/validation.md`.
//
// The pure helpers `buildVisionValidationRequest` and
// `parseVisionValidationResponse` are exercised by vitest. The actual
// fetch call is performed by the live provider that consumes them.

import type {
  ValidationProvider,
  ValidationResult
} from "../providers.ts";

export const OPENAI_VISION_DEFAULT_MODEL = "gpt-4o";

const SYSTEM_PROMPT =
  "You are validating a customer-uploaded room photograph for an indoor furniture visualization service. Reply with strict JSON of shape {\"ok\": boolean, \"confidence\": number, \"failure_reason\": string}.";

export type VisionValidationRequest = {
  model: string;
  promptText: string;
  imageBase64: string;
  imageMimeType: string;
};

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
  temperature: number;
  response_format: { type: "json_object" };
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildVisionValidationRequest(
  input: VisionValidationRequest
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
    temperature: 0,
    response_format: { type: "json_object" }
  };
}

export function parseVisionValidationResponse(
  raw: unknown
): ValidationResult {
  const response = raw as
    | {
      choices?: Array<{ message?: { content?: string } }>;
    }
    | null;
  if (!response || !Array.isArray(response.choices) || response.choices.length === 0) {
    return {
      ok: false,
      failureReason: "vision response had no choices"
    };
  }
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return {
      ok: false,
      failureReason: "vision response had no message content"
    };
  }
  let parsed: { ok?: unknown; confidence?: unknown; failure_reason?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      failureReason: `malformed vision response JSON: ${content.slice(0, 80)}`
    };
  }
  if (parsed.ok === true) {
    return {
      ok: true,
      providerConfidence:
        typeof parsed.confidence === "number" ? parsed.confidence : null
    };
  }
  return {
    ok: false,
    failureReason: typeof parsed.failure_reason === "string"
      ? `vision rejected: ${parsed.failure_reason}`
      : "vision rejected without a failure_reason"
  };
}

const OPENAI_API_BASE = "https://api.openai.com/v1";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in Deno and modern Node 18+ runtimes.
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

export class OpenAIValidationProvider implements ValidationProvider {
  readonly name = "openai";
  readonly modelId: string;
  readonly promptVersion = "room_prep_v001";
  private readonly apiKey: string;
  private readonly promptText: string;

  constructor(options: {
    apiKey: string;
    model?: string;
    promptText?: string;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("OpenAIValidationProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_VISION_DEFAULT_MODEL;
    this.promptText = options.promptText ??
      "Validate the attached residential room photo. Return strict JSON.";
  }

  async validateRoom(imageBytes: Uint8Array): Promise<ValidationResult> {
    const body = buildVisionValidationRequest({
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
      return {
        ok: false,
        failureReason: `openai network error: ${message}`
      };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason: `openai HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        ok: false,
        failureReason: "openai returned non-JSON response"
      };
    }
    return parseVisionValidationResponse(raw);
  }
}
