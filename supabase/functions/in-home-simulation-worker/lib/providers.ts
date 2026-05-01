// SPEC-0007 in-home simulation provider abstraction (v002).
//
// Stage 1 pipeline (canonical, validated 2026-04-29):
//   validation → cleaning → scene classification → corners (yellow
//   dot placement) → lines (pure local code, no AI).
//
// Stage 2 pipeline:
//   placement (back_wall or corner mode).
//
// `selectStage1Providers` reads `IN_HOME_SIMULATION_PROVIDER_MODE` and
// returns the matching providers. Default is `mock` so the local smoke
// gate runs without any real provider key per `SPEC-0008`. `live`
// wires OpenAI for everything except the lines step (which is pure
// local code and does not need a provider).

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import { OpenAIValidationProvider } from "./providers/openai-vision.ts";
import { OpenAICleaningProvider } from "./providers/openai-cleaning.ts";
import {
  OpenAISceneClassifierProvider,
  type SceneClassifierProvider,
  type SceneClassifierResult,
  type SceneMode
} from "./providers/openai-scene-classifier.ts";
import {
  OpenAICornersProvider,
  type CornersProvider,
  type CornersResult
} from "./providers/openai-corners.ts";
import { OpenAIPlacementProvider } from "./providers/openai-placement.ts";
import { OpenAIPlacementMeasurementProvider } from "./providers/openai-placement-measurement.ts";
import {
  FallbackPlacementProvider,
  GeminiPlacementProvider
} from "./providers/gemini-placement.ts";

export type ValidationOk = {
  ok: true;
  providerConfidence: number | null;
};

export type ValidationFailure = {
  ok: false;
  failureReason: string;
};

export type ValidationResult = ValidationOk | ValidationFailure;

export interface ValidationProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  validateRoom(imageBytes: Uint8Array): Promise<ValidationResult>;
}

export interface CleaningProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  cleanRoom(imageBytes: Uint8Array): Promise<Uint8Array>;
}

export type {
  SceneClassifierProvider,
  SceneClassifierResult,
  SceneMode
} from "./providers/openai-scene-classifier.ts";

export type {
  CornersProvider,
  CornersResult
} from "./providers/openai-corners.ts";

export type PlacementInputs = {
  cleanedRoomBytes: Uint8Array;
  cleanedRoomWidth: number;
  cleanedRoomHeight: number;
  preparedSofaBytes: Uint8Array | null;
  mode: SceneMode;
  suppliedDimensions: Record<string, number>;
  position?: "left" | "center" | "right";
};

export type PlacementSuccess = {
  ok: true;
  pngBytes: Uint8Array;
  width: number;
  height: number;
};

export type PlacementFailure = {
  ok: false;
  failureReason: string;
};

export type PlacementResult = PlacementSuccess | PlacementFailure;

export interface PlacementProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  placeSofa(inputs: PlacementInputs): Promise<PlacementResult>;
}

export type Stage1Providers = {
  validation: ValidationProvider;
  cleaning: CleaningProvider;
  sceneClassifier: SceneClassifierProvider;
  corners: CornersProvider;
};

export type Stage2Providers = {
  placement: PlacementProvider;
};

export class MockValidationProvider implements ValidationProvider {
  readonly name = "mock";
  readonly modelId = "mock-validator-v002";
  readonly promptVersion = "room_prep_v002";

  validateRoom(_imageBytes: Uint8Array): Promise<ValidationResult> {
    return Promise.resolve({ ok: true, providerConfidence: 0.99 });
  }
}

export class MockCleaningProvider implements CleaningProvider {
  readonly name = "mock";
  readonly modelId = "mock-cleaner-v002";
  readonly promptVersion = "room_prep_v002";

  cleanRoom(imageBytes: Uint8Array): Promise<Uint8Array> {
    // Mock cleaning is the identity transform.
    return Promise.resolve(imageBytes);
  }
}

export class MockSceneClassifierProvider implements SceneClassifierProvider {
  readonly name = "mock";
  readonly modelId = "mock-scene-v002";
  readonly promptVersion = "room_prep_v002";
  private readonly mode: SceneMode;

  constructor(options: { mode?: SceneMode } = {}) {
    this.mode = options.mode ?? "back_wall";
  }

  classifyScene(_imageBytes: Uint8Array): Promise<SceneClassifierResult> {
    return Promise.resolve({
      ok: true,
      mode: this.mode,
      confidence: 1,
      reason: "mock"
    });
  }
}

const MOCK_DOT_COLOR = 0xffd700ff;
const MOCK_DOT_SIZE = 12;

export class MockCornersProvider implements CornersProvider {
  readonly name = "mock";
  readonly modelId = "mock-corners-v002";
  readonly promptVersion = "room_prep_v002";

