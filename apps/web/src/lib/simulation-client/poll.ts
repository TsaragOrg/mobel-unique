// SPEC-0015 PLAN-0041 polling controller and React hook for the
// public simulation wizard's continuation page. The controller is a
// plain JS object so its scheduling rules can be exhaustively unit
// tested without React; the hook is a thin wrapper that wires the
// controller into a component lifecycle.
//
// Polling cadence: every 2 seconds. Polling stops automatically when
// the wire status becomes terminal (succeeded, failed, canceled,
// expired). When the document has been hidden for longer than a
// configurable grace period, polling pauses to spare the visitor's
// battery and the worker's pgmq throughput; it resumes and re-fetches
// as soon as visibility returns.

import { useEffect, useRef, useState } from "react";

import type {
  SimulationJobStatus,
  SimulationStatusResponse
} from "../simulation-public-api";

export const POLL_DEFAULT_INTERVAL_MS = 2000;
export const POLL_DEFAULT_HIDDEN_GRACE_MS = 30_000;

export const POLL_TERMINAL_STATUSES: ReadonlySet<SimulationJobStatus> = new Set<SimulationJobStatus>([
  "succeeded",
  "failed",
  "canceled",
  "expired"
]);

export interface SimulationPollDeps {
  setInterval: (callback: () => void, delayMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  visibility: {
    isHidden: () => boolean;
    addChangeListener: (listener: () => void) => () => void;
  };
}

export interface CreateSimulationPollerArgs {
  fetchStatus: () => Promise<SimulationStatusResponse>;
  onUpdate: (snapshot: SimulationStatusResponse) => void;
  onError: (error: unknown) => void;
  intervalMs?: number;
  hiddenGraceMs?: number;
  deps: SimulationPollDeps;
}

export interface SimulationPoller {
  start: () => void;
  stop: () => void;
  refresh: () => void;
}

export function createSimulationPoller(
  args: CreateSimulationPollerArgs
): SimulationPoller {
  const intervalMs = args.intervalMs ?? POLL_DEFAULT_INTERVAL_MS;
  const hiddenGraceMs = args.hiddenGraceMs ?? POLL_DEFAULT_HIDDEN_GRACE_MS;

  let intervalHandle: unknown = null;
  let pauseTimeoutHandle: unknown = null;
  let visibilityUnsub: (() => void) | null = null;
  let started = false;
  let stopped = false;
  let inFlight = false;

  function tick() {
    if (inFlight || stopped) return;
    inFlight = true;
    args
      .fetchStatus()
      .then((snapshot) => {
        if (stopped) return;
        args.onUpdate(snapshot);
        if (POLL_TERMINAL_STATUSES.has(snapshot.status)) {
          clearActiveInterval();
        }
      })
      .catch((err) => {
        if (stopped) return;
        args.onError(err);
      })
      .finally(() => {
        inFlight = false;
      });
  }

  function startInterval() {
    if (intervalHandle !== null) return;
    intervalHandle = args.deps.setInterval(tick, intervalMs);
  }

  function clearActiveInterval() {
    if (intervalHandle !== null) {
      args.deps.clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  function clearPauseTimeout() {
    if (pauseTimeoutHandle !== null) {
      args.deps.clearTimeout(pauseTimeoutHandle);
      pauseTimeoutHandle = null;
    }
  }

  function onVisibilityChange() {
    if (stopped) return;
    if (args.deps.visibility.isHidden()) {
      if (pauseTimeoutHandle !== null) return;
      pauseTimeoutHandle = args.deps.setTimeout(() => {
        pauseTimeoutHandle = null;
        clearActiveInterval();
      }, hiddenGraceMs);
      return;
    }
    clearPauseTimeout();
    if (intervalHandle === null) {
      startInterval();
      tick();
    }
  }

  return {
    start() {
      if (started || stopped) return;
      started = true;
      visibilityUnsub = args.deps.visibility.addChangeListener(onVisibilityChange);
      startInterval();
      tick();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearActiveInterval();
      clearPauseTimeout();
      if (visibilityUnsub) {
        visibilityUnsub();
        visibilityUnsub = null;
      }
    },
    refresh() {
      if (stopped) return;
      tick();
    }
  };
}

export interface UseSimulationStatusPollOptions {
  intervalMs?: number;
  hiddenGraceMs?: number;
  fetchStatus: () => Promise<SimulationStatusResponse>;
  enabled?: boolean;
}

export interface SimulationStatusPollState {
  snapshot: SimulationStatusResponse | null;
  error: unknown;
  refresh: () => void;
}

export function useSimulationStatusPoll(
  jobId: string | null,
  options: UseSimulationStatusPollOptions
): SimulationStatusPollState {
  const [snapshot, setSnapshot] = useState<SimulationStatusResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const pollerRef = useRef<SimulationPoller | null>(null);

  useEffect(() => {
    if (!jobId || options.enabled === false) {
      return;
    }
    const poller = createSimulationPoller({
      fetchStatus: options.fetchStatus,
      onUpdate: (next) => setSnapshot(next),
      onError: (err) => setError(err),
      intervalMs: options.intervalMs,
      hiddenGraceMs: options.hiddenGraceMs,
      deps: defaultBrowserPollDeps()
    });
    pollerRef.current = poller;
    poller.start();
    return () => {
      poller.stop();
      pollerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, options.enabled]);

  return {
    snapshot,
    error,
    refresh: () => pollerRef.current?.refresh()
  };
}

function defaultBrowserPollDeps(): SimulationPollDeps {
  return {
    setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
    clearInterval: (handle) => globalThis.clearInterval(handle as number),
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
    visibility: {
      isHidden: () =>
        typeof document !== "undefined" && document.visibilityState === "hidden",
      addChangeListener: (listener) => {
        if (typeof document === "undefined") {
          return () => undefined;
        }
        document.addEventListener("visibilitychange", listener);
        return () => document.removeEventListener("visibilitychange", listener);
      }
    }
  };
}
