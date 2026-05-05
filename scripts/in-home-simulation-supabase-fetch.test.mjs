import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SupabaseFetchTimeoutError,
  resolveSupabaseFetchTimeoutMs,
  supabaseFetchWithTimeout
} from "../supabase/functions/in-home-simulation-worker/lib/supabase-fetch.ts";

describe("resolveSupabaseFetchTimeoutMs", () => {
  it("returns the fallback when the env var is undefined or empty", () => {
    expect(resolveSupabaseFetchTimeoutMs(undefined)).toBe(30_000);
    expect(resolveSupabaseFetchTimeoutMs(null)).toBe(30_000);
    expect(resolveSupabaseFetchTimeoutMs("")).toBe(30_000);
  });

  it("parses a valid positive integer string", () => {
    expect(resolveSupabaseFetchTimeoutMs("5000")).toBe(5_000);
  });

  it("falls back when the env value is not a finite positive number", () => {
    expect(resolveSupabaseFetchTimeoutMs("nope")).toBe(30_000);
    expect(resolveSupabaseFetchTimeoutMs("0")).toBe(30_000);
    expect(resolveSupabaseFetchTimeoutMs("-1")).toBe(30_000);
  });

  it("uses the caller's fallback when provided", () => {
    expect(resolveSupabaseFetchTimeoutMs(undefined, 10_000)).toBe(10_000);
  });
});

describe("supabaseFetchWithTimeout", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("forwards the response when fetch resolves before the timeout", async () => {
    const expected = new Response("{}", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(expected);

    const response = await supabaseFetchWithTimeout(
      "http://example.test/rest/v1/jobs",
      { method: "GET" },
      { timeoutMs: 1_000 }
    );

    expect(response).toBe(expected);
  });

  it("aborts and throws SupabaseFetchTimeoutError after the timeout", async () => {
    let capturedSignal;
    globalThis.fetch = vi.fn().mockImplementation((_input, init) => {
      capturedSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = supabaseFetchWithTimeout(
      "http://example.test/rest/v1/timeout",
      { method: "GET" },
      { timeoutMs: 25 }
    );

    await expect(promise).rejects.toBeInstanceOf(SupabaseFetchTimeoutError);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("rejects via Promise.race even when the fetch ignores abort", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise(() => {
        // Never resolves, never rejects.
      });
    });

    const promise = supabaseFetchWithTimeout(
      "http://example.test/rest/v1/never",
      { method: "GET" },
      { timeoutMs: 30 }
    );

    await expect(promise).rejects.toBeInstanceOf(SupabaseFetchTimeoutError);
  });

  it("propagates external abort as AbortError, not a timeout", async () => {
    globalThis.fetch = vi.fn().mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const externalController = new AbortController();
    const promise = supabaseFetchWithTimeout(
      "http://example.test/rest/v1/external",
      { method: "GET" },
      { timeoutMs: 60_000, signal: externalController.signal }
    );
    externalController.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates network errors unchanged", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("network down"));

    await expect(
      supabaseFetchWithTimeout(
        "http://example.test/rest/v1/error",
        { method: "GET" },
        { timeoutMs: 1_000 }
      )
    ).rejects.toThrow(/network down/);
  });
});
