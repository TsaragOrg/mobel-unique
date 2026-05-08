// SPEC-0007 PLAN-0010 OpenAI image-edit adapter for furniture removal.
//
// `SPEC-0007 Stage 1` cleaning step removes existing furniture from the
// customer's room while preserving geometry, openings, fixtures, and
// lighting. This adapter wires the OpenAI Images API
// (`/v1/images/edits` with `gpt-image-1`) using the prompt asset in
// `prompts/room_prep_v001/cleaning.md`.
//
// The pure helpers `buildCleaningFormData` and `parseCleaningResponse`
// are exercised by vitest; the `OpenAICleaningProvider` class wires
// fetch and lives only in the Deno runtime.

import type { CleaningProvider } from "../providers.ts";
import {
  OpenAIFetchTimeoutError,
  openaiFetchWithTimeout
} from "./openai-fetch.ts";

export const OPENAI_CLEANING_DEFAULT_MODEL = "gpt-image-2";
// `auto` lets the model match the input image dimensions where supported
// and avoids upscaling small input photos that already pass the worker
// max-edge check.
export const OPENAI_CLEANING_DEFAULT_SIZE = "auto";
// SPEC-0015 PLAN-0058: cleaning output is an internal artifact never
// shown to the user — `low` quality cuts gpt-image-2 generation time
// roughly in half versus the model default, which is required to fit
// the cleaning fetch under the Edge Functions 150-second wall-clock.
export const OPENAI_CLEANING_DEFAULT_QUALITY = "low";

export type CleaningFormDataInput = {
  model: string;
  promptText: string;
  imageBytes: Uint8Array;
  imageMimeType: string;
  size: string;
  quality: string;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildCleaningFormData(input: CleaningFormDataInput): FormData {
  requireNonEmpty(input.model, "model");
  requireNonEmpty(input.promptText, "promptText");
  requireNonEmpty(input.imageMimeType, "imageMimeType");
  requireNonEmpty(input.size, "size");
  requireNonEmpty(input.quality, "quality");
  if (!input.imageBytes || input.imageBytes.length === 0) {
    throw new Error("imageBytes must be a non-empty Uint8Array");
  }

  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.promptText);
  form.set("size", input.size);
  form.set("quality", input.quality);
  const blob = new Blob([new Uint8Array(input.imageBytes).buffer], {
    type: input.imageMimeType
  });
  form.set("image", blob, "room.png");
  return form;
}

export type CleaningSuccess = {
  ok: true;
  imageBytes: Uint8Array;
};

export type CleaningFailure = {
  ok: false;
  failureReason: string;
};

export type CleaningParseResult = CleaningSuccess | CleaningFailure;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function parseCleaningResponse(raw: unknown): CleaningParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, failureReason: "openai cleaning response was empty" };
  }
  const body = raw as {
    data?: Array<{ b64_json?: unknown; revised_prompt?: unknown }>;
    error?: { message?: unknown };
  };
  if (body.error && typeof body.error.message === "string") {
    return {
      ok: false,
      failureReason: `openai cleaning error: ${body.error.message}`
    };
  }
  if (!Array.isArray(body.data) || body.data.length === 0) {
    return {
      ok: false,
      failureReason: "openai cleaning response had no image data"
    };
  }
  const first = body.data[0];
  if (!first || typeof first.b64_json !== "string" || first.b64_json.length === 0) {
    return {
      ok: false,
      failureReason: "openai cleaning response had no b64_json image payload"
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(first.b64_json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      failureReason: `openai cleaning response base64 decode failed: ${message}`
    };
  }
  if (bytes.length === 0) {
    return {
      ok: false,
      failureReason: "openai cleaning response decoded to zero bytes"
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

export class OpenAICleaningProvider implements CleaningProvider {
  readonly name = "openai";
  readonly modelId: string;
  readonly promptVersion = "room_prep_v001";
  private readonly apiKey: string;
  private readonly promptText: string;
  private readonly size: string;
  private readonly quality: string;
  private readonly fetchTimeoutMs: number | undefined;

  constructor(options: {
    apiKey: string;
    model?: string;
    promptText?: string;
    size?: string;
    quality?: string;
    fetchTimeoutMs?: number;
  }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("OpenAICleaningProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? OPENAI_CLEANING_DEFAULT_MODEL;
    this.fetchTimeoutMs = options.fetchTimeoutMs;
    this.promptText = options.promptText ??
      "You are editing a residential room photograph with two strict rules. Rule 1 — REMOVE all movable items from the photo: sofas, chairs, tables, ottomans, shelving, lamps, beds, mattresses, rugs, plants, screens, decorations, and any other moveable items. Rule 2 — DO NOT ADD anything that is not already visible in the input. This is critical: if the input has no radiator, the output must have no radiator; if the input has no door on a wall, do not add a door; if the input has no window on a wall, do not add a window; do not invent furniture, fixtures, decoration, text, or any architectural element. Keep everything that already exists in the photo exactly as-is: the same walls, floor, ceiling, openings, fixtures, lighting, color cast, perspective, and focal length. Return only the edited photograph, with no captions, watermarks, or annotations.";
    this.size = options.size ?? OPENAI_CLEANING_DEFAULT_SIZE;
    this.quality = options.quality ?? OPENAI_CLEANING_DEFAULT_QUALITY;
  }

  async cleanRoom(imageBytes: Uint8Array): Promise<Uint8Array> {
    const form = buildCleaningFormData({
      model: this.modelId,
      promptText: this.promptText,
      imageBytes,
      imageMimeType: detectMimeType(imageBytes),
      size: this.size,
      quality: this.quality
    });
    let response: Response;
    try {
      response = await openaiFetchWithTimeout(
        `${OPENAI_API_BASE}/images/edits`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`
          },
          body: form
        },
        { timeoutMs: this.fetchTimeoutMs }
      );
    } catch (error) {
      if (error instanceof OpenAIFetchTimeoutError) {
        throw new Error(`openai cleaning timeout: ${error.message}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`openai cleaning network error: ${message}`);
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `openai cleaning HTTP ${response.status}: ${text.slice(0, 200)}`
      );
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error("openai cleaning returned non-JSON response");
    }
    const parsed = parseCleaningResponse(raw);
    if (!parsed.ok) {
      throw new Error(parsed.failureReason);
    }
    return parsed.imageBytes;
  }
}
