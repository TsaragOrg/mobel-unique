import { describe, expect, it, vi } from "vitest";

import {
  POLL_DEFAULT_HIDDEN_GRACE_MS,
  POLL_DEFAULT_INTERVAL_MS,
  POLL_TERMINAL_STATUSES,
  createSimulationPoller,
  type SimulationPollDeps
} from "./poll";
import type {
  SimulationJobStatus,
  SimulationStatusResponse
} from "../simulation-public-api";

interface FakeIntervalEntry {
  id: number;
  callback: () => void;
  delayMs: number;
}

interface FakeTimeoutEntry {
  id: number;
  callback: () => void;
  delayMs: number;
}

interface FakeVisibility {
  hidden: boolean;
  listeners: Array<() => void>;
  setHidden: (value: boolean) => Promise<void>;
}

interface FakeRuntime {
  intervals: FakeIntervalEntry[];
  timeouts: FakeTimeoutEntry[];
  visibility: FakeVisibility;
  tick: () => Promise<void>;
  fireTimeout: (id: number) => Promise<void>;
  deps: SimulationPollDeps;
}

function makeRuntime(): FakeRuntime {
  let nextId = 1;
  const intervals: FakeIntervalEntry[] = [];
  const timeouts: FakeTimeoutEntry[] = [];
  const visibility: FakeVisibility = {
    hidden: false,
    listeners: [],
    async setHidden(value: boolean) {
      visibility.hidden = value;
      for (const listener of [...visibility.listeners]) {
        listener();
      }
      await flushMicrotasks();
    }
  };
  const deps: SimulationPollDeps = {
    setInterval: (cb, ms) => {
      const id = nextId++;
      intervals.push({ id, callback: cb, delayMs: ms });
      return id;
    },
    clearInterval: (handle) => {
      const idx = intervals.findIndex((e) => e.id === handle);
      if (idx >= 0) intervals.splice(idx, 1);
    },
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timeouts.push({ id, callback: cb, delayMs: ms });
      return id;
    },
    clearTimeout: (handle) => {
      const idx = timeouts.findIndex((e) => e.id === handle);
      if (idx >= 0) timeouts.splice(idx, 1);
    },
    visibility: {
      isHidden: () => visibility.hidden,
      addChangeListener: (listener) => {
        visibility.listeners.push(listener);
        return () => {
          const idx = visibility.listeners.indexOf(listener);
          if (idx >= 0) visibility.listeners.splice(idx, 1);
        };
      }
    }
  };
  return {
    intervals,
    timeouts,
    visibility,
    deps,
    async tick() {
      const snapshot = [...intervals];
      for (const entry of snapshot) {
        entry.callback();
      }
      await flushMicrotasks();
    },
    async fireTimeout(id: number) {
      const idx = timeouts.findIndex((e) => e.id === id);
      if (idx >= 0) {
        const entry = timeouts.splice(idx, 1)[0];
        entry.callback();
        await flushMicrotasks();
      }
    }
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

function buildSnapshot(status: SimulationJobStatus): SimulationStatusResponse {
  return {
    simulation_job_id: "sim-1",
    status,
    room_geometry_mode: "back_wall",
    created_at: "2026-05-02T10:00:00.000Z",
    retention_deadline: "2026-05-03T10:00:00.000Z",
    generated_output_count: 0,
    regeneration_available: false
  };
}

describe("createSimulationPoller", () => {
  it("registers a 2 second interval and fetches once on start", async () => {
    const runtime = makeRuntime();
    const fetchStatus = vi.fn(async () => buildSnapshot("queued"));
    const updates: SimulationStatusResponse[] = [];

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: (snap) => updates.push(snap),
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();

    expect(runtime.intervals).toHaveLength(1);
    expect(runtime.intervals[0].delayMs).toBe(POLL_DEFAULT_INTERVAL_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
  });

  it("stops the interval as soon as a terminal status is observed", async () => {
    const runtime = makeRuntime();
    let next: SimulationJobStatus = "queued";
    const fetchStatus = vi.fn(async () => buildSnapshot(next));

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();
    expect(runtime.intervals).toHaveLength(1);

    next = "succeeded";
    await runtime.tick();

    expect(runtime.intervals).toHaveLength(0);
    expect(POLL_TERMINAL_STATUSES.has("succeeded")).toBe(true);
  });

  it("pauses polling after the document has been hidden past the grace period", async () => {
    const runtime = makeRuntime();
    const fetchStatus = vi.fn(async () => buildSnapshot("queued"));

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();

    await runtime.visibility.setHidden(true);
    expect(runtime.timeouts).toHaveLength(1);
    expect(runtime.timeouts[0].delayMs).toBe(POLL_DEFAULT_HIDDEN_GRACE_MS);

    await runtime.fireTimeout(runtime.timeouts[0].id);
    expect(runtime.intervals).toHaveLength(0);
  });

  it("resumes polling and re-fetches when the document becomes visible again", async () => {
    const runtime = makeRuntime();
    const fetchStatus = vi.fn(async () => buildSnapshot("queued"));

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();
    fetchStatus.mockClear();

    await runtime.visibility.setHidden(true);
    await runtime.fireTimeout(runtime.timeouts[0].id);
    expect(runtime.intervals).toHaveLength(0);

    await runtime.visibility.setHidden(false);

    expect(runtime.intervals).toHaveLength(1);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("does not pause polling if visibility flips back before the grace period elapses", async () => {
    const runtime = makeRuntime();
    const fetchStatus = vi.fn(async () => buildSnapshot("queued"));

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();

    await runtime.visibility.setHidden(true);
    expect(runtime.timeouts).toHaveLength(1);

    await runtime.visibility.setHidden(false);

    expect(runtime.timeouts).toHaveLength(0);
    expect(runtime.intervals).toHaveLength(1);
  });

  it("stop() clears the interval, the pause timeout, and the visibility listener", async () => {
    const runtime = makeRuntime();
    const fetchStatus = vi.fn(async () => buildSnapshot("queued"));

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: () => undefined,
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();
    await runtime.visibility.setHidden(true);

    poller.stop();
    expect(runtime.intervals).toHaveLength(0);
    expect(runtime.timeouts).toHaveLength(0);
    expect(runtime.visibility.listeners).toHaveLength(0);
  });

  it("forwards fetch errors to onError without stopping the poller", async () => {
    const runtime = makeRuntime();
    const errors: unknown[] = [];
    let throwOnNext = false;
    const fetchStatus = vi.fn(async () => {
      if (throwOnNext) {
        throwOnNext = false;
        throw new Error("network blip");
      }
      return buildSnapshot("queued");
    });

    const poller = createSimulationPoller({
      fetchStatus,
      onUpdate: () => undefined,
      onError: (err) => errors.push(err),
      deps: runtime.deps
    });
    poller.start();
    await flushMicrotasks();
    expect(errors).toHaveLength(0);

    throwOnNext = true;
    await runtime.tick();

    expect(errors).toHaveLength(1);
    expect(runtime.intervals).toHaveLength(1);
  });
});
