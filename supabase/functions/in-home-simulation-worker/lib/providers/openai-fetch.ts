// SPEC-0015 PLAN-0056 shared OpenAI fetch helper.
//
// Wraps a single `fetch` call with an `AbortController` whose timer
// fires before the Supabase Edge Functions 150-second wall-clock kills
// the isolate. Without this wrapper, a slow `gpt-image-2` call leaves
// the job in `room_prep_processing` (or `placement_processing`)
// forever: the isolate dies mid-fetch, no catch path runs, no
// release-claim RPC fires, no `worker_job_events` row is written.
//
// Default timeout 130_000 ms is empirically chosen — it leaves
// roughly 20 seconds inside the wall-clock for the catch path to
// record `cleaning_failed`/`placement_failed`, call the release-claim
// RPC, and emit a `worker_job_events` row.

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

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const startedAt = Date.now();
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const externalAborted = options.signal?.aborted === true;
    if (controller.signal.aborted && !externalAborted) {
      throw new OpenAIFetchTimeoutError(input, timeoutMs, elapsedMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}
