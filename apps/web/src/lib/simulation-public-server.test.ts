import { afterEach, describe, expect, it, vi } from "vitest";

import { createSimulationWorkerPumpInvoker } from "./simulation-public-server";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("createSimulationWorkerPumpInvoker", () => {
  it("posts the pump payload with the invocation secret", async () => {
    const captured: Array<{
      init: RequestInit;
      url: string | URL | Request;
    }> = [];
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        captured.push({ url, init: init ?? {} });
        return new Response("{}", { status: 200 });
      },
    );

    const invoker = createSimulationWorkerPumpInvoker({
      fetchImpl,
      functionUrl:
        "http://127.0.0.1:54321/functions/v1/in-home-simulation-worker",
      invokeSecret: "local-secret",
    });

    await invoker.invokePump();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const seen = captured[0];
    if (!seen) {
      throw new Error("fetch was not captured");
    }
    expect(seen.url).toBe(
      "http://127.0.0.1:54321/functions/v1/in-home-simulation-worker",
    );
    expect(seen.init.method).toBe("POST");
    expect(seen.init.body).toBe(JSON.stringify({ mode: "pump" }));
    expect(seen.init.headers).toEqual({
      "Content-Type": "application/json",
      "x-in-home-simulation-worker-secret": "local-secret",
    });
  });

  it("uses SIMULATION_WORKER_PUMP_TIMEOUT_MS for the abort timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("SIMULATION_WORKER_PUMP_TIMEOUT_MS", "25");
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("This operation was aborted", "AbortError"),
            );
          });
        }),
    );

    const invoker = createSimulationWorkerPumpInvoker({
      fetchImpl,
      functionUrl:
        "http://127.0.0.1:54321/functions/v1/in-home-simulation-worker",
      invokeSecret: "local-secret",
    });

    const result = invoker.invokePump();
    const rejection = expect(result).rejects.toThrow(
      "This operation was aborted",
    );
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
  });
});
