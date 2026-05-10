/*
RU: Этот файл проверяет страницу публичного каталога. Посетитель видит список диванов и общую нижнюю строку сайта. Здесь можно выбрать диван, открыть страницу политики конфиденциальности или открыть юридические сведения.
FR: Ce fichier verifie la page du catalogue public. Le visiteur voit la liste des canapes et la ligne du bas du site. Ici, il peut choisir un canape, ouvrir la page de confidentialite ou ouvrir les mentions legales.
*/

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CatalogPage, { metadata } from "./page";

describe("Catalog page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the public catalog shell", () => {
    render(<CatalogPage />);

    expect(
      screen.getByRole("heading", {
        name: "Choisissez le canapé à simuler",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MÖBEL UNIQUE" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("link", { name: "Catalogue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/panier|checkout|prix|stock/i)).not.toBeInTheDocument();
  });

  it("exposes the shared privacy policy footer link", () => {
    render(<CatalogPage />);

    expect(
      screen.getByRole("link", { name: "Politique de confidentialité" }),
    ).toHaveAttribute("href", "/politique-de-confidentialite");
  });

  it("exposes the shared legal notice footer link", () => {
    render(<CatalogPage />);

    expect(
      screen.getByRole("link", { name: "Mentions legales" }),
    ).toHaveAttribute("href", "/mentions-legales");
  });

  it("defines indexable public metadata", () => {
    expect(metadata).toMatchObject({
      description: expect.stringContaining("canapé"),
      title: "MÖBEL UNIQUE | Catalogue de canapés à simuler",
    });
    expect(JSON.stringify(metadata)).not.toContain("noindex");
    expect(JSON.stringify(metadata)).not.toContain("SUPABASE");
  });
});
