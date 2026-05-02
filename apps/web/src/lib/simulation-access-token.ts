// SPEC-0015 PLAN-0040 simulation access-token helper.
//
// The launch-window stub issues a stateless HMAC-signed access token
// that carries the verification_request_id plus the issued-at
// timestamp. Validation re-derives the HMAC and rejects tokens older
// than 24 hours. No database row is involved per SPEC-0015 stub
// scope; the catalog owner replaces the implementation later when
// real email verification ships.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIMULATION_ACCESS_TOKEN_COOKIE = "simulation_access_token";
export const SIMULATION_ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const TOKEN_PREFIX = "dev-token-";
const TOKEN_VERSION = "v1";

export type SimulationEnvironment = "local" | "dev" | "prod";

export interface SimulationAccessTokenIssue {
  token: string;
  cookieHeader: string;
  expiresAt: Date;
}

export interface SimulationAccessTokenValid {
  valid: true;
  verificationRequestId: string;
  issuedAt: Date;
}

export interface SimulationAccessTokenInvalid {
  valid: false;
  reason:
    | "missing"
    | "malformed"
    | "signature_mismatch"
    | "expired";
}

export type SimulationAccessTokenValidationResult =
  | SimulationAccessTokenValid
  | SimulationAccessTokenInvalid;

interface IssueOptions {
  verificationRequestId: string;
  secret: string;
  environment: SimulationEnvironment;
  now?: () => Date;
}

interface ValidateOptions {
  token: string | null | undefined;
  secret: string;
  now?: () => Date;
  ttlSeconds?: number;
}

export function issueSimulationAccessToken(
  options: IssueOptions
): SimulationAccessTokenIssue {
  const now = (options.now ?? defaultNow)();
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const payload = `${TOKEN_VERSION}.${options.verificationRequestId}.${issuedAtSeconds}`;
  const signature = signPayload(payload, options.secret);
  const token = `${TOKEN_PREFIX}${payload}.${signature}`;
  const expiresAt = new Date(
    (issuedAtSeconds + SIMULATION_ACCESS_TOKEN_TTL_SECONDS) * 1000
  );
  const cookieHeader = serializeCookie(token, options.environment);
  return { token, cookieHeader, expiresAt };
}

export function validateSimulationAccessToken(
  options: ValidateOptions
): SimulationAccessTokenValidationResult {
  if (!options.token) {
    return { valid: false, reason: "missing" };
  }
  if (!options.token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, reason: "malformed" };
  }
  const body = options.token.slice(TOKEN_PREFIX.length);
  const segments = body.split(".");
  if (segments.length !== 4) {
    return { valid: false, reason: "malformed" };
  }
  const [version, verificationRequestId, issuedAtRaw, providedSignature] =
    segments;
  if (version !== TOKEN_VERSION || !verificationRequestId || !issuedAtRaw) {
    return { valid: false, reason: "malformed" };
  }
  const issuedAtSeconds = Number(issuedAtRaw);
  if (!Number.isInteger(issuedAtSeconds) || issuedAtSeconds <= 0) {
    return { valid: false, reason: "malformed" };
  }
  const expectedSignature = signPayload(
    `${version}.${verificationRequestId}.${issuedAtSeconds}`,
    options.secret
  );
  if (!constantTimeEqualHex(providedSignature, expectedSignature)) {
    return { valid: false, reason: "signature_mismatch" };
  }
  const ttl = options.ttlSeconds ?? SIMULATION_ACCESS_TOKEN_TTL_SECONDS;
  const now = (options.now ?? defaultNow)();
  const ageSeconds = Math.floor(now.getTime() / 1000) - issuedAtSeconds;
  if (ageSeconds > ttl) {
    return { valid: false, reason: "expired" };
  }
  return {
    valid: true,
    verificationRequestId,
    issuedAt: new Date(issuedAtSeconds * 1000)
  };
}

export function parseSimulationAccessTokenFromHeaders(
  headers: Headers
): string | null {
  const authorization = headers.get("authorization") ?? headers.get("Authorization");
  if (authorization) {
    const parts = authorization.trim().split(/\s+/);
    if (
      parts.length === 2 &&
      parts[0]?.toLowerCase() === "bearer" &&
      parts[1]
    ) {
      return parts[1];
    }
  }
  const cookieHeader = headers.get("cookie") ?? headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }
  return parseSimulationAccessTokenFromCookieHeader(cookieHeader);
}

export function parseSimulationAccessTokenFromCookieHeader(
  cookieHeader: string
): string | null {
  const parts = cookieHeader.split(";");
  for (const raw of parts) {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== SIMULATION_ACCESS_TOKEN_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    if (!value) return null;
    return value;
  }
  return null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function serializeCookie(
  token: string,
  environment: SimulationEnvironment
): string {
  const attrs = [
    `${SIMULATION_ACCESS_TOKEN_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${SIMULATION_ACCESS_TOKEN_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (environment !== "local") {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

function defaultNow(): Date {
  return new Date();
}
