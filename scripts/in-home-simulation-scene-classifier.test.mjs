import { describe, expect, it } from "vitest";

import {
  OPENAI_SCENE_DEFAULT_MODEL,
  buildSceneClassifierRequest,
  parseSceneClassifierResponse
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-scene-classifier.ts";

describe("buildSceneClassifierRequest", () => {
  it("emits the chat completions payload with the scene prompt and the image", () => {
    const payload = buildSceneClassifierRequest({
      model: OPENAI_SCENE_DEFAULT_MODEL,
      promptText: "classify the room",
      imageBase64: "ZmFrZQ==",
      imageMimeType: "image/jpeg"
    });

    expect(payload.model).toBe(OPENAI_SCENE_DEFAULT_MODEL);
    expect(payload.response_format).toEqual({ type: "json_object" });
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

  it("rejects empty inputs", () => {
    expect(() =>
      buildSceneClassifierRequest({
        model: "",
        promptText: "x",
        imageBase64: "y",
        imageMimeType: "image/jpeg"
      })
    ).toThrow(/model/);
  });
});

describe("parseSceneClassifierResponse", () => {
  function reply(content) {
    return { choices: [{ message: { content } }] };
  }

  it("extracts mode/confidence/reason for back_wall", () => {
    const result = parseSceneClassifierResponse(
      reply(
        JSON.stringify({
          mode: "back_wall",
          confidence: 0.95,
          reason: "single flat wall"
        })
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("back_wall");
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe("single flat wall");
  });

  it("extracts mode for corner", () => {
    const result = parseSceneClassifierResponse(
      reply(JSON.stringify({ mode: "corner", confidence: 0.7, reason: "" }))
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("corner");
  });

  it("extracts mode for reshoot", () => {
    const result = parseSceneClassifierResponse(
      reply(
        JSON.stringify({
          mode: "reshoot",
          confidence: 0.4,
          reason: "back wall cut off by frame"
        })
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("reshoot");
    expect(result.reason).toBe("back wall cut off by frame");
  });

  it("returns failure when mode is invalid", () => {
    const result = parseSceneClassifierResponse(
      reply(JSON.stringify({ mode: "anything-else" }))
    );
    expect(result.ok).toBe(false);
  });

  it("returns failure when content is not JSON", () => {
    const result = parseSceneClassifierResponse(reply("not-json"));
    expect(result.ok).toBe(false);
  });

  it("returns failure when there are no choices", () => {
    expect(parseSceneClassifierResponse({ choices: [] }).ok).toBe(false);
    expect(parseSceneClassifierResponse({}).ok).toBe(false);
    expect(parseSceneClassifierResponse(null).ok).toBe(false);
  });
});
