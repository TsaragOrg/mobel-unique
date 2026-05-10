/*
RU: Этот файл проверяет общую рамку публичных страниц. Посетитель видит знак MOBEL UNIQUE, содержимое страницы и нижнюю строку сайта. Здесь можно перейти на страницу политики конфиденциальности или открыть юридические сведения.
FR: Ce fichier verifie le cadre commun des pages publiques. Le visiteur voit la marque MOBEL UNIQUE, le contenu de la page et la ligne du bas du site. Ici, il peut ouvrir la page de confidentialite ou les mentions legales.
*/

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicShell } from "./PublicShell";

describe("PublicShell", () => {
  it("renders quiet legal links without private surfaces", () => {
    render(
      <PublicShell currentPath="catalog">
        <section aria-label="Page publique">
          <h1>Page publique</h1>
        </section>
      </PublicShell>,
    );

    const privacyLink = screen.getByRole("link", {
      name: "Politique de confidentialité",
    });

    expect(privacyLink).toHaveAttribute(
      "href",
      "/politique-de-confidentialite",
    );

    expect(
      screen.getByRole("link", { name: "Mentions legales" }),
    ).toHaveAttribute("href", "/mentions-legales");

    expect(screen.getByText("Simulation privée, sélection maîtrisée."))
      .toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(
      /admin|compte|account|panier|cart|checkout|galerie|gallery|signed url|signed-url|supabase|bucket|api/i,
    );
  });
});
