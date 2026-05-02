import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Screen6ErrorExpired } from "../Screen6ErrorExpired";

afterEach(cleanup);

describe("Screen6ErrorExpired (error variant)", () => {
  it("offers a Restart link that points back to the wizard entry route", () => {
    render(
      <Screen6ErrorExpired
        variant="error"
        context={{
          sofaName: "Canapé Rivoli",
          fabricName: "Bouclette",
          visualPositionLabel: "Vue de face"
        }}
        restartHref="/sofas/canape-rivoli/simulate"
        backToSofaHref="/sofas/canape-rivoli"
      />
    );

    const restart = screen.getByRole("link", { name: /recommencer la simulation/i });
    expect(restart).toHaveAttribute("href", "/sofas/canape-rivoli/simulate");
  });

  it("links Back to sofa to the public sofa detail page", () => {
    render(
      <Screen6ErrorExpired
        variant="error"
        context={{
          sofaName: "X",
          fabricName: "Y",
          visualPositionLabel: "Z"
        }}
        restartHref="/sofas/canape-rivoli/simulate"
        backToSofaHref="/sofas/canape-rivoli"
      />
    );

    expect(
      screen.getByRole("link", { name: /retour au canapé/i })
    ).toHaveAttribute("href", "/sofas/canape-rivoli");
  });

  it("does not expose provider, sql, storage path, or stack-trace details", () => {
    render(
      <Screen6ErrorExpired
        variant="error"
        context={{
          sofaName: "X",
          fabricName: "Y",
          visualPositionLabel: "Z"
        }}
        restartHref="/sofas/canape-rivoli/simulate"
        backToSofaHref="/sofas/canape-rivoli"
      />
    );

    const root = screen.getByTestId("simulation-screen-error");
    const text = root.textContent ?? "";
    expect(text).not.toMatch(/openai|gemini|gpt|supabase|pgmq/i);
    expect(text).not.toMatch(/select |from |where |insert /i);
    expect(text).not.toMatch(/simulations\/[\w-]+\/inputs/i);
  });
});

describe("Screen6ErrorExpired (expired variant)", () => {
  it("renders only Back to catalog and never offers Restart", () => {
    render(
      <Screen6ErrorExpired
        variant="expired"
        backToCatalogHref="/catalog"
      />
    );

    expect(
      screen.getByRole("link", { name: /retour au catalogue/i })
    ).toHaveAttribute("href", "/catalog");
    expect(
      screen.queryByRole("link", { name: /recommencer/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /recommencer/i })
    ).not.toBeInTheDocument();
  });

  it("does not render the context strip in the expired variant (artifacts have been purged)", () => {
    render(
      <Screen6ErrorExpired
        variant="expired"
        backToCatalogHref="/catalog"
      />
    );

    expect(
      screen.queryByLabelText("Contexte de la simulation")
    ).not.toBeInTheDocument();
  });
});
