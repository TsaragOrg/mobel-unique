import { describe, expect, it } from "vitest";

import {
  SIMULATION_ACCESS_TOKEN_COOKIE,
  SIMULATION_ACCESS_TOKEN_TTL_SECONDS,
  deriveSimulationSessionEmailHash,
  deriveSimulationSessionTokenHash,
  issueSimulationAccessToken,
  parseSimulationAccessTokenFromCookieHeader,
  parseSimulationAccessTokenFromHeaders,
  validateSimulationAccessToken
} from "./simulation-access-token";

const SECRET = "test-secret-do-not-use-in-prod";
const VERIFICATION_REQUEST_ID = "stub-00000000-0000-4000-8000-000000000099";

function fixedNow(iso: string) {
  const date = new Date(iso);
  return () => date;
}

describe("issueSimulationAccessToken", () => {
  it("returns a token that starts with the dev-token- prefix", () => {
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(issued.token.startsWith("dev-token-")).toBe(true);
  });

  it("encodes the verification request id and issued-at into the token", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    expect(issued.token).toContain(VERIFICATION_REQUEST_ID);
    const expectedIssuedAtSeconds = Math.floor(
      now().getTime() / 1000
    ).toString();
    expect(issued.token).toContain(expectedIssuedAtSeconds);
  });

  it("is deterministic for the same inputs at the same time", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const a = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    const b = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    expect(a.token).toBe(b.token);
  });

  it("returns a cookie with HttpOnly, SameSite=Lax, Path=/, and 24-hour Max-Age", () => {
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(issued.cookieHeader).toContain(
      `${SIMULATION_ACCESS_TOKEN_COOKIE}=`
    );
    expect(issued.cookieHeader).toContain("Path=/");
    expect(issued.cookieHeader).toContain(
      `Max-Age=${SIMULATION_ACCESS_TOKEN_TTL_SECONDS}`
    );
    expect(issued.cookieHeader).toContain("HttpOnly");
    expect(issued.cookieHeader).toContain("SameSite=Lax");
  });

  it("omits Secure for local environments", () => {
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(issued.cookieHeader).not.toContain("Secure");
  });

  it("adds Secure for dev and prod environments", () => {
    const dev = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "dev",
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    const prod = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "prod",
      now: fixedNow("2026-05-02T10:00:00Z")
    });
    expect(dev.cookieHeader).toContain("Secure");
    expect(prod.cookieHeader).toContain("Secure");
  });

  it("returns the expiresAt 24 hours after issuance", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    const expectedMs =
      Math.floor(now().getTime() / 1000) * 1000 +
      SIMULATION_ACCESS_TOKEN_TTL_SECONDS * 1000;
    expect(issued.expiresAt.getTime()).toBe(expectedMs);
  });
});

describe("validateSimulationAccessToken", () => {
  it("accepts a freshly issued token", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    const result = validateSimulationAccessToken({
      token: issued.token,
      secret: SECRET,
      now
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.verificationRequestId).toBe(VERIFICATION_REQUEST_ID);
    }
  });

  it("rejects a missing token", () => {
    const result = validateSimulationAccessToken({
      token: null,
      secret: SECRET
    });
    expect(result).toEqual({ valid: false, reason: "missing" });
  });

  it("rejects a token that does not start with the prefix", () => {
    const result = validateSimulationAccessToken({
      token: "not-a-simulation-token",
      secret: SECRET
    });
    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a tampered signature", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    const tampered = issued.token.slice(0, -2) + "00";
    const result = validateSimulationAccessToken({
      token: tampered,
      secret: SECRET,
      now
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("signature_mismatch");
    }
  });

  it("rejects a token signed with a different secret", () => {
    const now = fixedNow("2026-05-02T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now
    });
    const result = validateSimulationAccessToken({
      token: issued.token,
      secret: "different-secret",
      now
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("signature_mismatch");
    }
  });

  it("rejects a token older than the TTL", () => {
    const issuedAt = fixedNow("2026-05-01T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: issuedAt
    });
    const validatedAt = fixedNow("2026-05-02T10:00:01Z");
    const result = validateSimulationAccessToken({
      token: issued.token,
      secret: SECRET,
      now: validatedAt
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("accepts a token exactly at the TTL boundary", () => {
    const issuedAt = fixedNow("2026-05-01T10:00:00Z");
    const issued = issueSimulationAccessToken({
      verificationRequestId: VERIFICATION_REQUEST_ID,
      secret: SECRET,
      environment: "local",
      now: issuedAt
    });
    const validatedAt = fixedNow("2026-05-02T10:00:00Z");
    const result = validateSimulationAccessToken({
      token: issued.token,
      secret: SECRET,
      now: validatedAt
    });
    expect(result.valid).toBe(true);
  });
});

describe("parseSimulationAccessTokenFromCookieHeader", () => {
  it("returns the token when the cookie is present", () => {
    const cookieHeader =
      `${SIMULATION_ACCESS_TOKEN_COOKIE}=dev-token-abc; other=xyz`;
    expect(parseSimulationAccessTokenFromCookieHeader(cookieHeader)).toBe(
      "dev-token-abc"
    );
  });

  it("returns null when the cookie is absent", () => {
    expect(parseSimulationAccessTokenFromCookieHeader("other=xyz")).toBe(null);
  });

  it("returns null when the cookie value is empty", () => {
    expect(
      parseSimulationAccessTokenFromCookieHeader(
        `${SIMULATION_ACCESS_TOKEN_COOKIE}=`
      )
    ).toBe(null);
  });
});

describe("parseSimulationAccessTokenFromHeaders", () => {
  it("prefers the Authorization Bearer token", () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer dev-token-from-header");
    headers.set(
      "cookie",
      `${SIMULATION_ACCESS_TOKEN_COOKIE}=dev-token-from-cookie`
    );
    expect(parseSimulationAccessTokenFromHeaders(headers)).toBe(
      "dev-token-from-header"
    );
  });

  it("falls back to the cookie when no Authorization header is present", () => {
    const headers = new Headers();
    headers.set(
      "cookie",
      `${SIMULATION_ACCESS_TOKEN_COOKIE}=dev-token-from-cookie`
    );
    expect(parseSimulationAccessTokenFromHeaders(headers)).toBe(
      "dev-token-from-cookie"
    );
  });

  it("returns null when neither source carries a token", () => {
    const headers = new Headers();
    expect(parseSimulationAccessTokenFromHeaders(headers)).toBe(null);
  });
});

describe("deriveSimulationSessionTokenHash", () => {
  it("returns a 64-char hex sha-256 digest", () => {
    const hash = deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    const a = deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID);
    const b = deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID);
    expect(a).toBe(b);
  });

  it("differs from the email hash for the same verification id", () => {
    const tokenHash = deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID);
    const emailHash = deriveSimulationSessionEmailHash(VERIFICATION_REQUEST_ID);
    expect(tokenHash).not.toBe(emailHash);
  });

  it("does not include the raw verification id", () => {
    const hash = deriveSimulationSessionTokenHash(VERIFICATION_REQUEST_ID);
    expect(hash).not.toContain(VERIFICATION_REQUEST_ID);
  });
});

describe("deriveSimulationSessionEmailHash", () => {
  it("returns a 64-char hex sha-256 digest", () => {
    const hash = deriveSimulationSessionEmailHash(VERIFICATION_REQUEST_ID);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("matches the SQL `extensions.digest('email:<id>', 'sha256')` pattern", () => {
    const a = deriveSimulationSessionEmailHash("stub-x");
    const b = deriveSimulationSessionEmailHash("stub-x");
    const c = deriveSimulationSessionEmailHash("stub-y");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
