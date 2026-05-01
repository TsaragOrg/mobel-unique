import { describe, expect, it } from "vitest";

import {
  GEMINI_PLACEMENT_DEFAULT_MODEL,
  buildGeminiPlacementBody,
  parseGeminiPlacementResponse
} from "../supabase/functions/in-home-simulation-worker/lib/providers/gemini-placement.ts";

describe("buildGeminiPlacementBody", () => {
  it("emits a generateContent payload with the room and sofa as inline_data", () => {
    const room = "AAAA";
    const sofa = "BBBB";
    const body = buildGeminiPlacementBody({
      promptText: "place sofa",
      cleanedRoomBase64: room,
      cleanedRoomMimeType: "image/png",
      preparedSofaBase64: sofa,
      preparedSofaMimeType: "image/png"
    });

    expect(Array.isArray(body.contents)).toBe(true);
    expect(body.contents).toHaveLength(1);
    const parts = body.contents[0].parts;
    const inlineCount = parts.filter((p) => "inline_data" in p).length;
    expect(inlineCount).toBe(2);
    const textPart = parts.find((p) => "text" in p);
    expect(textPart.text).toMatch(/place sofa/);
    expect(body.generationConfig.responseModalities).toEqual(
      expect.arrayContaining(["IMAGE"])
    );
  });

  it("attaches only the room when the sofa is missing", () => {
    const body = buildGeminiPlacementBody({
      promptText: "place sofa",
      cleanedRoomBase64: "ZmFrZQ==",
      cleanedRoomMimeType: "image/png",
      preparedSofaBase64: null,
      preparedSofaMimeType: null
    });
    const parts = body.contents[0].parts;
    const inlineCount = parts.filter((p) => "inline_data" in p).length;
    expect(inlineCount).toBe(1);
  });

  it("requires a non-empty prompt", () => {
    expect(() =>
      buildGeminiPlacementBody({
        promptText: "",
        cleanedRoomBase64: "ZmFrZQ==",
        cleanedRoomMimeType: "image/png",
        preparedSofaBase64: null,
        preparedSofaMimeType: null
      })
    ).toThrow(/promptText/);
  });
});

describe("parseGeminiPlacementResponse", () => {
  it("returns the inline image bytes from the first candidate", () => {
    // base64 for [10, 20, 30]
    const b64 = "ChQe";
    const result = parseGeminiPlacementResponse({
      candidates: [
        {
          content: {
            parts: [
              { inline_data: { data: b64, mime_type: "image/png" } }
            ]
          }
        }
      ]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.imageBytes)).toEqual([10, 20, 30]);
      expect(result.mimeType).toBe("image/png");
    }
  });

  it("supports the camelCase `inlineData` shape", () => {
    const result = parseGeminiPlacementResponse({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { data: "AQID", mimeType: "image/jpeg" } }
            ]
          }
        }
      ]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.imageBytes)).toEqual([1, 2, 3]);
      expect(result.mimeType).toBe("image/jpeg");
    }
  });

  it("returns failure when the response surfaces an error", () => {
    const result = parseGeminiPlacementResponse({
      error: { message: "blocked: policy violation" }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/blocked/);
    }
  });

  it("returns failure when no inline data is present", () => {
    const result = parseGeminiPlacementResponse({
      candidates: [{ content: { parts: [{ text: "no image" }] } }]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/no image data/i);
    }
  });
});
