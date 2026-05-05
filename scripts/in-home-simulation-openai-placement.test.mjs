import { describe, expect, it } from "vitest";

import {
  MAX_PLACEMENT_ATTEMPTS,
  OPENAI_PLACEMENT_DEFAULT_MODEL,
  OPENAI_PLACEMENT_DEFAULT_SIZE,
  PLACEMENT_TOLERANCE_PCT,
  buildPlacementFeedback,
  buildPlacementFormData,
  buildPlacementPrompt,
  computeBackWallTargets,
  isPlacementWithinTolerance,
  parsePlacementResponse,
  placementDeltaScore
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-placement.ts";

describe("buildPlacementPrompt", () => {
  it("emits the back_wall template with the supplied wall dimensions", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6 }
    });
    expect(text).toMatch(/centered against the back wall/);
    expect(text).toMatch(/Room width: 4\.2 m/);
    expect(text).toMatch(/Room height: 2\.6 m/);
  });

  it("emits the corner template with the supplied L-sofa dimensions", () => {
    const text = buildPlacementPrompt({
      mode: "corner",
      suppliedDimensions: {
        left_wall_width: 3.5,
        right_wall_width: 4.0,
        room_height: 2.7,
        sofa_left: 3.0,
        sofa_right: 2.7,
        sofa_height: 1.3
      }
    });
    expect(text).toMatch(/L-shaped CORNER SOFA/);
    expect(text).toMatch(/Left wall length: 3\.5 m/);
    expect(text).toMatch(/Right wall length: 4 m/);
    expect(text).toMatch(/Wall height: 2\.7 m/);
  });

  it("includes the DOORS-DO-NOT-BLOCK directive in the back_wall prompt", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6 }
    });
    expect(text).toMatch(/DOORS, WINDOWS, AC UNITS/);
    expect(text).toMatch(/sofa OCCLUDES the feature/);
  });

  it("includes the ANTI-REGRESSION reminder in the back_wall prompt", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6, sofa_width: 3.3, sofa_height: 1.4 }
    });
    expect(text).toMatch(/ANTI-REGRESSION/);
    expect(text).toMatch(/intentionally non-standard/);
  });

  it("uses EXACTLY language for sofa dimensions", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6, sofa_width: 3.3, sofa_height: 1.4 }
    });
    expect(text).toMatch(/EXACTLY 3\.3 m/);
    expect(text).toMatch(/EXACTLY 1\.4 m/);
  });

  it("includes calibrated corner-position metres for centered placement", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 5, wall_height: 3, sofa_width: 3, sofa_height: 1.3 },
      position: "center"
    });
    expect(text).toMatch(/Sofa BOTTOM-LEFT corner: 1\.00 m to the right/);
    expect(text).toMatch(/Sofa BOTTOM-RIGHT corner: 1\.00 m to the left/);
  });

  it("emits no FEEDBACK_BLOCK placeholder when no feedback is supplied", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6 }
    });
    expect(text).not.toMatch(/\{\{FEEDBACK_BLOCK\}\}/);
    expect(text).not.toMatch(/PREVIOUS ATTEMPT FEEDBACK/);
  });

  it("injects feedback content when provided", () => {
    const text = buildPlacementPrompt({
      mode: "back_wall",
      suppliedDimensions: { wall_width: 4.2, wall_height: 2.6 },
      feedback: "PREVIOUS ATTEMPT FEEDBACK — sofa was too narrow."
    });
    expect(text).toMatch(/PREVIOUS ATTEMPT FEEDBACK/);
    expect(text).toMatch(/sofa was too narrow/);
  });

  it("injects feedback in corner mode too", () => {
    const text = buildPlacementPrompt({
      mode: "corner",
      suppliedDimensions: {
        left_wall_width: 3.2,
        right_wall_width: 3,
        room_height: 3,
        sofa_left: 3,
        sofa_right: 2.7,
        sofa_height: 1.3
      },
      feedback: "PREVIOUS ATTEMPT FEEDBACK — corner sofa too short."
    });
    expect(text).toMatch(/PREVIOUS ATTEMPT FEEDBACK/);
    expect(text).toMatch(/corner sofa too short/);
  });
});