  async placeCornerDots(
    imageBytes: Uint8Array,
    mode: SceneMode
  ): Promise<CornersResult> {
    let image: Image;
    try {
      image = (await Image.decode(imageBytes)) as Image;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        failureReason: `mock corners decode failed: ${message}`
      };
    }
    const w = image.width;
    const h = image.height;
    const inX = Math.round(w * 0.1);
    const inY = Math.round(h * 0.1);
    const placeDot = (x: number, y: number) => {
      image.drawBox(
        Math.max(0, x - MOCK_DOT_SIZE / 2),
        Math.max(0, y - MOCK_DOT_SIZE / 2),
        MOCK_DOT_SIZE,
        MOCK_DOT_SIZE,
        MOCK_DOT_COLOR
      );
    };
    if (mode === "back_wall") {
      placeDot(inX, inY);
      placeDot(w - inX, inY);
      placeDot(inX, h - inY);
      placeDot(w - inX, h - inY);
    } else {
      const cx = Math.round(w / 2);
      placeDot(inX, inY);
      placeDot(cx, inY);
      placeDot(w - inX, inY);
      placeDot(inX, h - inY);
      placeDot(cx, h - inY);
      placeDot(w - inX, h - inY);
    }
    const out = await image.encode(0);
    return { ok: true, pngBytes: out };
  }
}

export class MockPlacementProvider implements PlacementProvider {
  readonly name = "mock";
  readonly modelId = "mock-placement-v003";
  readonly promptVersion = "sofa_placement_v003";

  placeSofa(_inputs: PlacementInputs): Promise<PlacementResult> {
    // Mock placement returns empty bytes; the orchestrator stamps a
    // deterministic placeholder rectangle onto the cleaned room.
    return Promise.resolve({
      ok: true,
      pngBytes: new Uint8Array(),
      width: 0,
      height: 0
    });
  }
}

export function isProviderModeMock(value: string | null | undefined): boolean {
  return (
    value === undefined || value === null || value === "" || value === "mock"
  );
}

export function isProviderModeLive(value: string | null | undefined): boolean {
  return value === "live";
}

export function selectStage1Providers(
  providerMode: string | null | undefined,
  envGetter: (name: string) => string | undefined = () => undefined
): Stage1Providers {
  if (isProviderModeMock(providerMode)) {
    const mockMode: SceneMode =
      envGetter("IN_HOME_SIMULATION_MOCK_GEOMETRY_MODE") === "corner"
        ? "corner"
        : "back_wall";
    return {
      validation: new MockValidationProvider(),
      cleaning: new MockCleaningProvider(),
      sceneClassifier: new MockSceneClassifierProvider({ mode: mockMode }),
      corners: new MockCornersProvider()
    };
  }
  if (isProviderModeLive(providerMode)) {
    const openaiKey = envGetter("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY for the validation, cleaning, scene-classifier, and corners adapters"
      );
    }
    return {
      validation: new OpenAIValidationProvider({ apiKey: openaiKey }),
      cleaning: new OpenAICleaningProvider({ apiKey: openaiKey }),
      sceneClassifier: new OpenAISceneClassifierProvider({
        apiKey: openaiKey
      }),
      corners: new OpenAICornersProvider({ apiKey: openaiKey })
    };
  }
  throw new Error(
    `unknown IN_HOME_SIMULATION_PROVIDER_MODE: ${providerMode}`
  );
}

export function selectStage2Providers(
  providerMode: string | null | undefined,
  envGetter: (name: string) => string | undefined = () => undefined
): Stage2Providers {
  if (isProviderModeMock(providerMode)) {
    return { placement: new MockPlacementProvider() };
  }
  if (isProviderModeLive(providerMode)) {
    const openaiKey = envGetter("OPENAI_API_KEY");
    const geminiKey = envGetter("GEMINI_API_KEY");
    if (!openaiKey && !geminiKey) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY or GEMINI_API_KEY for the placement adapter"
      );
    }
    const fallbackEnabled =
      envGetter("IN_HOME_SIMULATION_FALLBACK_PROVIDER") === "gemini";
    const measurementProvider = openaiKey
      ? new OpenAIPlacementMeasurementProvider({ apiKey: openaiKey })
      : null;
    if (openaiKey && fallbackEnabled && geminiKey) {
      return {
        placement: new FallbackPlacementProvider(
          new OpenAIPlacementProvider({
            apiKey: openaiKey,
            measurementProvider
          }),
          new GeminiPlacementProvider({ apiKey: geminiKey })
        )
      };
    }
    if (openaiKey) {
      return {
        placement: new OpenAIPlacementProvider({
          apiKey: openaiKey,
          measurementProvider
        })
      };
    }
    return {
      placement: new GeminiPlacementProvider({ apiKey: geminiKey! })
    };
  }
  throw new Error(
    `unknown IN_HOME_SIMULATION_PROVIDER_MODE: ${providerMode}`
  );
}
