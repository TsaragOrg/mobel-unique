// SPEC-0015 PLAN-0056 shared OpenAI fetch helper.
// SPEC-0015 PLAN-0057 race-style timeout for Edge Functions.
//
// Wraps a single `fetch` call with two layered defenses:
//   1. An `AbortController` whose timer fires at `timeoutMs` so Deno
//      can free the underlying socket if it honours the abort signal.
//   2. A `Promise.race` against the same timer that rejects the
//      caller's awaited promise even when the platform fetch
//      implementation does not honour abort during slow body reads
//      (Supabase Edge Functions exhibits this on long
//      `gpt-image-2` calls).
//
// Default timeout 130_000 ms is empirically chosen — it leaves
// roughly 20 seconds inside the Edge Functions 150-second wall-clock
// for the catch path to record `cleaning_failed`/`placement_failed`,
// call the release-claim RPC, and emit a `worker_job_events` row.
// Without the race fallback, a slow OpenAI response can hold the
// isolate to the wall-clock kill, after which no event is written.

const DEFAULT_OPENAI_FETCH_TIMEOUT_MS = 130_000;

export class OpenAIFetchTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;
  readonly elapsedMs: number;

  constructor(url: string, timeoutMs: number, elapsedMs: number) {
    super(
      `openai fetch aborted after ${elapsedMs}ms (timeout ${timeoutMs}ms): ${url}`
    );
    this.name = "OpenAIFetchTimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
  }
}

export type OpenAIFetchOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export function resolveOpenAIFetchTimeoutMs(
  rawValue: string | undefined | null,
  fallbackMs: number = DEFAULT_OPENAI_FETCH_TIMEOUT_MS
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

export async function openaiFetchWithTimeout(
  input: string,
  init: RequestInit,
  options: OpenAIFetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_FETCH_TIMEOUT_MS;
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
        new OpenAIFetchTimeoutError(
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
    if (error instanceof OpenAIFetchTimeoutError) {
      throw error;
    }
    const elapsedMs = Date.now() - startedAt;
    const externalAborted = options.signal?.aborted === true;
    if (controller.signal.aborted && !externalAborted) {
      throw new OpenAIFetchTimeoutError(input, timeoutMs, elapsedMs);
    }
    throw error;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
    // Best-effort: do not leave the underlying fetch dangling. We
    // explicitly do not await the dangling promise; if Deno never
    // resolves it, the isolate will reap on shutdown. Adding a
    // `.catch(() => {})` keeps the runtime from logging
    // "uncaught promise rejection" on the dangling rejection.
    fetchPromise.catch(() => {});
  }
}