describe("computeBackWallTargets", () => {
  function inputs(overrides = {}) {
    return {
      cleanedRoomBytes: new Uint8Array([1]),
      cleanedRoomWidth: 1000,
      cleanedRoomHeight: 1500,
      preparedSofaBytes: new Uint8Array([1]),
      mode: "back_wall",
      suppliedDimensions: {
        wall_width: 5,
        wall_height: 3,
        sofa_width: 3,
        sofa_height: 1.3
      },
      position: "center",
      ...overrides
    };
  }

  it("computes width %, height %, and position from supplied dimensions", () => {
    const targets = computeBackWallTargets(inputs());
    expect(targets).not.toBeNull();
    if (targets) {
      expect(targets.widthPct).toBeCloseTo(60, 5);
      expect(targets.heightPct).toBeCloseTo(43.333, 2);
      expect(targets.position).toBe("center");
    }
  });

  it("returns null for corner mode (feedback loop disabled)", () => {
    expect(computeBackWallTargets(inputs({ mode: "corner" }))).toBeNull();
  });

  it("returns null when sofa dimensions are missing", () => {
    expect(
      computeBackWallTargets(
        inputs({ suppliedDimensions: { wall_width: 5, wall_height: 3 } })
      )
    ).toBeNull();
  });

  it("treats unknown position as center", () => {
    const targets = computeBackWallTargets(
      inputs({ position: "elsewhere" })
    );
    expect(targets?.position).toBe("center");
  });
});

describe("isPlacementWithinTolerance", () => {
  const targets = { widthPct: 60, heightPct: 43, position: "center" };

  it("accepts an exact match", () => {
    expect(
      isPlacementWithinTolerance(
        { ok: true, sofaWidthPct: 60, sofaHeightPct: 43, position: "center" },
        targets
      )
    ).toBe(true);
  });

  it("accepts within tolerance", () => {
    expect(
      isPlacementWithinTolerance(
        {
          ok: true,
          sofaWidthPct: 60 + PLACEMENT_TOLERANCE_PCT - 0.1,
          sofaHeightPct: 43 - PLACEMENT_TOLERANCE_PCT + 0.1,
          position: "center"
        },
        targets
      )
    ).toBe(true);
  });

  it("rejects width outside tolerance", () => {
    expect(
      isPlacementWithinTolerance(
        {
          ok: true,
          sofaWidthPct: 60 - PLACEMENT_TOLERANCE_PCT - 1,
          sofaHeightPct: 43,
          position: "center"
        },
        targets
      )
    ).toBe(false);
  });

  it("rejects position mismatch even with perfect ratios", () => {
    expect(
      isPlacementWithinTolerance(
        { ok: true, sofaWidthPct: 60, sofaHeightPct: 43, position: "left" },
        targets
      )
    ).toBe(false);
  });
});

describe("placementDeltaScore", () => {
  const targets = { widthPct: 60, heightPct: 43, position: "center" };

  it("is zero on a perfect match", () => {
    expect(
      placementDeltaScore(
        { ok: true, sofaWidthPct: 60, sofaHeightPct: 43, position: "center" },
        targets
      )
    ).toBe(0);
  });

  it("ranks closer attempts lower", () => {
    const close = placementDeltaScore(
      { ok: true, sofaWidthPct: 58, sofaHeightPct: 41, position: "center" },
      targets
    );
    const far = placementDeltaScore(
      { ok: true, sofaWidthPct: 80, sofaHeightPct: 30, position: "center" },
      targets
    );
    expect(close).toBeLessThan(far);
  });

  it("penalizes position mismatch heavily", () => {
    const wrongPos = placementDeltaScore(
      { ok: true, sofaWidthPct: 60, sofaHeightPct: 43, position: "left" },
      targets
    );
    expect(wrongPos).toBeGreaterThanOrEqual(30);
  });
});

