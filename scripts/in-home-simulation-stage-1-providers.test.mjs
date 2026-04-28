import { describe, expect, it } from "vitest";

import {
  MockCleaningProvider,
  MockGeometryProvider,
  MockValidationProvider,
  isProviderModeLive,
  isProviderModeMock,
  selectStage1Providers
} from "../supabase/functions/in-home-simulation-worker/lib/providers.ts";

describe("isProviderModeMock and isProviderModeLive", () => {
  it("treat empty, null, undefined, and 'mock' as mock", () => {
    expect(isProviderModeMock(undefined)).toBe(true);
    expect(isProviderModeMock(null)).toBe(true);
    expect(isProviderModeMock("")).toBe(true);
    expect(isProviderModeMock("mock")).toBe(true);
    expect(isProviderModeMock("live")).toBe(false);
  });

  it("treats only 'live' as live", () => {
    expect(isProviderModeLive("live")).toBe(true);
    expect(isProviderModeLive("mock")).toBe(false);
    expect(isProviderModeLive("")).toBe(false);
  });
});

describe("MockValidationProvider", () => {
  it("always reports the room as usable", async () => {
    const provider = new MockValidationProvider();
    const result = await provider.validateRoom(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(true);
    expect(provider.name).toBe("mock");
    expect(provider.promptVersion).toBe("room_prep_v001");
  });
});

describe("MockCleaningProvider", () => {
  it("returns the input bytes unchanged", async () => {
    const provider = new MockCleaningProvider();
    const input = new Uint8Array([5, 10, 15]);
    const output = await provider.cleanRoom(input);
    expect(output).toBe(input);
    expect(provider.promptVersion).toBe("room_prep_v001");
  });
});

describe("MockGeometryProvider", () => {
  it("returns deterministic back_wall geometry derived from image dimensions", async () => {
    const provider = new MockGeometryProvider();
    const result = await provider.detectGeometry(
      new Uint8Array(),
      1000,
      800
    );
    expect("points" in result).toBe(true);
    if ("points" in result) {
      expect(result.mode).toBe("back_wall");
      expect(Array.isArray(result.points)).toBe(true);
      expect(result.points).toHaveLength(4);
    }
  });
});

describe("selectStage1Providers", () => {
  it("returns the mock trio for the default mode", () => {
    const providers = selectStage1Providers(undefined);
    expect(providers.validation).toBeInstanceOf(MockValidationProvider);
    expect(providers.cleaning).toBeInstanceOf(MockCleaningProvider);
    expect(providers.geometry).toBeInstanceOf(MockGeometryProvider);
  });

  it("returns the mock trio for the explicit 'mock' mode", () => {
    const providers = selectStage1Providers("mock");
    expect(providers.validation).toBeInstanceOf(MockValidationProvider);
  });

  it("refuses 'live' mode without OPENAI_API_KEY", () => {
    expect(() => selectStage1Providers("live", () => undefined)).toThrow(
      /OPENAI_API_KEY/
    );
  });

  it("returns the hybrid live trio when OPENAI_API_KEY is present", () => {
    const providers = selectStage1Providers("live", (name) =>
      name === "OPENAI_API_KEY" ? "sk-test" : undefined
    );
    expect(providers.validation.name).toBe("openai");
    // Cleaning and geometry remain mocked until their live adapters land.
    expect(providers.cleaning.name).toBe("mock");
    expect(providers.geometry.name).toBe("mock");
  });

  it("refuses unknown modes", () => {
    expect(() => selectStage1Providers("imaginary")).toThrow(
      /unknown IN_HOME_SIMULATION_PROVIDER_MODE/
    );
  });
});
