// SPEC-0007 PLAN-0010 in-home simulation Stage 1 provider abstraction.
//
// The Edge Function delegates room validation, furniture cleaning, and
// room-geometry detection to providers behind these interfaces so a
// developer can run the worker locally with mocked behavior and a
// production deployment can swap in OpenAI or Gemini implementations
// without changing the orchestrator.
//
// `selectStage1Providers` reads `IN_HOME_SIMULATION_PROVIDER_MODE` and
// returns the matching trio. The default mode is `mock` so the local
// smoke gate runs without any real provider key per `SPEC-0008`. A
// `live` mode is reserved for the upcoming OpenAI/Gemini adapters and
// currently fails fast with a readable error.

import {
  type BackWallGeometry,
  type CornerGeometry,
  placeholderBackWallGeometry
} from "./geometry.ts";
import { OpenAIValidationProvider } from "./providers/openai-vision.ts";

export type ValidationOk = {
  ok: true;
  providerConfidence: number | null;
};

export type ValidationFailure = {
  ok: false;
  failureReason: string;
};

export type ValidationResult = ValidationOk | ValidationFailure;

export type GeometrySuccess =
  | (BackWallGeometry & { confidence: number | null })
  | (CornerGeometry & { confidence: number | null });

export type GeometryFailure = {
  failureReason: string;
};

export type GeometryResult = GeometrySuccess | GeometryFailure;

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

export interface GeometryProvider {
  readonly name: string;
  readonly modelId: string;
  readonly promptVersion: string;
  detectGeometry(
    imageBytes: Uint8Array,
    imageWidth: number,
    imageHeight: number
  ): Promise<GeometryResult>;
}

export type PlacementInputs = {
  cleanedRoomBytes: Uint8Array;
  cleanedRoomWidth: number;
  cleanedRoomHeight: number;
  preparedSofaBytes: Uint8Array | null;
  geometry: BackWallGeometry | CornerGeometry;
  suppliedDimensions: Record<string, number>;
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
  geometry: GeometryProvider;
};

export type Stage2Providers = {
  placement: PlacementProvider;
};

export class MockValidationProvider implements ValidationProvider {
  readonly name = "mock";
  readonly modelId = "mock-validator-v001";
  readonly promptVersion = "room_prep_v001";

  validateRoom(_imageBytes: Uint8Array): Promise<ValidationResult> {
    return Promise.resolve({ ok: true, providerConfidence: 0.99 });
  }
}

export class MockCleaningProvider implements CleaningProvider {
  readonly name = "mock";
  readonly modelId = "mock-cleaner-v001";
  readonly promptVersion = "room_prep_v001";

  cleanRoom(imageBytes: Uint8Array): Promise<Uint8Array> {
    // Mock cleaning is the identity transform. Real cleaning replaces
    // furniture with empty walls in a follow-up provider.
    return Promise.resolve(imageBytes);
  }
}

export class MockGeometryProvider implements GeometryProvider {
  readonly name = "mock";
  readonly modelId = "mock-geometry-v001";
  readonly promptVersion = "room_prep_v001";

  detectGeometry(
    _imageBytes: Uint8Array,
    imageWidth: number,
    imageHeight: number
  ): Promise<GeometryResult> {
    const geometry = placeholderBackWallGeometry(imageWidth, imageHeight);
    return Promise.resolve({ ...geometry, confidence: 0.5 });
  }
}

export class MockPlacementProvider implements PlacementProvider {
  readonly name = "mock";
  readonly modelId = "mock-placement-v001";
  readonly promptVersion = "sofa_placement_v001";

  placeSofa(_inputs: PlacementInputs): Promise<PlacementResult> {
    // Mock placement does not actually composite the sofa; it returns a
    // tagged signal so the orchestrator stamps a deterministic
    // placeholder rectangle onto the cleaned room. Real placement
    // performs the AI-driven inpainting in a follow-up provider.
    return Promise.resolve({
      ok: true,
      pngBytes: new Uint8Array(),
      width: 0,
      height: 0
    });
  }
}

export function isProviderModeMock(value: string | null | undefined): boolean {
  return value === undefined || value === null || value === "" || value === "mock";
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
      geometry: new MockGeometryProvider()
    };
  }
  if (isProviderModeLive(providerMode)) {
    const openaiKey = envGetter("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY for the validation adapter"
      );
    }
    // Live validation through OpenAI vision; cleaning and geometry
    // remain mocked until their live adapters land. The hybrid lets a
    // developer test the live validation path against real photos
    // without burning the cleaning or geometry budgets yet.
    return {
      validation: new OpenAIValidationProvider({ apiKey: openaiKey }),
      cleaning: new MockCleaningProvider(),
      geometry: new MockGeometryProvider()
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
    if (
      !envGetter("OPENAI_API_KEY") &&
      !envGetter("GEMINI_API_KEY")
    ) {
      throw new Error(
        "IN_HOME_SIMULATION_PROVIDER_MODE=live requires OPENAI_API_KEY or GEMINI_API_KEY"
      );
    }
    throw new Error(
      "live providers are not implemented yet for in-home simulation Stage 2"
    );
  }
  throw new Error(
    `unknown IN_HOME_SIMULATION_PROVIDER_MODE: ${providerMode}`
  );
}
