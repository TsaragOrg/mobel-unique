import { describe, expect, it } from "vitest";
import {
  ADMIN_COPY,
  ADMIN_LOCALE,
  formatAdminErrorCodeMessage,
  formatAdminLifecycleLabel,
  formatAdminPublicationBlockerLabel,
  formatRenderCellBlockerLabel,
  formatRenderCellStatusLabel,
  formatSourceTypeLabel,
  formatUploadPreparationMessage,
} from "./admin-copy";

describe("admin copy", () => {
  it("keeps the protected admin locale fixed to French", () => {
    expect(ADMIN_LOCALE).toBe("fr-FR");
  });

  it("exposes French shell, dashboard, and login copy", () => {
    expect(ADMIN_COPY.shell.navigation).toMatchObject({
      dashboard: "Tableau de bord",
      fabrics: "Tissus",
      leads: "Leads",
      sofas: "Canapés",
      tags: "Étiquettes",
    });
    expect(ADMIN_COPY.shell.navigationAriaLabel).toBe("Administration");
    expect(ADMIN_COPY.dashboard.actions.newSofa.label).toBe(
      "Nouveau canapé",
    );
    expect(ADMIN_COPY.dashboard.actions.leads.label).toBe("Leads simulation");
    expect(ADMIN_COPY.leads.actions.search).toBe("Rechercher");
    expect(ADMIN_COPY.leads.empty.noRetainedLeads).toBe("Aucun lead conservé.");
    expect(ADMIN_COPY.login.form.submitLabel).toBe("Se connecter");
    expect(ADMIN_COPY.login.form.emailLabel).toBe("Adresse e-mail");
    expect(ADMIN_COPY.login.form.passwordLabel).toBe("Mot de passe");
  });

  it("maps admin status labels to French", () => {
    expect(formatAdminLifecycleLabel("draft")).toBe("Brouillon");
    expect(formatAdminLifecycleLabel("published")).toBe("Publié");
    expect(formatAdminLifecycleLabel("archived")).toBe("Archivé");
    expect(ADMIN_COPY.readiness.ready).toBe("Prêt");
    expect(ADMIN_COPY.readiness.missing).toBe("Manquant");
    expect(ADMIN_COPY.readiness.blocked).toBe("Bloqué");
    expect(formatRenderCellStatusLabel("processing")).toBe("En cours");
    expect(formatRenderCellStatusLabel("candidate")).toBe("Variante");
    expect(formatSourceTypeLabel("manual_upload")).toBe("Envoi manuel");
  });

  it("maps upload preparation messages to French", () => {
    expect(
      formatUploadPreparationMessage({
        kind: "fabric_swatch_crop",
      }),
    ).toBe("L'échantillon a été recadré en carré 512x512 avant l'envoi.");
    expect(
      formatUploadPreparationMessage({
        convertedWebp: true,
        height: 1200,
        kind: "render_input",
        resized: true,
        targetHeight: 1536,
        targetWidth: 2048,
        width: 4000,
      }),
    ).toBe(
      "L'image a été convertie de WebP en JPEG et réduite de 4000x1200 à 2048x1536 avant l'envoi.",
    );
  });

  it("maps blocker labels without showing stable technical codes", () => {
    expect(
      formatAdminPublicationBlockerLabel("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).toBe("Rendus publics manquants");
    expect(formatAdminPublicationBlockerLabel("MISSING_PUBLIC_FABRIC")).toBe(
      "Aucun tissu public",
    );
    expect(formatRenderCellBlockerLabel("MISSING_SOURCE_PHOTO")).toBe(
      "Photo source manquante",
    );
    expect(formatRenderCellBlockerLabel("MISSING_FABRIC_AI_REFERENCE")).toBe(
      "Image de référence tissu manquante",
    );
  });

  it("maps known admin error codes and hides unknown technical codes", () => {
    expect(formatAdminErrorCodeMessage("TAG_CONFLICT")).toBe(
      "Une étiquette utilise déjà ce libellé ou cette adresse.",
    );
    expect(formatAdminErrorCodeMessage("REFINE_PROMPT_REQUIRED")).toBe(
      "Écrivez ce qui doit être amélioré avant de lancer l'amélioration.",
    );
    expect(formatAdminErrorCodeMessage("INVALID_STORAGE_ASSET_VARIANT")).toBe(
      "Cette variante d'aperçu n'est pas disponible.",
    );
    expect(formatAdminErrorCodeMessage("SIMULATION_LEADS_UNAVAILABLE")).toBe(
      "Les leads de simulation sont indisponibles. Réessayez.",
    );
    expect(formatAdminErrorCodeMessage("SOFA_LIST_FAILED")).toBe(
      "Une erreur est survenue. Réessayez.",
    );
    expect(formatAdminErrorCodeMessage("")).toBe(
      "Une erreur est survenue. Réessayez.",
    );
  });
});
