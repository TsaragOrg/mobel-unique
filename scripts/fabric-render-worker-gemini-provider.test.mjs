import { describe, expect, it } from "vitest";

import {
  FABRIC_RENDER_PROMPT_VERSION,
  buildFabricRenderPrompt
} from "../supabase/functions/fabric-render-worker/prompt.ts";
import {
  buildGeminiGenerateContentRequest,
  buildGeminiRestRequestBody,
  classifyGeminiProviderError,
  extractGeminiImage
} from "../supabase/functions/fabric-render-worker/gemini.ts";

describe("fabric render Gemini provider helpers", () => {
  it("keeps the SPEC-0006 prompt version and initial preservation rules fixed", () => {
    const prompt = buildFabricRenderPrompt({
      generationMode: "initial",
      targetHeightPx: 768,
      targetWidthPx: 1024
    });

    expect(FABRIC_RENDER_PROMPT_VERSION).toBe("v007");
    expect(prompt).toContain("1024x768");
    expect(prompt).toContain("first image only as the fabric material reference");
    expect(prompt).toContain("second image as the locked target sofa photo");
    expect(prompt).toContain("Preserve the target sofa geometry");
    expect(prompt).toContain("Do not copy the fabric reference sofa shape");
  });

  it("appends administrator prompt notes without replacing the fixed base prompt", () => {
    const prompt = buildFabricRenderPrompt({
      generationMode: "initial",
      promptNote: "Make the weave a little more visible.",
      targetHeightPx: 768,
      targetWidthPx: 1024
    });

    expect(prompt).toContain("Preserve the target sofa geometry");
    expect(prompt).toContain(
      "Additional administrator instruction appended to the fixed prompt:"
    );
    expect(prompt).toContain("Make the weave a little more visible.");
    expect(prompt.indexOf("Preserve the target sofa geometry")).toBeLessThan(
      prompt.indexOf("Additional administrator instruction")
    );
  });

  it("adds refinement instructions only for refine mode", () => {
    const initialPrompt = buildFabricRenderPrompt({
      generationMode: "initial",
      targetHeightPx: 768,
      targetWidthPx: 1024
    });
    const refinePrompt = buildFabricRenderPrompt({
      generationMode: "refine",
      targetHeightPx: 768,
      targetWidthPx: 1024
    });

    expect(initialPrompt).not.toContain("third image");
    expect(refinePrompt).toContain("third image");
    expect(refinePrompt).toContain("render selected for refinement");
  });

  it("builds the Gemini image request with SPEC-0006 model, input order, labels, and image output", () => {
    const request = buildGeminiGenerateContentRequest({
      fabricReference: {
        dataBase64: "fabric-image",
        mimeType: "image/jpeg"
      },
      prompt: "Preserve the target sofa geometry.",
      refineSource: {
        dataBase64: "refine-image",
        mimeType: "image/png"
      },
      targetSofa: {
        dataBase64: "target-image",
        mimeType: "image/jpeg"
      }
    });

    const parts = request.contents[0].parts;

    expect(request.model).toBe("gemini-3-pro-image-preview");
    expect(parts[0].inlineData).toEqual({
      data: "fabric-image",
      mimeType: "image/jpeg"
    });
    expect(parts[1].inlineData).toEqual({
      data: "target-image",
      mimeType: "image/jpeg"
    });
    expect(parts[2].inlineData).toEqual({
      data: "refine-image",
      mimeType: "image/png"
    });
    expect(parts[3].text).toContain("Image 1 is the fabric material source");
    expect(parts[3].text).toContain("Image 2 is the locked target sofa photo");
    expect(parts[3].text).toContain("Image 3 is the refinement source render");
    expect(parts[3].text).toContain("Preserve the target sofa geometry.");
    expect(request.config.responseModalities).toContain("IMAGE");
  });

  it("omits the refinement image from initial Gemini requests", () => {
    const request = buildGeminiGenerateContentRequest({
      fabricReference: {
        dataBase64: "fabric-image",
        mimeType: "image/jpeg"
      },
      prompt: "Preserve the target sofa geometry.",
      targetSofa: {
        dataBase64: "target-image",
        mimeType: "image/jpeg"
      }
    });

    const parts = request.contents[0].parts;

    expect(parts).toHaveLength(3);
    expect(parts[0].inlineData.data).toBe("fabric-image");
    expect(parts[1].inlineData.data).toBe("target-image");
    expect(parts[2].text).not.toContain("Image 3");
  });

  it("converts the internal Gemini request to REST inline_data shape", () => {
    const request = buildGeminiGenerateContentRequest({
      fabricReference: {
        dataBase64: "fabric-image",
        mimeType: "image/jpeg"
      },
      prompt: "Preserve the target sofa geometry.",
      targetSofa: {
        dataBase64: "target-image",
        mimeType: "image/jpeg"
      }
    });

    const body = buildGeminiRestRequestBody(request);

    expect(body.contents[0].parts[0].inline_data).toEqual({
      data: "fabric-image",
      mime_type: "image/jpeg"
    });
    expect(body.contents[0].parts[1].inline_data).toEqual({
      data: "target-image",
      mime_type: "image/jpeg"
    });
    expect(body.contents[0].parts[2].text).toContain(
      "Preserve the target sofa geometry."
    );
    expect(body.generationConfig.responseModalities).toContain("IMAGE");
  });

  it("extracts generated image data from Gemini response parts", () => {
    const image = extractGeminiImage({
      candidates: [
        {
          content: {
            parts: [
              { text: "Generated image attached." },
              {
                inlineData: {
                  data: "generated-image",
                  mimeType: "image/png"
                }
              }
            ]
          }
        }
      ]
    });

    expect(image).toEqual({
      dataBase64: "generated-image",
      mimeType: "image/png"
    });
  });

  it("fails readably when Gemini returns no image data", () => {
    expect(() =>
      extractGeminiImage({
        candidates: [
          {
            content: {
              parts: [{ text: "I cannot generate that image." }]
            }
          }
        ]
      })
    ).toThrow("Gemini did not return image data");
  });

  it("classifies transient Gemini failures as retryable", () => {
    expect(classifyGeminiProviderError({ status: 429 }).retryable).toBe(true);
    expect(classifyGeminiProviderError({ status: 500 }).retryable).toBe(true);
    expect(
      classifyGeminiProviderError({ name: "TimeoutError", message: "timed out" })
        .retryable
    ).toBe(true);
    expect(
      classifyGeminiProviderError({
        cause: { code: "ECONNRESET" },
        message: "fetch failed"
      }).retryable
    ).toBe(true);
  });

  it("classifies provider validation and no-image failures as non-retryable", () => {
    expect(classifyGeminiProviderError({ status: 400 }).retryable).toBe(false);

    try {
      extractGeminiImage({ candidates: [{ content: { parts: [] } }] });
    } catch (error) {
      expect(classifyGeminiProviderError(error).retryable).toBe(false);
    }
  });
});
