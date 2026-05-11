import { describe, expect, it } from "vitest";

import { SIMULATION_LOCALE } from "./locale";

describe("SIMULATION_LOCALE screen0EmailGate", () => {
  it("keeps the required consent copy concise and clear", () => {
    const requiredConsent =
      SIMULATION_LOCALE.screen0EmailGate.consentEmailUseLabel;

    expect(requiredConsent).toBe(
      "J'accepte que MÖBEL UNIQUE utilise mon adresse e-mail pour démarrer ma simulation et m'envoyer le code de vérification. " +
        "Je comprends que ma photo de pièce et les images générées restent privées et sont supprimées automatiquement sous 24 heures."
    );
  });
});