describe("buildPlacementFeedback", () => {
  const targets = { widthPct: 78.6, heightPct: 48.3, position: "center" };

  it("contains a width-fix instruction when measured width is too narrow", () => {
    const text = buildPlacementFeedback(
      { ok: true, sofaWidthPct: 67, sofaHeightPct: 48, position: "center" },
      targets,
      "m",
      3.3,
      1.4
    );
    expect(text).toMatch(/PREVIOUS ATTEMPT FEEDBACK/);
    expect(text).toMatch(/WIDTH FIX/);
    expect(text).toMatch(/TOO NARROW/);
    expect(text).toMatch(/ENLARGE/);
  });

  it("contains a height-fix instruction when measured height is too short", () => {
    const text = buildPlacementFeedback(
      { ok: true, sofaWidthPct: 78, sofaHeightPct: 38, position: "center" },
      targets,
      "m",
      3.3,
      1.4
    );
    expect(text).toMatch(/HEIGHT FIX/);
    expect(text).toMatch(/TOO SHORT/);
  });

  it("contains a position-fix instruction when position is wrong", () => {
    const text = buildPlacementFeedback(
      { ok: true, sofaWidthPct: 78, sofaHeightPct: 48, position: "left" },
      targets,
      "m",
      3.3,
      1.4
    );
    expect(text).toMatch(/POSITION FIX/);
    expect(text).toMatch(/Move the sofa to the center/);
  });

  it("always includes ANTI-REGRESSION reminder", () => {
    const text = buildPlacementFeedback(
      { ok: true, sofaWidthPct: 60, sofaHeightPct: 40, position: "left" },
      targets,
      "m",
      3.3,
      1.4
    );
    expect(text).toMatch(/ANTI-REGRESSION REMINDER/);
    expect(text).toMatch(/3\.3 m/);
    expect(text).toMatch(/1\.4 m/);
  });

  it("omits a fix line when that dimension is within tolerance", () => {
    const text = buildPlacementFeedback(
      { ok: true, sofaWidthPct: 76, sofaHeightPct: 38, position: "center" },
      targets,
      "m",
      3.3,
      1.4
    );
    expect(text).not.toMatch(/WIDTH FIX/);
    expect(text).toMatch(/HEIGHT FIX/);
  });
});

describe("MAX_PLACEMENT_ATTEMPTS / PLACEMENT_TOLERANCE_PCT", () => {
  it("uses sensible defaults", () => {
    expect(MAX_PLACEMENT_ATTEMPTS).toBe(3);
    expect(PLACEMENT_TOLERANCE_PCT).toBe(5);
  });
});

describe("buildPlacementFormData", () => {
  it("attaches the cleaned room as image[] and the sofa as image[] when provided", () => {
    const room = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const sofa = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const form = buildPlacementFormData({
      model: OPENAI_PLACEMENT_DEFAULT_MODEL,
      promptText: "place sofa",
      cleanedRoomBytes: room,
      cleanedRoomMimeType: "image/png",
      preparedSofaBytes: sofa,
      preparedSofaMimeType: "image/png",
      size: OPENAI_PLACEMENT_DEFAULT_SIZE
    });

    expect(form.get("model")).toBe(OPENAI_PLACEMENT_DEFAULT_MODEL);
    expect(form.get("prompt")).toBe("place sofa");
    expect(form.get("size")).toBe(OPENAI_PLACEMENT_DEFAULT_SIZE);
    const images = form.getAll("image[]");
    expect(images).toHaveLength(2);
    for (const item of images) {
      expect(item).toBeInstanceOf(Blob);
    }
  });

  it("attaches only the cleaned room when no prepared sofa is supplied", () => {
    const room = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const form = buildPlacementFormData({
      model: OPENAI_PLACEMENT_DEFAULT_MODEL,
      promptText: "place sofa",
      cleanedRoomBytes: room,
      cleanedRoomMimeType: "image/png",
      preparedSofaBytes: null,
      preparedSofaMimeType: null,
      size: OPENAI_PLACEMENT_DEFAULT_SIZE
    });
    const images = form.getAll("image[]");
    expect(images).toHaveLength(1);
  });

  it("requires a non-empty cleaned room buffer", () => {
    expect(() =>
      buildPlacementFormData({
        model: OPENAI_PLACEMENT_DEFAULT_MODEL,
        promptText: "x",
        cleanedRoomBytes: new Uint8Array(0),
        cleanedRoomMimeType: "image/png",
        preparedSofaBytes: null,
        preparedSofaMimeType: null,
        size: OPENAI_PLACEMENT_DEFAULT_SIZE
      })
    ).toThrow(/cleanedRoomBytes/);
  });
});

describe("parsePlacementResponse", () => {
  it("decodes the first b64_json result into raw image bytes", () => {
    const result = parsePlacementResponse({
      data: [{ b64_json: "AQIDBA==" }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.imageBytes)).toEqual([1, 2, 3, 4]);
    }
  });

  it("returns failure when the API returned an error envelope", () => {
    const result = parsePlacementResponse({
      error: { message: "image rejected: contains text" }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/image rejected/);
    }
  });

  it("returns failure when there is no image data", () => {
    const result = parsePlacementResponse({ data: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toMatch(/no image data/i);
    }
  });

  it("returns failure when b64_json is missing", () => {
    const result = parsePlacementResponse({ data: [{}] });
    expect(result.ok).toBe(false);
  });
});
