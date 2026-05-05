import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SimulationContextStrip } from "../SimulationContextStrip";

afterEach(cleanup);

describe("SimulationContextStrip", () => {
  it("renders the sofa, fabric, and visual position labels separated by middots", () => {
    render(
      <SimulationContextStrip
        sofaName="Canapé Rivoli"
        fabricName="Bouclette écrue"
        visualPositionLabel="Vue de face"
      />
    );

    const strip = screen.getByLabelText("Contexte de la simulation");
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveTextContent(
      "Canapé Rivoli · Bouclette écrue · Vue de face"
    );
  });

  it("uses an aria-hidden separator so screen readers do not announce middots", () => {
    render(
      <SimulationContextStrip
        sofaName="A"
        fabricName="B"
        visualPositionLabel="C"
      />
    );

    const strip = screen.getByLabelText("Contexte de la simulation");
    const hidden = strip.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBe(2);
  });
});
