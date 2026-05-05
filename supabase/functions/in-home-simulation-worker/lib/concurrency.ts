// SPEC-0007 Runtime And Queue concurrency helper.
//
// The queue consumer dequeues a batch of messages per invocation but
// must respect a configurable concurrency limit so AI provider rate
// limits, Edge Function memory, and database connection pools stay
// bounded. This helper runs N workers in parallel, draining items
// from a shared cursor, and preserves index alignment in the result
// array so the orchestrator can pair each result with its message.

export function parseConcurrency(
  raw: string | null | undefined,
  fallback: number
): number {
  const safeFallback = Number.isFinite(fallback) && fallback >= 1
    ? Math.floor(fallback)
    : 1;
  if (raw === null || raw === undefined || raw === "") {
    return safeFallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return safeFallback;
  }
  return parsed;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const effectiveLimit = Math.max(
    1,
    Math.min(items.length, Number.isFinite(limit) ? Math.floor(limit) : 1)
  );

  const results: R[] = new Array(items.length);
  let cursor = 0;
  let pendingError: unknown = null;

  const runners = Array.from({ length: effectiveLimit }, async () => {
    while (pendingError === null) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        if (pendingError === null) pendingError = error;
        return;
      }
    }
  });

  await Promise.all(runners);

  if (pendingError !== null) {
    throw pendingError;
  }

  return results;
}
