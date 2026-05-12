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
}) => Promise<RequestVerificationOutcome>;

type VerifyFn = (input: {
  email: string;
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

describe("EmailGateForm — step 1 (email)", () => {
  it("disables Continue until email is valid", () => {
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
    expect(submit).not.toBeDisabled();
  });

  it("rejects an obviously invalid email", () => {
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
    expect(
      screen.getByRole("button", { name: /recevoir le code/i })
    ).toBeDisabled();
  });

  it("submits only the email and advances to the code step on success", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /recevoir le code/i }));

    await waitFor(() =>
      expect(
        screen.getByTestId("simulation-email-gate-code")
      ).toBeInTheDocument()
    );

    expect(requestVerification).toHaveBeenCalledWith({
      email: "test@example.com"
    });
    expect(
      screen.queryByTestId("simulation-email-gate-consent-marketing")
    ).not.toBeInTheDocument();
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
    const verifyCode = okVerify();
    render(
      <EmailGateForm
        onVerified={onVerified}
        requestVerification={okRequest()}
        verifyCode={verifyCode}
      />
    );
    advanceToCodeStep();
    const codeInput = await screen.findByTestId("simulation-email-gate-code");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /vérifier et continuer/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(verifyCode).toHaveBeenCalledWith({
      email: "test@example.com",
      verificationRequestId: "vr-1",
      code: "123456"
    });
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
