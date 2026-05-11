/*
RU: Этот файл проверяет публичную страницу политики конфиденциальности. Посетитель видит короткие правила о данных, симуляции и контакте. Здесь можно прочитать, какие данные нужны и как написать по вопросам конфиденциальности.
FR: Ce fichier verifie la page publique de confidentialite. Le visiteur voit des regles courtes sur les donnees, la simulation, le contact et les fiches gardees avec accord. Ici, il peut lire quelles donnees sont utiles et comment ecrire pour la confidentialite.
*/

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("Privacy policy page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the required French privacy topics for browsing and simulation", async () => {
    const { default: PrivacyPolicyPage } = await import("./page");

    render(<PrivacyPolicyPage />);

    // RU: Этот текст нужен для проверки слов, которые видит посетитель.
    // FR: Ce texte sert a verifier les mots vus par le visiteur.
    const pageText = document.body.textContent ?? "";

    expect(pageText).not.toContain("MVP");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Politique de confidentialité",
      }),
    ).toBeInTheDocument();
    expect(pageText).toContain(
      "MÖBEL UNIQUE vous aide à visualiser un canapé chez vous",
    );
    expect(pageText).toContain(
      "vos données personnelles sont utilisées seulement pour cette expérience limitée",
    );
    expect(pageText).toContain("données techniques de base");
    expect(pageText).toContain("aucune analyse active");
    expect(pageText).toContain(
      "aucun suivi persistant des interactions avec le catalogue public",
    );
    expect(pageText).toContain("aucun compte client");
    expect(pageText).toContain("vérification par e-mail");
    expect(pageText).toContain("accord obligatoire pour utiliser votre e-mail");
    expect(pageText).toContain("accord facultatif pour un contact commercial");
    expect(pageText).toContain("photo de votre pièce");
    expect(pageText).toContain("image guide générée");
    expect(pageText).toContain("résultat de simulation généré");
    expect(pageText).toContain("accès temporaire dans votre navigateur");
    expect(pageText).toContain("canapé choisi");
    expect(pageText).toContain("tissu choisi");
    expect(pageText).toContain("position visuelle choisie");
    expect(pageText).toContain("statut du travail");
    expect(pageText).toContain("horodatages");
    expect(pageText).toContain("état d'échec");
    expect(pageText).toContain("compteurs d'utilisation");
  });

  it("explains purposes, legal basis, retention, access, providers, and rights", async () => {
    const { default: PrivacyPolicyPage } = await import("./page");

    render(<PrivacyPolicyPage />);

    // RU: Этот текст нужен для проверки правил и прав посетителя.
    // FR: Ce texte sert a verifier les regles et les droits du visiteur.
    const pageText = document.body.textContent ?? "";

    expect(pageText).toContain("lancer la visualisation demandée");
    expect(pageText).toContain("afficher le résultat");
    expect(pageText).toContain("limiter les abus");
    expect(pageText).toContain("résoudre les problèmes");
    expect(pageText).toContain("seulement avec votre accord facultatif");
    expect(pageText).toContain("visualisation demandée par le visiteur");
    expect(pageText).toContain("intérêt légitime");
    expect(pageText).toContain("consentement");
    expect(pageText).toContain("supprimés au plus tard 24 heures après leur création");
    expect(pageText).toContain("photos de pièce privées");
    expect(pageText).toContain("images intermédiaires");
    expect(pageText).toContain("images guides");
    expect(pageText).toContain("résultats générés");
    expect(pageText).toContain("ne sont pas des éléments du catalogue public");
    expect(pageText).toContain("pas de galerie publique");
    expect(pageText).toContain("pas de lien de partage public");
    expect(pageText).toContain("pas de compte client");
    expect(pageText).toContain("prestataires techniques de confiance");
    expect(pageText).toContain("MÖBEL UNIQUE est le propriétaire du site");
    expect(pageText).toContain("accès");
    expect(pageText).toContain("correction");
    expect(pageText).toContain("suppression");
    expect(pageText).toContain("opposition");
    expect(pageText).toContain("limitation");
    expect(pageText).toContain("portabilité");
    expect(
      screen.getByRole("link", { name: "mobel.unique.it@gmail.com" }),
    ).toHaveAttribute("href", "mailto:mobel.unique.it@gmail.com");
  });

  it("explains retained commercial contact records and deletion", async () => {
    const { default: PrivacyPolicyPage } = await import("./page");

    render(<PrivacyPolicyPage />);

    // RU: Этот текст нужен для проверки сохраненной записи при согласии на контакт.
    // FR: Ce texte sert a verifier la fiche gardee avec accord de contact.
    const pageText = document.body.textContent ?? "";

    expect(pageText).toContain(
      "Votre accord facultatif pour un contact commercial peut créer une fiche de contact conservée.",
    );
    expect(pageText).toContain(
      "Cette fiche peut contenir votre e-mail lisible pour une personne autorisée de MÖBEL UNIQUE",
    );
    expect(pageText).toContain("canapé choisi");
    expect(pageText).toContain("tissu choisi");
    expect(pageText).toContain("position visuelle choisie");
    expect(pageText).toContain("date de simulation");
    expect(pageText).toContain("statut sans information privée");
    expect(pageText).toContain(
      "Les photos de pièce et les résultats générés restent supprimés au plus tard 24 heures après leur création.",
    );
    expect(pageText).toContain("Vous pouvez demander la suppression de cette fiche.");
    expect(pageText).toContain(
      "La suppression retire aussi l'identité e-mail gardée par le site.",
    );
  });

  it("defines safe French metadata without private values", async () => {
    const { metadata } = await import("./page");
    const serializedMetadata = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      description: expect.stringContaining("données"),
      title: expect.stringContaining("Politique de confidentialité"),
    });
    expect(serializedMetadata).not.toContain("mobel.unique.it@gmail.com");
    expect(serializedMetadata).not.toMatch(
      /supabase|service-role|signed|bucket|queue|localhost|127\.0\.0\.1|simulation_job_id|api/i,
    );
  });

  it("does not expose private implementation details or unsupported promises", async () => {
    const { default: PrivacyPolicyPage } = await import("./page");

    render(<PrivacyPolicyPage />);

    // RU: Этот текст нужен для проверки, что страница не раскрывает лишние детали.
    // FR: Ce texte sert a verifier que la page ne montre pas de details en trop.
    const pageText = document.body.textContent ?? "";

    expect(pageText).not.toMatch(
      /admin|storage\/|signed url|url signée|supabase|bucket|queue|service-role|prompt|api|panier|cart|checkout|compte utilisateur|galerie client|customer gallery|galerie publique promise/i,
    );
    expect(pageText).not.toMatch(/délégué à la protection des données|dpo/i);
  });
});
