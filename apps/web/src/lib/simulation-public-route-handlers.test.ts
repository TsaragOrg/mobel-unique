import { describe, expect, it } from "vitest";

import { SIMULATION_ACCESS_TOKEN_COOKIE } from "./simulation-access-token";
import {
  VERIFICATION_REQUEST_TTL_SECONDS,
  handleCreateEmailVerificationRequest,
  handleVerifyEmailVerificationRequest
} from "./simulation-public-route-handlers";

const SECRET = "test-secret";

function fixedNow(iso: string) {
  const date = new Date(iso);
  return () => date;
}

describe("handleCreateEmailVerificationRequest", () => {
  it("returns 200 with the generated verification_request_id", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-deterministic-id"
      }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { verification_request_id: string; expires_at: string };
    };
    expect(body.data.verification_request_id).toBe("stub-deterministic-id");
  });

  it("returns expires_at one hour after now", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-x"
      }
    });
    const body = (await response.json()) as {
      data: { expires_at: string };
    };
    const expectedMs =
      new Date("2026-05-02T10:00:00Z").getTime() +
      VERIFICATION_REQUEST_TTL_SECONDS * 1000;
    expect(new Date(body.data.expires_at).getTime()).toBe(expectedMs);
  });

  it("does not set a Set-Cookie header on create", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: true },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z"),
        generateVerificationRequestId: () => "stub-x"
      }
    });
    expect(response.headers.get("set-cookie")).toBe(null);
  });

  it("rejects a missing email", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { consent_email_use: true },
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an invalid email format", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "not-an-email", consent_email_use: true },
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("rejects consent_email_use=false", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: { email: "visitor@example.com", consent_email_use: false },
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.message).toContain("consent_email_use");
  });

  it("rejects a non-object body", async () => {
    const response = await handleCreateEmailVerificationRequest({
      body: null,
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });
});

describe("handleVerifyEmailVerificationRequest", () => {
  it("returns 200 with a valid simulation_access_token", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { simulation_access_token: string; expires_at: string };
    };
    expect(body.data.simulation_access_token.startsWith("dev-token-")).toBe(
      true
    );
  });

  it("sets the simulation_access_token cookie", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).not.toBe(null);
    expect(cookie).toContain(`${SIMULATION_ACCESS_TOKEN_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("adds Secure to the cookie when environment is dev", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-deterministic-id",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "dev",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("Secure");
  });

  it("rejects a verification_request_id without the stub- prefix", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "real-12345",
      body: { code: "123456" },
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a body without a code field", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: {},
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("rejects a non-object body", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: "not-json-object",
      deps: { accessTokenSecret: SECRET, environment: "local" }
    });
    expect(response.status).toBe(400);
  });

  it("returns expires_at 24 hours after issuance", async () => {
    const response = await handleVerifyEmailVerificationRequest({
      verificationRequestId: "stub-x",
      body: { code: "" },
      deps: {
        accessTokenSecret: SECRET,
        environment: "local",
        now: fixedNow("2026-05-02T10:00:00Z")
      }
    });
    const body = (await response.json()) as {
      data: { expires_at: string };
    };
    const expectedMs =
      Math.floor(new Date("2026-05-02T10:00:00Z").getTime() / 1000) * 1000 +
      24 * 60 * 60 * 1000;
    expect(new Date(body.data.expires_at).getTime()).toBe(expectedMs);
  });
});
