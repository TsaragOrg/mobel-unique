// SPEC-0015 PLAN-0050 client-side helpers for the public simulation
// email verification stub. Both helpers wrap the PLAN-0040 endpoints
// (`POST /api/public/simulation/email-verifications` and
// `POST /api/public/simulation/email-verifications/{id}/verify`) and
// surface a typed success/failure outcome so the email-gate UI can
// render the right inline error code without inspecting raw HTTP
// responses.
//
// `fetch` is injected so unit tests can drive deterministic
// outcomes; the default uses the global fetch with
// `credentials: "include"` so the verify response can set the
// HTTP-only `simulation_access_token` cookie.

import type { SimulationPublicErrorCode } from "../simulation-public-api";

const REQUEST_VERIFICATION_URL = "/api/public/simulation/email-verifications";

export type SimulationAuthErrorCode =
  | SimulationPublicErrorCode
  | "NETWORK"
  | "UNKNOWN";

export interface RequestVerificationInput {
  email: string;
  consentEmailUse: boolean;
  consentMarketing: boolean;
}

export type RequestVerificationOutcome =
  | {
      ok: true;
      verificationRequestId: string;
      expiresAt: string;
    }
  | {
      ok: false;
      code: SimulationAuthErrorCode;
      message?: string;
    };

export interface VerifyCodeInput {
  verificationRequestId: string;
  code: string;
}

export type VerifyCodeOutcome =
  | {
      ok: true;
      expiresAt: string;
    }
  | {
      ok: false;
      code: SimulationAuthErrorCode;
      message?: string;
    };

export interface SimulationAuthDeps {
  fetch?: typeof globalThis.fetch;
}

export async function requestSimulationVerification(
  input: RequestVerificationInput,
  deps: SimulationAuthDeps = {}
): Promise<RequestVerificationOutcome> {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchFn(REQUEST_VERIFICATION_URL, {
      body: JSON.stringify({
        email: input.email,
        consent_email_use: input.consentEmailUse,
        consent_marketing: input.consentMarketing
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  } catch (error) {
    return { ok: false, code: "NETWORK", message: (error as Error).message };
  }

  if (response.ok) {
    const payload = (await safeReadJson(response)) as
      | { verification_request_id?: string; expires_at?: string }
      | null;
    if (
      payload &&
      typeof payload.verification_request_id === "string" &&
      typeof payload.expires_at === "string"
    ) {
      return {
        ok: true,
        verificationRequestId: payload.verification_request_id,
        expiresAt: payload.expires_at
      };
    }
    return { ok: false, code: "INTERNAL_ERROR" };
  }

  return readErrorOutcome(response);
}

export async function verifySimulationCode(
  input: VerifyCodeInput,
  deps: SimulationAuthDeps = {}
): Promise<VerifyCodeOutcome> {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const verifyUrl = `${REQUEST_VERIFICATION_URL}/${encodeURIComponent(
    input.verificationRequestId
  )}/verify`;
  let response: Response;
  try {
    response = await fetchFn(verifyUrl, {
      body: JSON.stringify({ code: input.code }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  } catch (error) {
    return { ok: false, code: "NETWORK", message: (error as Error).message };
  }

  if (response.ok) {
    const payload = (await safeReadJson(response)) as
      | { simulation_access_token?: string; expires_at?: string }
      | null;
    if (
      payload &&
      typeof payload.simulation_access_token === "string" &&
      typeof payload.expires_at === "string"
    ) {
      return { ok: true, expiresAt: payload.expires_at };
    }
    return { ok: false, code: "INTERNAL_ERROR" };
  }

  return readErrorOutcome(response);
}

async function readErrorOutcome(
  response: Response
): Promise<{ ok: false; code: SimulationAuthErrorCode; message?: string }> {
  const payload = (await safeReadJson(response)) as
    | { error?: { code?: SimulationPublicErrorCode; message?: string } }
    | null;
  const code = payload?.error?.code ?? "UNKNOWN";
  const message = payload?.error?.message;
  return { ok: false, code, message };
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
