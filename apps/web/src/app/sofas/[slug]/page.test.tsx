/*
RU: Этот файл проверяет публичную страницу одного дивана. Посетитель видит выбранный диван, ссылку назад и нижнюю строку сайта. Здесь можно вернуться в каталог, открыть страницу политики конфиденциальности или открыть юридические сведения.
FR: Ce fichier verifie la page publique d'un canape. Le visiteur voit le canape choisi, le lien de retour et la ligne du bas du site. Ici, il peut revenir au catalogue, ouvrir la page de confidentialite ou ouvrir les mentions legales.
*/

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SofaDetailPage, { metadata } from "./page";

describe("Sofa detail page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the public detail shell for the requested slug", async () => {
    render(await SofaDetailPage({ params: Promise.resolve({ slug: "canape-rivoli" }) }));

    expect(screen.getByRole("link", { name: "MÖBEL UNIQUE" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("article", { name: "Chargement du canape" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("exposes the shared privacy policy footer link", async () => {
    render(await SofaDetailPage({ params: Promise.resolve({ slug: "canape-rivoli" }) }));

    expect(
      screen.getByRole("link", { name: "Politique de confidentialité" }),
    ).toHaveAttribute("href", "/politique-de-confidentialite");
  });

  it("exposes the shared legal notice footer link", async () => {
    render(await SofaDetailPage({ params: Promise.resolve({ slug: "canape-rivoli" }) }));

    expect(
      screen.getByRole("link", { name: "Mentions legales" }),
    ).toHaveAttribute("href", "/mentions-legales");
  });

  it("defines indexable public metadata", () => {
    expect(metadata).toMatchObject({
      description: expect.stringContaining("tissu"),
      title: "MÖBEL UNIQUE | Canapé à simuler",
    });
    expect(JSON.stringify(metadata)).not.toContain("noindex");
    expect(JSON.stringify(metadata)).not.toContain("SUPABASE");
  });
});
