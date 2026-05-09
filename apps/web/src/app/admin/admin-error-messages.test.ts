import { describe, expect, it } from "vitest";
import {
  formatAdminErrorMessage,
  formatAdminPublicationBlockerLabel,
  formatRenderCellBlockerLabel,
} from "./admin-error-messages";

describe("admin error messages", () => {
  it("turns known technical error codes into customer-facing messages", () => {
    expect(formatAdminErrorMessage("TAG_CONFLICT")).toBe(
      "Une étiquette utilise déjà ce libellé ou cette adresse.",
    );
    expect(formatAdminErrorMessage(new Error("TAG_IN_USE"))).toBe(
      "Cette étiquette est déjà utilisée par un canapé et ne peut pas être supprimée.",
    );
    expect(formatAdminErrorMessage("REFINE_PROMPT_REQUIRED")).toBe(
      "Écrivez ce qui doit être amélioré avant de lancer l'amélioration.",
    );
    expect(
      formatAdminErrorMessage("FABRIC_RENDER_SOFA_PROCESSING_CONFLICT"),
    ).toBe(
      "Une autre génération est déjà en cours. Attendez qu'elle se termine avant de relancer une cellule en file.",
    );
  });

  it("hides unknown technical codes behind a generic message", () => {
    expect(formatAdminErrorMessage("SOFA_LIST_FAILED")).toBe(
      "Une erreur est survenue. Réessayez.",
    );
  });

  it("keeps normal French sentences from the server", () => {
    expect(
      formatAdminErrorMessage(new Error("Le service catalogue est indisponible.")),
    ).toBe("Le service catalogue est indisponible.");
  });

  it("labels publication blockers without exposing their codes", () => {
    expect(formatAdminPublicationBlockerLabel("MISSING_PUBLIC_FABRIC")).toBe(
      "Aucun tissu public",
    );
    expect(
      formatAdminPublicationBlockerLabel("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).toBe("Rendus publics manquants");
  });

  it("labels render cell blockers without exposing their codes", () => {
    expect(formatRenderCellBlockerLabel("MISSING_SOURCE_PHOTO")).toBe(
      "Photo source manquante",
    );
    expect(formatRenderCellBlockerLabel("SOURCE_PHOTO_MISSING")).toBe(
      "Photo source manquante",
    );
    expect(formatRenderCellBlockerLabel("MISSING_FABRIC_AI_REFERENCE")).toBe(
      "Image de référence tissu manquante",
    );
  });
});
