// SPEC-0007 in-home simulation provider abstraction (v003).
//
// Stage 1 pipeline (canonical, validated 2026-04-29; SPEC-0015 drop
// of the scene classifier sub-step):
//   validation → cleaning → corners (yellow dot placement) → lines
//   (pure local code, no AI). The room geometry mode comes from the
//   job row at job creation time (set by the public API based on
//   sofa tags) and is read off the claim row, not classified by an
//   AI call inside Stage 1.
//
// Stage 2 pipeline:
//   placement (back_wall or corner mode).
//
// `selectStage1Providers` reads `IN_HOME_SIMULATION_PROVIDER_MODE`
// and returns the matching providers. Default is `mock` so the local
// smoke gate runs without any real provider key per `SPEC-0008`.
// `live` wires OpenAI for everything except the lines step (which
// is pure local code and does not need a provider).

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import { OpenAIValidationProvider } from "./providers/openai-vision.ts";
import { OpenAICleaningProvider } from "./providers/openai-cleaning.ts";
import {
  OpenAICornersProvider,
  type CornersProvider,
  type CornersResult
} from "./providers/openai-corners.ts";
import { OpenAIPlacementProvider } from "./providers/openai-placement.ts";
import {
  OpenAIPlacementMeasurementProvider,
  type PlacementMeasurementProvider
} from "./providers/openai-placement-measurement.ts";
import { resolveOpenAIFetchTimeoutMs } from "./providers/openai-fetch.ts";

export type SceneMode = "back_wall" | "corner";

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
  CornersProvider,
  CornersResult
} from "./providers/openai-corners.ts";

export type PlacementInputs = {
  cleanedRoomBytes: Uint8Array;
  cleanedRoomWidth: number;
  cleanedRoomHeight: number;
  feedback?: string;
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
  corners: CornersProvider;
};

export type Stage2Providers = {
  placement: PlacementProvider;
  measurement: PlacementMeasurementProvider | null;
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

const MOCK_DOT_COLOR = Image.rgbaToColor(255, 215, 0, 255);
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
    return {
      validation: new MockValidationProvider(),
      cleaning: new MockCleaningProvider(),
      corners: new MockCornersProvider()
    };
  }
  if (isProviderModeLive(providerMode)) {
    const openaiKey = envGetter("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY for the validation, cleaning, and corners adapters"
      );
    }
    const fetchTimeoutMs = resolveOpenAIFetchTimeoutMs(
      envGetter("OPENAI_FETCH_TIMEOUT_MS")
    );
    return {
      validation: new OpenAIValidationProvider({
        apiKey: openaiKey,
        fetchTimeoutMs
      }),
      cleaning: new OpenAICleaningProvider({
        apiKey: openaiKey,
        fetchTimeoutMs
      }),
      corners: new OpenAICornersProvider({
        apiKey: openaiKey,
        fetchTimeoutMs
      })
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
    return {
      placement: new MockPlacementProvider(),
      measurement: null
    };
  }
  if (isProviderModeLive(providerMode)) {
    const openaiKey = envGetter("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY for the placement adapter"
      );
    }
    const fetchTimeoutMs = resolveOpenAIFetchTimeoutMs(
      envGetter("OPENAI_FETCH_TIMEOUT_MS")
    );
    const measurementProvider = new OpenAIPlacementMeasurementProvider({
      apiKey: openaiKey,
      fetchTimeoutMs
    });
    return {
      placement: new OpenAIPlacementProvider({
        apiKey: openaiKey,
        fetchTimeoutMs
      }),
      measurement: measurementProvider
    };
  }
  throw new Error(
    `unknown IN_HOME_SIMULATION_PROVIDER_MODE: ${providerMode}`
  );
}
