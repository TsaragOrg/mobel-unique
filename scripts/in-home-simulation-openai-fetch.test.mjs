import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OpenAIFetchTimeoutError,
  openaiFetchWithTimeout,
  resolveOpenAIFetchTimeoutMs
} from "../supabase/functions/in-home-simulation-worker/lib/providers/openai-fetch.ts";

describe("resolveOpenAIFetchTimeoutMs", () => {
  it("returns the fallback when the env var is undefined or empty", () => {
    expect(resolveOpenAIFetchTimeoutMs(undefined)).toBe(130_000);
    expect(resolveOpenAIFetchTimeoutMs(null)).toBe(130_000);
    expect(resolveOpenAIFetchTimeoutMs("")).toBe(130_000);
  });

  it("parses a valid positive integer string", () => {
    expect(resolveOpenAIFetchTimeoutMs("90000")).toBe(90_000);
  });

  it("falls back when the env value is not a finite positive number", () => {
    expect(resolveOpenAIFetchTimeoutMs("abc")).toBe(130_000);
    expect(resolveOpenAIFetchTimeoutMs("0")).toBe(130_000);
    expect(resolveOpenAIFetchTimeoutMs("-5")).toBe(130_000);
  });

  it("uses the caller's fallback when provided", () => {
    expect(resolveOpenAIFetchTimeoutMs(undefined, 60_000)).toBe(60_000);
  });
});

describe("openaiFetchWithTimeout", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("forwards the response when fetch resolves before the timeout", async () => {
    const expected = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(expected);

    const response = await openaiFetchWithTimeout(
      "https://api.openai.com/v1/test",
      { method: "POST" },
      { timeoutMs: 1_000 }
    );

    expect(response).toBe(expected);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts the fetch and throws OpenAIFetchTimeoutError after the timeout", async () => {
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

    const promise = openaiFetchWithTimeout(
      "https://api.openai.com/v1/timeout",
      { method: "POST" },
      { timeoutMs: 25 }
    );

    await expect(promise).rejects.toBeInstanceOf(OpenAIFetchTimeoutError);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("propagates an external abort signal as the caller's AbortError, not a timeout", async () => {
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
    const promise = openaiFetchWithTimeout(
      "https://api.openai.com/v1/external",
      { method: "POST" },
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
      openaiFetchWithTimeout(
        "https://api.openai.com/v1/network-error",
        { method: "POST" },
        { timeoutMs: 1_000 }
      )
    ).rejects.toThrow(/network down/);
  });

  it("rejects via Promise.race even when the underlying fetch ignores abort", async () => {
    // Edge Functions on Supabase sometimes do not honour
    // `AbortController.abort()` during a slow body read. The race
    // timer must still reject the awaited promise so the worker
    // catch path can run.
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise(() => {
        // Never resolve, never reject. Models a fetch that ignores
        // abort.
      });
    });

    const promise = openaiFetchWithTimeout(
      "https://api.openai.com/v1/race-timeout",
      { method: "POST" },
      { timeoutMs: 30 }
    );

    await expect(promise).rejects.toBeInstanceOf(OpenAIFetchTimeoutError);
  });
});
