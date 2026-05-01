import { describe, expect, it } from "vitest";

import {
  OPENAI_CLEANING_DEFAULT_MODEL,
  OPENAI_CLEANING_DEFAULT_SIZE,
  buildCleaningFormData,
  parseCleaningResponse
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-cleaning.ts";

describe("buildCleaningFormData", () => {
  it("returns a FormData with the prompt, model, size, and the image as a Blob", () => {
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
    const form = buildCleaningFormData({
      model: OPENAI_CLEANING_DEFAULT_MODEL,
      promptText: "remove furniture",
      imageBytes,
      imageMimeType: "image/png",
      size: OPENAI_CLEANING_DEFAULT_SIZE
    });

    expect(form.get("model")).toBe(OPENAI_CLEANING_DEFAULT_MODEL);
    expect(form.get("prompt")).toBe("remove furniture");
    expect(form.get("size")).toBe(OPENAI_CLEANING_DEFAULT_SIZE);
    const image = form.get("image");
    expect(image).toBeInstanceOf(Blob);
  });

  it("requires the prompt text", () => {
    expect(() =>
      buildCleaningFormData({
        model: OPENAI_CLEANING_DEFAULT_MODEL,
        promptText: "",
        imageBytes: new Uint8Array([0xff, 0xd8]),
        imageMimeType: "image/png",
        size: OPENAI_CLEANING_DEFAULT_SIZE
      })
    ).toThrow(/promptText/);
  });

  it("requires non-empty image bytes", () => {
    expect(() =>
      buildCleaningFormData({
        model: OPENAI_CLEANING_DEFAULT_MODEL,
        promptText: "remove furniture",
        imageBytes: new Uint8Array(0),
        imageMimeType: "image/png",
        size: OPENAI_CLEANING_DEFAULT_SIZE
      })
    ).toThrow(/imageBytes/);
  });
});

describe("parseCleaningResponse", () => {
  it("decodes a base64 response into raw image bytes", () => {
    // base64 for [1, 2, 3, 4, 5]
    const b64 = "AQIDBAU=";
    const result = parseCleaningResponse({
      data: [{ b64_json: b64 }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.imageBytes)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("rejects an empty data array", () => {
    const result = parseCleaningResponse({ data: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/no image data/i);
    }
  });

  it("rejects a missing b64_json field", () => {
    const result = parseCleaningResponse({ data: [{}] });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed JSON payload", () => {
    const result = parseCleaningResponse(null);
    expect(result.ok).toBe(false);
  });

  it("returns provider error when an error envelope is present", () => {
    const result = parseCleaningResponse({
      error: { message: "rate limit exceeded" }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/rate limit/i);
    }
  });
});
