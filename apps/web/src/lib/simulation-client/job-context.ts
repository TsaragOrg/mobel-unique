// SPEC-0015 PLAN-0041 helpers for stashing and reading the visitor's
// display context (sofa name, fabric name, visual position label, slug)
// alongside a created simulation job. The status endpoint does not
// carry sofa labels, so the wizard caches them in sessionStorage at
// job-creation time and the continuation route reads them back on
// page load. If sessionStorage is empty (visitor refreshed across a
// tab restart), the continuation route falls back to a generic
// presentation rather than crashing.

export const SIMULATION_JOB_CONTEXT_PREFIX = "mobel-unique:simulation-job-context:";

export interface SimulationJobContext {
  slug: string;
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
}

export function stashJobContext(jobId: string, context: SimulationJobContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${SIMULATION_JOB_CONTEXT_PREFIX}${jobId}`,
      JSON.stringify(context)
    );
  } catch {
    // sessionStorage unavailable (private mode, full quota) — non-fatal
  }
}

export function readJobContext(jobId: string): SimulationJobContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      `${SIMULATION_JOB_CONTEXT_PREFIX}${jobId}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SimulationJobContext>;
    if (
      typeof parsed.slug === "string" &&
      typeof parsed.sofaName === "string" &&
      typeof parsed.fabricName === "string" &&
      typeof parsed.visualPositionLabel === "string"
    ) {
      return parsed as SimulationJobContext;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearJobContext(jobId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${SIMULATION_JOB_CONTEXT_PREFIX}${jobId}`);
  } catch {
    // ignored
  }
}
