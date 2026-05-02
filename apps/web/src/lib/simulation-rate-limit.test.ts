import { describe, expect, it, vi } from "vitest";

import {
  checkSimulationRateLimits,
  currentSimulationRateLimitWindowStart,
  hashSimulationRateLimitSubject,
  type SimulationRateLimitStore
} from "./simulation-rate-limit";

const SALT = "rate-limit-test-salt";

function fixedNow(iso: string) {
  const date = new Date(iso);
  return () => date;
}

function createStubStore(
  responses: Array<{ count: number; allowed: boolean }>
): {
  store: SimulationRateLimitStore;
  calls: Array<Parameters<SimulationRateLimitStore["increment"]>[0]>;
} {
  const calls: Array<Parameters<SimulationRateLimitStore["increment"]>[0]> = [];
  const queue = [...responses];
  return {
    calls,
    store: {
      async increment(input) {
        calls.push(input);
        const next = queue.shift();
        if (!next) {
          throw new Error("rate-limit stub ran out of canned responses");
        }
        return next;
      }
    }
  };
}

describe("hashSimulationRateLimitSubject", () => {
  it("returns a deterministic hex digest for the same value+salt", () => {
    const a = hashSimulationRateLimitSubject("203.0.113.7", SALT);
    const b = hashSimulationRateLimitSubject("203.0.113.7", SALT);
    expect(a).toBe(b);
    expect(/^[0-9a-f]{64}$/.test(a)).toBe(true);
  });

  it("changes when the salt changes", () => {
    const a = hashSimulationRateLimitSubject("203.0.113.7", SALT);
    const b = hashSimulationRateLimitSubject("203.0.113.7", "other-salt");
    expect(a).not.toBe(b);
  });

  it("does not include the raw value", () => {
    const value = "visitor@example.com";
    const digest = hashSimulationRateLimitSubject(value, SALT);
    expect(digest).not.toContain(value);
  });
});

describe("currentSimulationRateLimitWindowStart", () => {
  it("returns the UTC midnight aligned to the given timestamp", () => {
    const result = currentSimulationRateLimitWindowStart(
      new Date("2026-05-02T10:23:45Z")
    );
    expect(result.toISOString()).toBe("2026-05-02T00:00:00.000Z");
  });

  it("is stable for any time-of-day within the same UTC day", () => {
    const morning = currentSimulationRateLimitWindowStart(
      new Date("2026-05-02T00:00:01Z")
    );
    const evening = currentSimulationRateLimitWindowStart(
      new Date("2026-05-02T23:59:59Z")
    );
    expect(morning.getTime()).toBe(evening.getTime());
  });
});

describe("checkSimulationRateLimits", () => {
  it("returns allowed when both IP and email increments are within cap", async () => {
    const { store, calls } = createStubStore([
      { count: 1, allowed: true },
      { count: 1, allowed: true }
    ]);
    const result = await checkSimulationRateLimits({
      ip: "203.0.113.7",
      email: "visitor@example.com",
      ipCap: 3,
      emailCap: 2,
      salt: SALT,
      store,
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(result.allowed).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      subjectKind: "ip",
      cap: 3,
      windowStart: new Date("2026-05-02T00:00:00Z")
    });
    expect(calls[1]).toMatchObject({
      subjectKind: "email",
      cap: 2,
      windowStart: new Date("2026-05-02T00:00:00Z")
    });
  });

  it("hashes the IP and email before sending them to the store", async () => {
    const { store, calls } = createStubStore([
      { count: 1, allowed: true },
      { count: 1, allowed: true }
    ]);
    await checkSimulationRateLimits({
      ip: "203.0.113.7",
      email: "visitor@example.com",
      ipCap: 3,
      emailCap: 2,
      salt: SALT,
      store,
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(calls[0].subjectValueHash).toBe(
      hashSimulationRateLimitSubject("203.0.113.7", SALT)
    );
    expect(calls[1].subjectValueHash).toBe(
      hashSimulationRateLimitSubject("visitor@example.com", SALT)
    );
    expect(calls[0].subjectValueHash).not.toBe("203.0.113.7");
  });

  it("short-circuits and reports IP when the IP cap is exceeded", async () => {
    const stub = createStubStore([{ count: 4, allowed: false }]);
    const result = await checkSimulationRateLimits({
      ip: "203.0.113.7",
      email: "visitor@example.com",
      ipCap: 3,
      emailCap: 2,
      salt: SALT,
      store: stub.store,
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(result).toEqual({
      allowed: false,
      tripped: "ip",
      count: 4
    });
    expect(stub.calls).toHaveLength(1);
  });

  it("reports email when only the email cap is exceeded", async () => {
    const stub = createStubStore([
      { count: 2, allowed: true },
      { count: 3, allowed: false }
    ]);
    const result = await checkSimulationRateLimits({
      ip: "203.0.113.7",
      email: "visitor@example.com",
      ipCap: 3,
      emailCap: 2,
      salt: SALT,
      store: stub.store,
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(result).toEqual({
      allowed: false,
      tripped: "email",
      count: 3
    });
    expect(stub.calls).toHaveLength(2);
  });

  it("uses the same window_start for both increments", async () => {
    const stub = createStubStore([
      { count: 1, allowed: true },
      { count: 1, allowed: true }
    ]);
    await checkSimulationRateLimits({
      ip: "203.0.113.7",
      email: "visitor@example.com",
      ipCap: 3,
      emailCap: 2,
      salt: SALT,
      store: stub.store,
      now: fixedNow("2026-05-02T23:30:00Z")
    });
    expect(stub.calls[0].windowStart.getTime()).toBe(
      stub.calls[1].windowStart.getTime()
    );
    expect(stub.calls[0].windowStart.toISOString()).toBe(
      "2026-05-02T00:00:00.000Z"
    );
  });

  it("propagates store errors", async () => {
    const failingStore: SimulationRateLimitStore = {
      increment: vi.fn().mockRejectedValue(new Error("rpc failed"))
    };
    await expect(
      checkSimulationRateLimits({
        ip: "203.0.113.7",
        email: "visitor@example.com",
        ipCap: 3,
        emailCap: 2,
        salt: SALT,
        store: failingStore
      })
    ).rejects.toThrow("rpc failed");
  });
});
