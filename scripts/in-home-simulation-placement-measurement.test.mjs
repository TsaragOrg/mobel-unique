import { describe, expect, it } from "vitest";

import {
  OPENAI_MEASUREMENT_DEFAULT_MODEL,
  buildMeasurementRequest,
  parseMeasurementResponse
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-placement-measurement.ts";

describe("buildMeasurementRequest", () => {
  it("builds a chat-completions request with the system prompt, user prompt, image url, and json_object response_format", () => {
    const req = buildMeasurementRequest({
      model: OPENAI_MEASUREMENT_DEFAULT_MODEL,
      promptText: "measure please",
      imageBase64: "AQID",
      imageMimeType: "image/png"
    });
    expect(req.model).toBe(OPENAI_MEASUREMENT_DEFAULT_MODEL);
    expect(req.response_format).toEqual({ type: "json_object" });
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0].role).toBe("system");
    expect(req.messages[1].role).toBe("user");
    const userParts = req.messages[1].content;
    expect(Array.isArray(userParts)).toBe(true);
    if (Array.isArray(userParts)) {
      expect(userParts[0]).toEqual({ type: "text", text: "measure please" });
      expect(userParts[1]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,AQID" }
      });
    }
  });

  it("rejects empty image base64", () => {
    expect(() =>
      buildMeasurementRequest({
        model: OPENAI_MEASUREMENT_DEFAULT_MODEL,
        promptText: "x",
        imageBase64: "",
        imageMimeType: "image/png"
      })
    ).toThrow(/imageBase64/);
  });
});

function chatReply(content) {
  return { choices: [{ message: { content } }] };
}

describe("parseMeasurementResponse", () => {
  it("decodes a well-formed JSON measurement", () => {
    const result = parseMeasurementResponse(
      chatReply(JSON.stringify({
        sofa_width_pct: 78.6,
        sofa_height_pct: 48.3,
        position: "center"
      }))
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sofaWidthPct).toBe(78.6);
      expect(result.sofaHeightPct).toBe(48.3);
      expect(result.position).toBe("center");
    }
  });

  it("rejects missing choices", () => {
    expect(parseMeasurementResponse({}).ok).toBe(false);
  });

  it("rejects empty content", () => {
    expect(parseMeasurementResponse(chatReply("")).ok).toBe(false);
  });

  it("rejects non-JSON content", () => {
    expect(parseMeasurementResponse(chatReply("not json")).ok).toBe(false);
  });

  it("rejects width out of [0,100]", () => {
    const result = parseMeasurementResponse(
      chatReply(JSON.stringify({
        sofa_width_pct: 250,
        sofa_height_pct: 40,
        position: "center"
      }))
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/width/);
    }
  });

  it("rejects height out of [0,100]", () => {
    const result = parseMeasurementResponse(
      chatReply(JSON.stringify({
        sofa_width_pct: 40,
        sofa_height_pct: -1,
        position: "center"
      }))
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/height/);
    }
  });

  it("rejects unknown position", () => {
    const result = parseMeasurementResponse(
      chatReply(JSON.stringify({
        sofa_width_pct: 40,
        sofa_height_pct: 30,
        position: "middle"
      }))
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/position/);
    }
  });

  it("rejects width that is not a number", () => {
    const result = parseMeasurementResponse(
      chatReply(JSON.stringify({
        sofa_width_pct: "78",
        sofa_height_pct: 48,
        position: "center"
      }))
    );
    expect(result.ok).toBe(false);
  });
});
