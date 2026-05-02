"use client";

import { useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import {
  requestSimulationVerification,
  verifySimulationCode,
  type RequestVerificationOutcome,
  type VerifyCodeOutcome
} from "../../lib/simulation-client/auth";

type Step = "email" | "code";

export interface EmailGateFormProps {
  onVerified: () => void;
  requestVerification?: (input: {
    email: string;
    consentEmailUse: boolean;
    consentMarketing: boolean;
  }) => Promise<RequestVerificationOutcome>;
  verifyCode?: (input: {
    verificationRequestId: string;
    code: string;
  }) => Promise<VerifyCodeOutcome>;
}

export function EmailGateForm(props: EmailGateFormProps) {
  const requestVerification = props.requestVerification ?? requestSimulationVerification;
  const verifyCode = props.verifyCode ?? verifySimulationCode;
  const copy = SIMULATION_LOCALE.screen0EmailGate;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [consentEmailUse, setConsentEmailUse] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);

  const emailValid = isValidEmail(email);
  const canSubmitEmail = emailValid && consentEmailUse && !submitting;
  const codeValid = /^\d{6}$/.test(code);
  const canSubmitCode = codeValid && verificationRequestId !== null && !submitting;

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmitEmail) return;
    setSubmitting(true);
    setServerErrorCode(null);
    const outcome = await requestVerification({
      email,
      consentEmailUse,
      consentMarketing
    });
    setSubmitting(false);
    if (outcome.ok) {
      setVerificationRequestId(outcome.verificationRequestId);
      setStep("code");
      setCode("");
      return;
    }
    setServerErrorCode(outcome.code);
  }

  async function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmitCode || !verificationRequestId) return;
    setSubmitting(true);
    setServerErrorCode(null);
    const outcome = await verifyCode({ verificationRequestId, code });
    setSubmitting(false);
    if (outcome.ok) {
      props.onVerified();
      return;
    }
    setServerErrorCode(outcome.code);
  }

  function backToEmail() {
    setStep("email");
    setVerificationRequestId(null);
    setCode("");
    setServerErrorCode(null);
  }

  if (step === "code") {
    return (
      <form className="simulation-email-gate-form" onSubmit={handleCodeSubmit}>
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.instructionCode}</p>

        <label className="simulation-email-gate-field" htmlFor="simulation-email-gate-code">
          <span>{copy.codeFieldLabel}</span>
          <input
            autoComplete="one-time-code"
            data-testid="simulation-email-gate-code"
            id="simulation-email-gate-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            pattern="\d{6}"
            type="text"
            value={code}
          />
        </label>

        {serverErrorCode ? (
          <p className="simulation-email-gate-error" role="alert">
            {mapServerErrorToCopy(serverErrorCode, copy)}
          </p>
        ) : null}

        <div className="simulation-email-gate-actions">
          <button
            className="public-primary-button"
            disabled={!canSubmitCode}
            type="submit"
          >
            {copy.submitCodeButton}
          </button>
          <button
            className="public-secondary-button"
            onClick={backToEmail}
            type="button"
          >
            {copy.backToEmailLink}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="simulation-email-gate-form" onSubmit={handleEmailSubmit}>
      <p className="public-eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p>{copy.instructionEmail}</p>

      <label className="simulation-email-gate-field" htmlFor="simulation-email-gate-email">
        <span>{copy.emailFieldLabel}</span>
        <input
          autoComplete="email"
          data-testid="simulation-email-gate-email"
          id="simulation-email-gate-email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.emailFieldPlaceholder}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="simulation-email-gate-consent">
        <input
          checked={consentEmailUse}
          data-testid="simulation-email-gate-consent-email"
          onChange={(e) => setConsentEmailUse(e.target.checked)}
          type="checkbox"
        />
        <span>{copy.consentEmailUseLabel}</span>
      </label>

      <label className="simulation-email-gate-consent">
        <input
          checked={consentMarketing}
          data-testid="simulation-email-gate-consent-marketing"
          onChange={(e) => setConsentMarketing(e.target.checked)}
          type="checkbox"
        />
        <span>{copy.consentMarketingLabel}</span>
      </label>

      {serverErrorCode ? (
        <p className="simulation-email-gate-error" role="alert">
          {mapServerErrorToCopy(serverErrorCode, copy)}
        </p>
      ) : null}

      <div className="simulation-email-gate-actions">
        <button
          className="public-primary-button"
          disabled={!canSubmitEmail}
          type="submit"
        >
          {copy.submitEmailButton}
        </button>
      </div>
    </form>
  );
}

function isValidEmail(value: string): boolean {
  if (value.length < 3 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapServerErrorToCopy(
  code: string,
  copy: typeof SIMULATION_LOCALE.screen0EmailGate
): string {
  switch (code) {
    case "RATE_LIMITED":
      return copy.errorRateLimited;
    case "AUTH_INVALID":
    case "AUTH_REQUIRED":
      return copy.errorInvalidCode;
    case "VALIDATION_FAILED":
      return copy.errorInvalidEmail;
    default:
      return copy.errorGeneric;
  }
}
