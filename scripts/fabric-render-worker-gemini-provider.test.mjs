import { describe, expect, it } from "vitest";

import {
  FABRIC_RENDER_PROMPT_VERSION,
  buildFabricRenderPrompt,
  buildFabricRenderRefinePrompt,
} from "../supabase/functions/fabric-render-worker/prompt.ts";
import {
  buildGeminiGenerateContentRequest,
  buildGeminiRestRequestBody,
  classifyGeminiProviderError,
  extractGeminiImage,
} from "../supabase/functions/fabric-render-worker/gemini.ts";

describe("fabric render Gemini provider helpers", () => {
  it("keeps the SPEC-0006 prompt version and initial preservation rules fixed without exact pixel text", () => {
    const prompt = buildFabricRenderPrompt({
      generationMode: "initial",
      targetHeightPx: 768,
      targetWidthPx: 1024,
    });

    expect(FABRIC_RENDER_PROMPT_VERSION).toBe("v007");
    expect(prompt).not.toContain("1024x768");
    expect(prompt).not.toContain("dimensions exactly");
    expect(prompt).toContain("INPUT IMAGE 1 = FABRIC SOURCE ONLY.");
    expect(prompt).toContain("INPUT IMAGE 2 = LOCKED TARGET PHOTO.");
    expect(prompt).toContain("Preserve the target sofa exactly");
    expect(prompt).toContain("Do not copy the sofa shape");
    expect(prompt).toContain("Return one generated image only.");
  });

  it("appends administrator prompt notes without replacing the fixed base prompt", () => {
    const prompt = buildFabricRenderPrompt({
      generationMode: "initial",
      promptNote: "Make the weave a little more visible.",
      targetHeightPx: 768,
      targetWidthPx: 1024,
    });

    expect(prompt).toContain("Preserve the target sofa exactly");
    expect(prompt).toContain("ADDITIONAL IMPORTANT NOTE FROM THIS RUN:");
    expect(prompt).toContain("Make the weave a little more visible.");
    expect(prompt.indexOf("Preserve the target sofa exactly")).toBeLessThan(
      prompt.indexOf("ADDITIONAL IMPORTANT NOTE"),
    );
  });

  it("builds a refine prompt wrapper without the fixed fabric transfer prompt", () => {
    const refinePrompt = buildFabricRenderRefinePrompt({
      refinePrompt: "Make the stripes thinner and closer together.",
    });

    expect(refinePrompt).not.toContain("1024x768");
    expect(refinePrompt).not.toContain("dimensions exactly");
    expect(refinePrompt).not.toContain("fabric material reference");
    expect(refinePrompt).not.toContain("locked target sofa photo");
    expect(refinePrompt).not.toContain("v007");
    expect(refinePrompt).toContain("Administrator refine instruction:");
    expect(refinePrompt).toContain(
      "Make the stripes thinner and closer together.",
    );
  });

  it("builds initial Gemini requests with two image inputs and closest supported aspect ratio config", () => {
    const request = buildGeminiGenerateContentRequest({
      fabricReference: {
        dataBase64: "fabric-image",
        mimeType: "image/jpeg",
      },
      generationMode: "initial",
      prompt: "Preserve the target sofa geometry.",
      targetHeightPx: 2048,
      targetSofa: {
        dataBase64: "target-image",
        mimeType: "image/jpeg",
      },
      targetWidthPx: 1478,
    });

    const parts = request.contents[0].parts;

    expect(request.model).toBe("gemini-3-pro-image-preview");
    expect(parts).toHaveLength(5);
    expect(parts[0].text).toBe(
      "INPUT IMAGE 1: FABRIC SOURCE. Use only the upholstery material from this image.",
    );
    expect(parts[1].inlineData).toEqual({
      data: "fabric-image",
      mimeType: "image/jpeg",
    });
    expect(parts[2].text).toBe(
      "INPUT IMAGE 2: TARGET SOFA. Preserve this sofa and scene exactly.",
    );
    expect(parts[3].inlineData).toEqual({
      data: "target-image",
      mimeType: "image/jpeg",
    });
    expect(parts[4].text).not.toContain("Image 3");
    expect(parts[4].text).toContain("Preserve the target sofa geometry.");
    expect(request.config.responseModalities).toContain("IMAGE");
    expect(request.config.imageConfig?.aspectRatio).toBe("3:4");
  });

  it("builds refine Gemini requests with one image input, refine prompt, and closest supported aspect ratio config", () => {
    const request = buildGeminiGenerateContentRequest({
      generationMode: "refine",
      prompt: buildFabricRenderRefinePrompt({
        refinePrompt: "Make the stripes thinner and closer together.",
      }),
      refineSource: {
        dataBase64: "current-output-image",
        mimeType: "image/png",
      },
      targetHeightPx: 768,
      targetWidthPx: 1024,
    });

    const parts = request.contents[0].parts;

    expect(parts).toHaveLength(3);
    expect(parts[0].text).toBe(
      "INPUT IMAGE 1: CURRENT OUTPUT. Refine this existing output image in place.",
    );
    expect(parts[1].inlineData).toEqual({
      data: "current-output-image",
      mimeType: "image/png",
    });
    expect(parts[2].text).toContain(
      "Make the stripes thinner and closer together.",
    );
    expect(parts[2].text).not.toContain("fabric material source");
    expect(parts[2].text).not.toContain("locked target sofa photo");
    expect(parts[2].text).not.toContain("v007");
    expect(request.config.imageConfig?.aspectRatio).toBe("4:3");
  });

  it("converts the internal Gemini request to REST inline_data and imageConfig shape", () => {
    const request = buildGeminiGenerateContentRequest({
      fabricReference: {
        dataBase64: "fabric-image",
        mimeType: "image/jpeg",
      },
      generationMode: "initial",
      prompt: "Preserve the target sofa geometry.",
      targetHeightPx: 2048,
      targetSofa: {
        dataBase64: "target-image",
        mimeType: "image/jpeg",
      },
      targetWidthPx: 1478,
    });

    const body = buildGeminiRestRequestBody(request);

    expect(body.contents[0].parts[0].text).toBe(
      "INPUT IMAGE 1: FABRIC SOURCE. Use only the upholstery material from this image.",
    );
    expect(body.contents[0].parts[1].inline_data).toEqual({
      data: "fabric-image",
      mime_type: "image/jpeg",
    });
    expect(body.contents[0].parts[2].text).toBe(
      "INPUT IMAGE 2: TARGET SOFA. Preserve this sofa and scene exactly.",
    );
    expect(body.contents[0].parts[3].inline_data).toEqual({
      data: "target-image",
      mime_type: "image/jpeg",
    });
    expect(body.contents[0].parts[4].text).toContain(
      "Preserve the target sofa geometry.",
    );
    expect(body.generationConfig.responseModalities).toContain("IMAGE");
    expect(body.generationConfig.imageConfig?.aspectRatio).toBe("3:4");
  });

  it("rejects non-positive authority dimensions before building Gemini image config", () => {
    expect(() =>
      buildGeminiGenerateContentRequest({
        fabricReference: {
          dataBase64: "fabric-image",
          mimeType: "image/jpeg",
        },
        generationMode: "initial",
        prompt: "Preserve the target sofa geometry.",
        targetHeightPx: 768,
        targetSofa: {
          dataBase64: "target-image",
          mimeType: "image/jpeg",
        },
        targetWidthPx: 0,
      }),
    ).toThrow("positive");
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
                  mimeType: "image/png",
                },
              },
            ],
          },
        },
      ],
    });

    expect(image).toEqual({
      dataBase64: "generated-image",
      mimeType: "image/png",
    });
  });

  it("fails readably when Gemini returns no image data", () => {
    expect(() =>
      extractGeminiImage({
        candidates: [
          {
            content: {
              parts: [{ text: "I cannot generate that image." }],
            },
          },
        ],
      }),
    ).toThrow("Gemini did not return image data");
  });

  it("classifies transient Gemini failures as retryable", () => {
    expect(classifyGeminiProviderError({ status: 429 }).retryable).toBe(true);
    expect(classifyGeminiProviderError({ status: 500 }).retryable).toBe(true);
    expect(
      classifyGeminiProviderError({
        name: "TimeoutError",
        message: "timed out",
      }).retryable,
    ).toBe(true);
    expect(
      classifyGeminiProviderError({
        cause: { code: "ECONNRESET" },
        message: "fetch failed",
      }).retryable,
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
