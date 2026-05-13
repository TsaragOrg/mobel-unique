import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSimulationEmailGate } from "./PublicSimulationEmailGate";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock("../../../../../lib/simulation-client/auth", () => ({
  requestSimulationVerification: vi.fn(async () => ({
    ok: true,
    verificationRequestId: "vr-1",
    expiresAt: "2026-05-03T10:00:00.000Z"
  })),
  verifySimulationCode: vi.fn(async () => ({
    ok: true,
    expiresAt: "2026-05-03T10:00:00.000Z"
  }))
}));

afterEach(cleanup);

describe("PublicSimulationEmailGate", () => {
  it("renders the EmailGateForm with the back-to-sofa link", () => {
    render(
      <PublicSimulationEmailGate
        slug="canape-rivoli"
        navigateToWizard={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: /retour au canapé/i })).toHaveAttribute(
      "href",
      "/sofas/canape-rivoli"
    );
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/vérifiez votre adresse/i);
  });

  it("calls navigateToWizard with the sofa slug after verification succeeds", async () => {
    const navigateToWizard = vi.fn();
    render(
      <PublicSimulationEmailGate
        slug="canape-rivoli"
        navigateToWizard={navigateToWizard}
      />
    );

    fireEvent.change(screen.getByTestId("simulation-email-gate-email"), {
      target: { value: "test@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: /recevoir le code/i }));

    const codeInput = await screen.findByTestId("simulation-email-gate-code");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /vérifier et continuer/i }));

    await waitFor(() =>
      expect(navigateToWizard).toHaveBeenCalledWith("canape-rivoli")
    );
  });
});
