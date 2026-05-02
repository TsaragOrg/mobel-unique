import { describe, expect, it } from "vitest";

import {
  MockCleaningProvider,
  MockCornersProvider,
  MockValidationProvider,
  isProviderModeLive,
  isProviderModeMock,
  selectStage1Providers
} from "../supabase/functions/in-home-simulation-worker/lib/providers.ts";

describe("isProviderModeMock / isProviderModeLive", () => {
  it("treats unset / empty / 'mock' as mock mode", () => {
    expect(isProviderModeMock(undefined)).toBe(true);
    expect(isProviderModeMock(null)).toBe(true);
    expect(isProviderModeMock("")).toBe(true);
    expect(isProviderModeMock("mock")).toBe(true);
  });

  it("treats 'live' as live mode", () => {
    expect(isProviderModeLive("live")).toBe(true);
    expect(isProviderModeLive("mock")).toBe(false);
  });
});

describe("selectStage1Providers (mock)", () => {
  it("returns the three mock providers (no scene classifier; mode comes from job row)", () => {
    const providers = selectStage1Providers("mock");
    expect(providers.validation).toBeInstanceOf(MockValidationProvider);
    expect(providers.cleaning).toBeInstanceOf(MockCleaningProvider);
    expect(providers.corners).toBeInstanceOf(MockCornersProvider);
    expect("sceneClassifier" in providers).toBe(false);
  });
});

describe("selectStage1Providers (live)", () => {
  it("requires OPENAI_API_KEY", () => {
    expect(() =>
      selectStage1Providers("live", () => undefined)
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("returns OpenAI providers when OPENAI_API_KEY is set (no scene classifier)", () => {
    const providers = selectStage1Providers("live", (name) =>
      name === "OPENAI_API_KEY" ? "sk-test" : undefined
    );
    expect(providers.validation.name).toBe("openai");
    expect(providers.cleaning.name).toBe("openai");
    expect(providers.corners.name).toBe("openai");
    expect("sceneClassifier" in providers).toBe(false);
  });
});

describe("selectStage1Providers (unknown mode)", () => {
  it("throws on unknown provider mode", () => {
    expect(() => selectStage1Providers("something-else")).toThrow(
      /unknown IN_HOME_SIMULATION_PROVIDER_MODE/
    );
  });
});
