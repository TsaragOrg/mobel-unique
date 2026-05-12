import { describe, expect, it } from "vitest";

import { SIMULATION_LOCALE } from "./locale";

describe("SIMULATION_LOCALE screen0EmailGate", () => {
  it("keeps the email verification retention notice concise and clear", () => {
    const notice = SIMULATION_LOCALE.screen0EmailGate.emailUseNotice;

    expect(notice).toBe(
      "Votre adresse e-mail sert uniquement à envoyer ce code et à limiter les abus de simulation sur 24 heures. " +
        "Elle n'est pas conservée comme contact commercial."
    );
  });
});
