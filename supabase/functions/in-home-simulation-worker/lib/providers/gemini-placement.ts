// SPEC-0007 PLAN-0011 Gemini fallback adapter for sofa placement.
//
// Per the worker model stack documented in repository memory, the
// primary placement provider is OpenAI `gpt-image-1`; this adapter
// targets Google Gemini as the fallback when the primary is
// unavailable or fails. The Gemini Image preview model accepts
// multi-image input plus a text prompt and returns inline image bytes,
// matching the placement contract from
// `prompts/sofa_placement_v001/placement.md`.
//
// The pure helpers `buildGeminiPlacementBody` and
// `parseGeminiPlacementResponse` are exercised by vitest. The
// `GeminiPlacementProvider` class wires fetch and lives only in the
// Deno runtime.

import type {
  PlacementInputs,
  PlacementProvider,
  PlacementResult
} from "../providers.ts";
import { buildPlacementPrompt } from "./openai-placement.ts";

export const GEMINI_PLACEMENT_DEFAULT_MODEL = "gemini-3-pro-image-preview";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type InlineDataPart = {
  inline_data: { data: string; mime_type: string };
};

type TextPart = { text: string };

type GeminiPart = InlineDataPart | TextPart;

export type GeminiPlacementBody = {
  contents: Array<{ role: "user"; parts: GeminiPart[] }>;
  generationConfig: { responseModalities: string[] };
};

export type GeminiPlacementBodyInput = {
  promptText: string;
  cleanedRoomBase64: string;
  cleanedRoomMimeType: string;
  preparedSofaBase64: string | null;
  preparedSofaMimeType: string | null;
};

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required and must be non-empty`);
  }
  return value;
}

export function buildGeminiPlacementBody(
  input: GeminiPlacementBodyInput
): GeminiPlacementBody {
  requireNonEmpty(input.promptText, "promptText");
  requireNonEmpty(input.cleanedRoomBase64, "cleanedRoomBase64");
  requireNonEmpty(input.cleanedRoomMimeType, "cleanedRoomMimeType");

  const parts: GeminiPart[] = [
    {
      inline_data: {
        data: input.cleanedRoomBase64,
        mime_type: input.cleanedRoomMimeType
      }
    }
  ];

  if (
    input.preparedSofaBase64 &&
    input.preparedSofaBase64.length > 0 &&
    input.preparedSofaMimeType
  ) {
    parts.push({
      inline_data: {
        data: input.preparedSofaBase64,
        mime_type: input.preparedSofaMimeType
      }
    });
  }

  parts.push({ text: input.promptText });

  return {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  };
}

export type GeminiPlacementSuccess = {
  ok: true;
  imageBytes: Uint8Array;
  mimeType: string;
};

export type GeminiPlacementFailure = {
  ok: false;
  failureReason: string;
};

export type GeminiPlacementParseResult =
  | GeminiPlacementSuccess
  | GeminiPlacementFailure;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function readInlineData(
  part: unknown
): { data: string; mimeType: string } | null {
  if (!part || typeof part !== "object") return null;
  const record = part as Record<string, unknown>;
  const inline =
    (record.inline_data as Record<string, unknown> | undefined) ??
    (record.inlineData as Record<string, unknown> | undefined);
  if (!inline) return null;
  const data = typeof inline.data === "string" ? inline.data : null;
  const mimeType =
    typeof inline.mime_type === "string"
      ? inline.mime_type
      : typeof inline.mimeType === "string"
        ? inline.mimeType
        : "image/png";
  if (!data || data.length === 0) return null;
  return { data, mimeType };
}

export function parseGeminiPlacementResponse(
  raw: unknown
): GeminiPlacementParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, failureReason: "gemini placement response was empty" };
  }
  const body = raw as {
    error?: { message?: unknown };
    candidates?: Array<{ content?: { parts?: unknown[] } }>;
  };
  if (body.error && typeof body.error.message === "string") {
    return {
      ok: false,
      failureReason: `gemini placement error: ${body.error.message}`
    };
  }
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    for (const part of parts) {
      const inline = readInlineData(part);
      if (inline) {
        let bytes: Uint8Array;
        try {
          bytes = decodeBase64(inline.data);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            ok: false,
            failureReason: `gemini placement base64 decode failed: ${message}`
          };
        }
        if (bytes.length === 0) {
          return {
            ok: false,
            failureReason: "gemini placement decoded to zero bytes"
          };
        }
        return { ok: true, imageBytes: bytes, mimeType: inline.mimeType };
      }
    }
  }
  return {
    ok: false,
    failureReason: "gemini placement response had no image data"
  };
}

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
  return "image/png";
}

export class GeminiPlacementProvider implements PlacementProvider {
  readonly name = "gemini";
  readonly modelId: string;
  readonly promptVersion = "sofa_placement_v003";
  private readonly apiKey: string;

  constructor(options: { apiKey: string; model?: string }) {
    if (!options.apiKey || options.apiKey.length === 0) {
      throw new Error("GeminiPlacementProvider requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.modelId = options.model ?? GEMINI_PLACEMENT_DEFAULT_MODEL;
  }

  async placeSofa(inputs: PlacementInputs): Promise<PlacementResult> {
    const promptText = buildPlacementPrompt({
      mode: inputs.mode,
      suppliedDimensions: inputs.suppliedDimensions,
      position: inputs.position
    });

    const body = buildGeminiPlacementBody({
      promptText,
      cleanedRoomBase64: bytesToBase64(inputs.cleanedRoomBytes),
      cleanedRoomMimeType: detectMimeType(inputs.cleanedRoomBytes),
      preparedSofaBase64: inputs.preparedSofaBytes
        ? bytesToBase64(inputs.preparedSofaBytes)
        : null,
      preparedSofaMimeType: inputs.preparedSofaBytes
        ? detectMimeType(inputs.preparedSofaBytes)
        : null
    });

    const url = `${GEMINI_API_BASE}/models/${this.modelId}:generateContent?key=${this.apiKey}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        failureReason: `gemini placement network error: ${message}`
      };
    }
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        failureReason: `gemini placement HTTP ${response.status}: ${text.slice(0, 200)}`
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        ok: false,
        failureReason: "gemini placement returned non-JSON response"
      };
    }
    const parsed = parseGeminiPlacementResponse(raw);
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

export class FallbackPlacementProvider implements PlacementProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;

  constructor(
    private readonly primary: PlacementProvider,
    private readonly fallback: PlacementProvider
  ) {
    // The wrapper reports the primary identity; the failover identity
    // surfaces in the failure_reason when fallback runs.
    this.name = primary.name;
    this.modelId = primary.modelId;
    this.promptVersion = primary.promptVersion;
  }

  async placeSofa(inputs: PlacementInputs): Promise<PlacementResult> {
    const primaryResult = await this.primary.placeSofa(inputs);
    if (primaryResult.ok) return primaryResult;

    const fallbackResult = await this.fallback.placeSofa(inputs);
    if (fallbackResult.ok) return fallbackResult;

    return {
      ok: false,
      failureReason: `primary (${this.primary.name}) failed: ${primaryResult.failureReason}; fallback (${this.fallback.name}) failed: ${fallbackResult.failureReason}`
    };
  }
}
