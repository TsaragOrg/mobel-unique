import { describe, expect, it } from "vitest";

import {
  OPENAI_VISION_DEFAULT_MODEL,
  buildVisionValidationRequest,
  parseVisionValidationResponse
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-vision.ts";

describe("buildVisionValidationRequest", () => {
  it("emits the chat completions payload with the validation prompt and the image", () => {
    const payload = buildVisionValidationRequest({
      model: OPENAI_VISION_DEFAULT_MODEL,
      promptText: "validate the room",
      imageBase64: "ZmFrZQ==",
      imageMimeType: "image/jpeg"
    });

    expect(payload.model).toBe(OPENAI_VISION_DEFAULT_MODEL);
    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload.temperature).toBeUndefined();
    expect(Array.isArray(payload.messages)).toBe(true);
    const lastMessage = payload.messages[payload.messages.length - 1];
    expect(lastMessage.role).toBe("user");
    expect(Array.isArray(lastMessage.content)).toBe(true);
    const imagePart = lastMessage.content.find(
      (part) => part.type === "image_url"
    );
    expect(imagePart).toBeDefined();
    expect(imagePart.image_url.url).toBe("data:image/jpeg;base64,ZmFrZQ==");
  });

  it("rejects an empty model, prompt, or image", () => {
    expect(() =>
      buildVisionValidationRequest({
        model: "",
        promptText: "x",
        imageBase64: "y",
        imageMimeType: "image/jpeg"
      })
    ).toThrow(/model/);
    expect(() =>
      buildVisionValidationRequest({
        model: "m",
        promptText: "",
        imageBase64: "y",
        imageMimeType: "image/jpeg"
      })
    ).toThrow(/promptText/);
    expect(() =>
      buildVisionValidationRequest({
        model: "m",
        promptText: "x",
        imageBase64: "",
        imageMimeType: "image/jpeg"
      })
    ).toThrow(/imageBase64/);
  });
});

describe("parseVisionValidationResponse", () => {
  it("returns ok when the model JSON says ok=true", () => {
    const result = parseVisionValidationResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({ ok: true, confidence: 0.97 })
          }
        }
      ]
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok=false with the failure_reason when the model says ok=false", () => {
    const result = parseVisionValidationResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ok: false,
              failure_reason: "outdoor scene"
            })
          }
        }
      ]
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("outdoor scene");
  });

  it("treats malformed JSON content as failure with a readable reason", () => {
    const result = parseVisionValidationResponse({
      choices: [{ message: { content: "not-json" } }]
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("malformed");
  });

  it("treats empty choices as failure", () => {
    const result = parseVisionValidationResponse({ choices: [] });
    expect(result.ok).toBe(false);
  });

  it("treats unexpected response shape as failure", () => {
    const result = parseVisionValidationResponse(null);
    expect(result.ok).toBe(false);
  });
});
