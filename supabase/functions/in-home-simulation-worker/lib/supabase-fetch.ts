// SPEC-0015 PLAN-0057 internal Supabase fetch helper.
//
// Wraps every internal call the worker makes against Supabase REST,
// RPC, and Storage with the same race-style timeout used for the
// OpenAI fetch helper. Without this, a stuck PATCH/RPC/storage call
// can hold the isolate against the Edge Functions 150-second
// wall-clock and prevent the catch path from recording a `failed`
// status.
//
// Default timeout 30_000 ms — Supabase REST and RPC calls are
// expected to complete in under a second; 30 seconds is a generous
// upper bound that still leaves ample wall-clock budget when several
// internal calls run in sequence (download → upload × 3 → RPC).

const DEFAULT_INTERNAL_FETCH_TIMEOUT_MS = 30_000;

export class SupabaseFetchTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;
  readonly elapsedMs: number;

  constructor(url: string, timeoutMs: number, elapsedMs: number) {
    super(
      `supabase fetch aborted after ${elapsedMs}ms (timeout ${timeoutMs}ms): ${url}`
    );
    this.name = "SupabaseFetchTimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
  }
}

export type SupabaseFetchOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export function resolveSupabaseFetchTimeoutMs(
  rawValue: string | undefined | null,
  fallbackMs: number = DEFAULT_INTERNAL_FETCH_TIMEOUT_MS
): number {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallbackMs;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.floor(parsed);
}

let cachedDefaultTimeoutMs: number | null = null;

function defaultTimeoutMs(): number {
  if (cachedDefaultTimeoutMs !== null) return cachedDefaultTimeoutMs;
  let raw: string | undefined;
  try {
    raw = (globalThis as { Deno?: { env?: { get?: (n: string) => string | undefined } } })
      .Deno?.env?.get?.("IN_HOME_SIMULATION_INTERNAL_FETCH_TIMEOUT_MS");
  } catch {
    raw = undefined;
  }
  cachedDefaultTimeoutMs = resolveSupabaseFetchTimeoutMs(raw);
  return cachedDefaultTimeoutMs;
}

export async function supabaseFetchWithTimeout(
  input: string,
  init: RequestInit,
  options: SupabaseFetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs();
  const controller = new AbortController();

  const onExternalAbort = () => {
    controller.abort();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new SupabaseFetchTimeoutError(
          input,
          timeoutMs,
          Date.now() - startedAt
        )
      );
    }, timeoutMs);
  });

  const fetchPromise = fetch(input, {
    ...init,
    signal: controller.signal
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof SupabaseFetchTimeoutError) {
      throw error;
    }
    const elapsedMs = Date.now() - startedAt;
    const externalAborted = options.signal?.aborted === true;
    if (controller.signal.aborted && !externalAborted) {
      throw new SupabaseFetchTimeoutError(input, timeoutMs, elapsedMs);
    }
    throw error;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
    fetchPromise.catch(() => {});
  }
}
