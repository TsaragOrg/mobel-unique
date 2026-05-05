// SPEC-0007 PLAN-0012 orphan upload path helpers.
//
// `SPEC-0007 Storage` requires the cleanup process to delete orphan
// room upload objects older than one hour. An orphan is an object
// under `simulations/{job_id}/inputs/...` whose `job_id` does not have
// a row in `in_home_simulation_jobs`. These pure helpers extract the
// candidate job id from a storage path so the purge function can
// query the database for existence and decide whether to delete.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractJobIdFromUploadPath(
  path: string | null | undefined
): string | null {
  if (typeof path !== "string" || path.length === 0) return null;
  const segments = path.split("/");
  if (segments.length < 4) return null;
  if (segments[0] !== "simulations") return null;
  const candidate = segments[1];
  if (!UUID_PATTERN.test(candidate)) return null;
  if (segments[2] !== "inputs") return null;
  return candidate;
}

export function isLikelyUploadPath(
  path: string | null | undefined
): boolean {
  return extractJobIdFromUploadPath(path) !== null;
}
