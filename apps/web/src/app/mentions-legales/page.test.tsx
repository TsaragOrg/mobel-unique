/*
RU: Этот файл проверяет публичную страницу юридических сведений. Посетитель видит данные компании, ответственного человека, хостинг, права на материалы и ссылку о данных. Здесь можно узнать, кто отвечает за сайт, как связаться с компанией и где читать правила конфиденциальности.
FR: Ce fichier verifie la page publique des mentions legales. Le visiteur voit les donnees de la societe, la personne responsable, l'hebergement, les droits sur les contenus et le lien sur les donnees. Ici, il peut savoir qui gere le site, comment contacter la societe et ou lire les regles de confidentialite.
*/

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("Legal notice page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the required French publisher, director, and host details", async () => {
    const { default: LegalNoticePage } = await import("./page");

    render(<LegalNoticePage />);

    // RU: Этот текст собирает видимые слова страницы для простых проверок.
    // FR: Ce texte regroupe les mots visibles de la page pour des controles simples.
    const pageText = document.body.textContent ?? "";

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Mentions legales",
      }),
    ).toBeInTheDocument();
    expect(pageText).toContain("SARL MOBILIER & ART");
    expect(pageText).toContain("MOBEL UNIQUE");
    expect(pageText).toContain("SARL");
    expect(pageText).toContain(
      "8 Rue Danielle Casanova, 95100 Argenteuil, France",
    );
    expect(pageText).toContain("1000 euros");
    expect(pageText).toContain("RCS Pontoise 943 675 579");
    expect(pageText).toContain("943 675 579");
    expect(
      screen.getByRole("link", { name: "aide.mobelunique@gmail.com" }),
    ).toHaveAttribute("href", "mailto:aide.mobelunique@gmail.com");
    expect(
      screen.getByRole("link", { name: "+33 6 58 93 61 06" }),
    ).toHaveAttribute("href", "tel:+33658936106");
    expect(pageText).toContain("Abdul Dzhabrailov");
    expect(pageText).toContain("Vercel Inc.");
    expect(pageText).toContain(
      "440 N Barranca Avenue #4133, Covina, CA 91723, United States",
    );
    expect(
      screen.getByRole("link", { name: "https://vercel.com/contact" }),
    ).toHaveAttribute("href", "https://vercel.com/contact");
  });

  it("keeps the legal notice concise and links personal-data details separately", async () => {
    const { default: LegalNoticePage } = await import("./page");

    render(<LegalNoticePage />);

    // RU: Этот текст помогает проверить короткие разделы без лишних страниц.
    // FR: Ce texte aide a verifier les parties courtes sans pages en trop.
    const pageText = document.body.textContent ?? "";

    expect(pageText).toContain("Propriete intellectuelle");
    expect(pageText).toContain("textes, visuels, marques");
    expect(pageText).toContain("MOBEL UNIQUE ou sont utilises avec autorisation");
    expect(pageText).toContain("Donnees personnelles");
    expect(pageText).toContain(
      "Le traitement des donnees personnelles est explique sur une page separee.",
    );
    // RU: Эти ссылки ведут к странице о данных в тексте и в нижней строке.
    // FR: Ces liens menent vers la page des donnees dans le texte et en bas.
    const privacyLinks = screen.getAllByRole("link", {
      name: "Politique de confidentialité",
    });

    expect(
      privacyLinks.some(
        (link) =>
          link.getAttribute("href") === "/politique-de-confidentialite",
      ),
    ).toBe(true);
  });

  it("does not expose unsupported legal, Shopify, admin, or private technical surfaces", async () => {
    const { default: LegalNoticePage } = await import("./page");

    render(<LegalNoticePage />);

    // RU: Этот текст помогает найти слова, которых не должно быть на странице.
    // FR: Ce texte aide a trouver les mots qui ne doivent pas etre sur la page.
    const pageText = document.body.textContent ?? "";

    expect(pageText).not.toMatch(
      /TVA|VAT|Automattic|Shopify|CGV|CGU|mediation|abonnement|paiement|checkout|panier|cart|compte|account|admin|storage\/|signed url|url signee|supabase|bucket|queue|service-role|prompt|\bapi\b|\/api\/|simulation_job_id/i,
    );
  });

  it("defines safe French metadata without private values", async () => {
    const { metadata } = await import("./page");

    // RU: Эти данные превращают сведения вкладки в текст для проверки безопасности.
    // FR: Ces donnees changent les infos de l'onglet en texte pour verifier la securite.
    const serializedMetadata = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      description: expect.stringContaining("editeur"),
      title: expect.stringContaining("Mentions legales"),
    });
    expect(serializedMetadata).not.toContain("aide.mobelunique@gmail.com");
    expect(serializedMetadata).not.toMatch(
      /supabase|service-role|signed|bucket|queue|localhost|127\.0\.0\.1|simulation_job_id|api|admin/i,
    );
  });
});
