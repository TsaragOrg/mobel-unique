import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Screen5Result } from "../Screen5Result";

afterEach(cleanup);

const baseProps = {
  jobId: "sim-1",
  sofaName: "Canapé Rivoli",
  fabricName: "Bouclette",
  visualPositionLabel: "Vue de face",
  resultImageUrl: "https://signed.example/output-1.png",
  backToSofaHref: "/sofas/canape-rivoli",
  onResultImageError: vi.fn(),
  onRegenerationStarted: vi.fn()
};

type RegenerateFn = (
  jobId: string
) => Promise<{ ok: true } | { ok: false; message?: string }>;

describe("Screen5Result", () => {
  it("always shows the muted retention notice", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.getByText(/sera supprimée automatiquement dans 24 heures/i)
    ).toBeInTheDocument();
  });

  it("renders the regeneration button when regeneration_available is true", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.getByRole("button", { name: /nouvelle génération/i })
    ).toBeInTheDocument();
  });

  it("removes the regeneration button from the DOM (not just disabled) when unavailable", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={false}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.queryByRole("button", { name: /nouvelle génération/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /retour au canapé/i })
    ).toHaveAttribute("href", "/sofas/canape-rivoli");
  });

  it("triggers onResultImageError when the result image fails to load", () => {
    const onResultImageError = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onResultImageError={onResultImageError}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    fireEvent.error(screen.getByAltText(/votre canapé placé/i));

    expect(onResultImageError).toHaveBeenCalledTimes(1);
  });

  it("calls requestRegeneration and notifies the parent on a successful regeneration", async () => {
    const requestRegeneration = vi.fn<RegenerateFn>(async () => ({ ok: true }));
    const onRegenerationStarted = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onRegenerationStarted={onRegenerationStarted}
        regenerationAvailable={true}
        requestRegeneration={requestRegeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /nouvelle génération/i }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(requestRegeneration).toHaveBeenCalledWith("sim-1");
    expect(onRegenerationStarted).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/n'a pas abouti/i)
    ).not.toBeInTheDocument();
  });

  it("shows the inline regeneration-failed message after a failed regeneration", async () => {
    const requestRegeneration = vi.fn<RegenerateFn>(async () => ({
      ok: false,
      message: "boom"
    }));
    const onRegenerationStarted = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onRegenerationStarted={onRegenerationStarted}
        regenerationAvailable={true}
        requestRegeneration={requestRegeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /nouvelle génération/i }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.getByRole("alert")).toHaveTextContent(/n'a pas abouti/i);
    expect(onRegenerationStarted).not.toHaveBeenCalled();
  });
});
