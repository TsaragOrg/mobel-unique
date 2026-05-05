import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailGateForm } from "../EmailGateForm";
import type {
  RequestVerificationOutcome,
  VerifyCodeOutcome
} from "../../../lib/simulation-client/auth";

afterEach(cleanup);

type RequestFn = (input: {
  email: string;
  consentEmailUse: boolean;
  consentMarketing: boolean;
}) => Promise<RequestVerificationOutcome>;

type VerifyFn = (input: {
  verificationRequestId: string;
  code: string;
}) => Promise<VerifyCodeOutcome>;

const okRequest = (): RequestFn =>
  vi.fn<RequestFn>(async () => ({
    ok: true,
    verificationRequestId: "vr-1",
    expiresAt: "2026-05-03T10:00:00.000Z"
  }));

const okVerify = (): VerifyFn =>
  vi.fn<VerifyFn>(async () => ({ ok: true, expiresAt: "x" }));

describe("EmailGateForm — step 1 (email + consent)", () => {
  it("disables Continue until email is valid AND consent_email_use is checked", () => {
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );

    const submit = screen.getByRole("button", { name: /recevoir le code/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "test@example.com" }
    });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-email"));
    expect(submit).not.toBeDisabled();
  });

  it("rejects an obviously invalid email even when consent is checked", () => {
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "not-an-email" }
    });
    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-email"));
    expect(
      screen.getByRole("button", { name: /recevoir le code/i })
    ).toBeDisabled();
  });

  it("submits the email + consent payload and advances to the code step on success", async () => {
    const requestVerification = okRequest();
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={requestVerification}
        verifyCode={okVerify()}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "test@example.com" }
    });
    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-email"));
    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-marketing"));
    fireEvent.click(screen.getByRole("button", { name: /recevoir le code/i }));

    await waitFor(() =>
      expect(
        screen.getByTestId("simulation-email-gate-code")
      ).toBeInTheDocument()
    );

    expect(requestVerification).toHaveBeenCalledWith({
      email: "test@example.com",
      consentEmailUse: true,
      consentMarketing: true
    });
  });

  it("surfaces RATE_LIMITED inline as the rate-limited French copy", async () => {
    const requestVerification = vi.fn<RequestFn>(async () => ({
      ok: false,
      code: "RATE_LIMITED"
    }));
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={requestVerification}
        verifyCode={okVerify()}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "test@example.com" }
    });
    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-email"));
    fireEvent.click(screen.getByRole("button", { name: /recevoir le code/i }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/trop de tentatives/i);
  });
});

describe("EmailGateForm — step 2 (code)", () => {
  function advanceToCodeStep() {
    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "test@example.com" }
    });
    fireEvent.click(screen.getByTestId("simulation-email-gate-consent-email"));
    fireEvent.click(screen.getByRole("button", { name: /recevoir le code/i }));
  }

  it("disables Verify until the code field has 6 digits", async () => {
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );
    advanceToCodeStep();
    const codeInput = await screen.findByTestId("simulation-email-gate-code");

    const submit = screen.getByRole("button", { name: /vérifier et continuer/i });
    expect(submit).toBeDisabled();

    fireEvent.change(codeInput, { target: { value: "123" } });
    expect(submit).toBeDisabled();

    fireEvent.change(codeInput, { target: { value: "123456" } });
    expect(submit).not.toBeDisabled();
  });

  it("strips non-numeric characters from the code field", async () => {
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );
    advanceToCodeStep();
    const codeInput = (await screen.findByTestId(
      "simulation-email-gate-code"
    )) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: "12a3-4b5x6" } });
    expect(codeInput.value).toBe("123456");
  });

  it("calls onVerified after a successful verify", async () => {
    const onVerified = vi.fn();
    render(
      <EmailGateForm
        onVerified={onVerified}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );
    advanceToCodeStep();
    const codeInput = await screen.findByTestId("simulation-email-gate-code");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /vérifier et continuer/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it("surfaces AUTH_INVALID inline as the invalid-code French copy", async () => {
    const verifyCode = vi.fn<VerifyFn>(async () => ({
      ok: false,
      code: "AUTH_INVALID"
    }));
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={verifyCode}
      />
    );
    advanceToCodeStep();
    const codeInput = await screen.findByTestId("simulation-email-gate-code");
    fireEvent.change(codeInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /vérifier et continuer/i }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/n'est pas valide ou a expiré/i);
  });

  it("can return to the email step via the back link", async () => {
    render(
      <EmailGateForm
        onVerified={vi.fn()}
        requestVerification={okRequest()}
        verifyCode={okVerify()}
      />
    );
    advanceToCodeStep();
    await screen.findByTestId("simulation-email-gate-code");

    fireEvent.click(screen.getByRole("button", { name: /modifier l'adresse/i }));
    expect(screen.getByTestId("simulation-email-gate-email")).toBeInTheDocument();
    expect(
      screen.queryByTestId("simulation-email-gate-code")
    ).not.toBeInTheDocument();
  });
});
