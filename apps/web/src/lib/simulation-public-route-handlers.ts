// SPEC-0015 PLAN-0040 public simulation route-handler logic.
//
// The Next.js route.ts files under `apps/web/src/app/api/public/`
// stay thin: they parse the request, delegate to one of these
// handler functions, and return the produced Response. All
// dependencies (token secret, environment, store, now, id
// generators) flow in through `deps` so the handlers stay
// deterministic and unit-testable.

import { randomUUID } from "node:crypto";

import {
  issueSimulationAccessToken,
  type SimulationEnvironment
} from "./simulation-access-token";
import type {
  CreateEmailVerificationResponse,
  SimulationPublicErrorBody,
  SimulationPublicErrorCode,
  VerifyEmailVerificationResponse
} from "./simulation-public-api";

export const VERIFICATION_REQUEST_TTL_SECONDS = 60 * 60;
const VERIFICATION_REQUEST_ID_PREFIX = "stub-";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SimulationPublicEmailHandlerDeps {
  accessTokenSecret: string;
  environment: SimulationEnvironment;
  now?: () => Date;
  generateVerificationRequestId?: () => string;
}

export async function handleCreateEmailVerificationRequest(input: {
  body: unknown;
  deps: SimulationPublicEmailHandlerDeps;
}): Promise<Response> {
  const parsed = parseCreateEmailVerificationBody(input.body);
  if (!parsed.ok) {
    return errorResponse("VALIDATION_FAILED", parsed.message, 400);
  }

  const now = (input.deps.now ?? defaultNow)();
  const generateId =
    input.deps.generateVerificationRequestId ??
    defaultGenerateVerificationRequestId;
  const verificationRequestId = generateId();
  const expiresAt = new Date(
    now.getTime() + VERIFICATION_REQUEST_TTL_SECONDS * 1000
  );
  const body: CreateEmailVerificationResponse = {
    verification_request_id: verificationRequestId,
    expires_at: expiresAt.toISOString()
  };
  return jsonResponse({ data: body }, 200);
}

export async function handleVerifyEmailVerificationRequest(input: {
  verificationRequestId: string;
  body: unknown;
  deps: SimulationPublicEmailHandlerDeps;
}): Promise<Response> {
  if (
    !input.verificationRequestId ||
    !input.verificationRequestId.startsWith(VERIFICATION_REQUEST_ID_PREFIX)
  ) {
    return errorResponse(
      "VALIDATION_FAILED",
      "Invalid verification request id",
      400
    );
  }

  if (!isObject(input.body) || typeof input.body.code !== "string") {
    return errorResponse("VALIDATION_FAILED", "code is required", 400);
  }

  const issued = issueSimulationAccessToken({
    verificationRequestId: input.verificationRequestId,
    secret: input.deps.accessTokenSecret,
    environment: input.deps.environment,
    now: input.deps.now
  });

  const body: VerifyEmailVerificationResponse = {
    simulation_access_token: issued.token,
    expires_at: issued.expiresAt.toISOString()
  };
  return jsonResponse({ data: body }, 200, {
    "Set-Cookie": issued.cookieHeader
  });
}

export function defaultVerificationRequestIdGenerator(): string {
  return `${VERIFICATION_REQUEST_ID_PREFIX}${randomUUID()}`;
}

function defaultGenerateVerificationRequestId(): string {
  return defaultVerificationRequestIdGenerator();
}

function defaultNow(): Date {
  return new Date();
}

function parseCreateEmailVerificationBody(
  input: unknown
):
  | { ok: true; email: string; consentMarketing: boolean | undefined }
  | { ok: false; message: string } {
  if (!isObject(input)) {
    return { ok: false, message: "Body must be a JSON object" };
  }
  const email = input.email;
  const consent = input.consent_email_use;
  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return { ok: false, message: "email must be a valid email address" };
  }
  if (consent !== true) {
    return { ok: false, message: "consent_email_use must be true" };
  }
  const consentMarketing =
    typeof input.consent_marketing === "boolean"
      ? input.consent_marketing
      : undefined;
  return { ok: true, email, consentMarketing };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  code: SimulationPublicErrorCode,
  message: string,
  status: number
): Response {
  const body: SimulationPublicErrorBody = {
    error: { code, message }
  };
  return jsonResponse(body, status);
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...headers
    },
    status
  });
}
