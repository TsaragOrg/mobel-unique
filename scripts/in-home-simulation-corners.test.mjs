import { describe, expect, it } from "vitest";

import {
  OPENAI_CORNERS_DEFAULT_MODEL,
  OPENAI_CORNERS_DEFAULT_SIZE,
  PROMPT_BACK_WALL,
  PROMPT_CORNER,
  buildCornersFormData,
  parseCornersResponse,
  selectCornersPrompt
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-corners.ts";

describe("selectCornersPrompt", () => {
  it("returns the back_wall prompt for back_wall mode", () => {
    expect(selectCornersPrompt("back_wall")).toBe(PROMPT_BACK_WALL);
  });

  it("returns the corner prompt for corner mode", () => {
    expect(selectCornersPrompt("corner")).toBe(PROMPT_CORNER);
  });
});

describe("PROMPT_BACK_WALL", () => {
  it("requires EXACTLY 4 dots and forbids drawing lines", () => {
    expect(PROMPT_BACK_WALL).toMatch(/EXACTLY 4/);
    expect(PROMPT_BACK_WALL).toMatch(/Only the yellow dots/);
    expect(PROMPT_BACK_WALL).toMatch(/Do not draw lines/);
  });

  it("anchors corners to the back-wall seam, not the side wall", () => {
    expect(PROMPT_BACK_WALL).toMatch(/seam/i);
    expect(PROMPT_BACK_WALL).toMatch(/Do NOT place a dot further/i);
  });
});

describe("PROMPT_CORNER", () => {
  it("requires EXACTLY 6 dots", () => {
    expect(PROMPT_CORNER).toMatch(/EXACTLY 6/);
  });

  it("anchors the 4 outer dots to the photo edges, not a perpendicular wall", () => {
    expect(PROMPT_CORNER).toMatch(/LEFT EDGE of the photograph/);
    expect(PROMPT_CORNER).toMatch(/RIGHT EDGE of the photograph/);
  });

  it("forbids ending walls at a perpendicular wall in corner mode", () => {
    expect(PROMPT_CORNER).toMatch(/NO perpendicular wall ending them inside the frame/);
  });

  it("anchors the bottom inner-edge dot to the floor", () => {
    expect(PROMPT_CORNER).toMatch(/THIS DOT MUST BE ON THE FLOOR/);
  });
});

describe("buildCornersFormData", () => {
  it("returns FormData with prompt, model, size, and image", () => {
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const form = buildCornersFormData({
      model: OPENAI_CORNERS_DEFAULT_MODEL,
      promptText: PROMPT_BACK_WALL,
      imageBytes,
      imageMimeType: "image/png",
      size: OPENAI_CORNERS_DEFAULT_SIZE
    });
    expect(form.get("model")).toBe(OPENAI_CORNERS_DEFAULT_MODEL);
    expect(form.get("prompt")).toBe(PROMPT_BACK_WALL);
    expect(form.get("size")).toBe(OPENAI_CORNERS_DEFAULT_SIZE);
    expect(form.get("image")).toBeInstanceOf(Blob);
  });

  it("requires non-empty image bytes", () => {
    expect(() =>
      buildCornersFormData({
        model: OPENAI_CORNERS_DEFAULT_MODEL,
        promptText: "x",
        imageBytes: new Uint8Array(),
        imageMimeType: "image/png",
        size: "auto"
      })
    ).toThrow(/imageBytes/);
  });
});

describe("parseCornersResponse", () => {
  function dataReply(b64) {
    return { data: [{ b64_json: b64 }] };
  }

  it("extracts the annotated PNG bytes from a successful response", () => {
    // base64 of the 8-byte PNG signature
    const b64 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]).toString("base64");
    const result = parseCornersResponse(dataReply(b64));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pngBytes.length).toBe(8);
  });

  it("fails on missing data", () => {
    expect(parseCornersResponse({ data: [] }).ok).toBe(false);
    expect(parseCornersResponse({}).ok).toBe(false);
    expect(parseCornersResponse(null).ok).toBe(false);
  });

  it("fails on missing b64_json", () => {
    expect(parseCornersResponse({ data: [{}] }).ok).toBe(false);
  });

  it("surfaces an upstream error message", () => {
    const result = parseCornersResponse({ error: { message: "oops" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/oops/);
    }
  });
});
