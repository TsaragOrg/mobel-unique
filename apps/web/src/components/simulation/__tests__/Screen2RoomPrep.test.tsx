import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Screen2RoomPrep } from "../Screen2RoomPrep";

afterEach(cleanup);

describe("Screen2RoomPrep", () => {
  it("renders the context strip and the static processing indicator", () => {
    render(
      <Screen2RoomPrep
        sofaName="Canapé Rivoli"
        fabricName="Bouclette"
        visualPositionLabel="Vue de face"
      />
    );

    expect(
      screen.getByLabelText("Contexte de la simulation")
    ).toHaveTextContent("Canapé Rivoli · Bouclette · Vue de face");
    expect(screen.getByTestId("simulation-status-spinner")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/préparation/i);
  });

  it("does not show a progress percentage or a cancel control", () => {
    render(
      <Screen2RoomPrep
        sofaName="X"
        fabricName="Y"
        visualPositionLabel="Z"
      />
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /annuler|cancel/i })
    ).not.toBeInTheDocument();
  });
});
