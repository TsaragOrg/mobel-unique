import { describe, expect, it, vi } from "vitest";

import {
  requestSimulationVerification,
  verifySimulationCode
} from "./auth";

type FetchFn = typeof globalThis.fetch;

function mockFetchOk(payload: unknown): FetchFn {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  ) as unknown as FetchFn;
}

function mockFetchStatus(status: number, payload: unknown): FetchFn {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  ) as unknown as FetchFn;
}

function mockFetchNetworkFailure(): FetchFn {
  return vi.fn(async () => {
    throw new TypeError("network down");
  }) as unknown as FetchFn;
}

describe("requestSimulationVerification", () => {
  it("posts the email and consent payload to the verifications endpoint", async () => {
    const fetchFn = mockFetchOk({
      verification_request_id: "vr-1",
      expires_at: "2026-05-03T10:00:00.000Z"
    });

    const result = await requestSimulationVerification(
      {
        email: "test@example.com",
        consentEmailUse: true,
        consentMarketing: false
      },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verificationRequestId).toBe("vr-1");
    expect(result.expiresAt).toBe("2026-05-03T10:00:00.000Z");

    const call = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe("/api/public/simulation/email-verifications");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "test@example.com",
      consent_email_use: true,
      consent_marketing: false
    });
  });

  it("surfaces the server error code when the verification request fails", async () => {
    const fetchFn = mockFetchStatus(429, {
      error: { code: "RATE_LIMITED", message: "too many" }
    });

    const result = await requestSimulationVerification(
      {
        email: "test@example.com",
        consentEmailUse: true,
        consentMarketing: false
      },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RATE_LIMITED");
  });

  it("returns NETWORK on a fetch rejection so the form can show a generic error", async () => {
    const fetchFn = mockFetchNetworkFailure();

    const result = await requestSimulationVerification(
      {
        email: "test@example.com",
        consentEmailUse: true,
        consentMarketing: false
      },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK");
  });
});

describe("verifySimulationCode", () => {
  it("posts the code to the verify endpoint scoped by verification id", async () => {
    const fetchFn = mockFetchOk({
      simulation_access_token: "dev-token-vr-1",
      expires_at: "2026-05-03T10:00:00.000Z"
    });

    const result = await verifySimulationCode(
      { verificationRequestId: "vr-1", code: "123456" },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expiresAt).toBe("2026-05-03T10:00:00.000Z");

    const call = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe(
      "/api/public/simulation/email-verifications/vr-1/verify"
    );
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ code: "123456" });
  });

  it("encodes the verification request id when it contains special characters", async () => {
    const fetchFn = mockFetchOk({
      simulation_access_token: "x",
      expires_at: "y"
    });

    await verifySimulationCode(
      { verificationRequestId: "vr/with spaces", code: "111111" },
      { fetch: fetchFn }
    );

    const call = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe(
      "/api/public/simulation/email-verifications/vr%2Fwith%20spaces/verify"
    );
  });

  it("surfaces AUTH_INVALID for an expired or wrong code", async () => {
    const fetchFn = mockFetchStatus(401, {
      error: { code: "AUTH_INVALID", message: "code expired" }
    });

    const result = await verifySimulationCode(
      { verificationRequestId: "vr-1", code: "000000" },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_INVALID");
  });

  it("returns NETWORK on a fetch rejection", async () => {
    const fetchFn = mockFetchNetworkFailure();

    const result = await verifySimulationCode(
      { verificationRequestId: "vr-1", code: "123456" },
      { fetch: fetchFn }
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK");
  });
});
