import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Screen4Placement } from "../Screen4Placement";

afterEach(cleanup);

const baseProps = {
  sofaName: "Canapé Rivoli",
  fabricName: "Bouclette",
  visualPositionLabel: "Vue de face"
};

describe("Screen4Placement", () => {
  it("shows the destructive full-screen indicator when no previous result exists", () => {
    render(<Screen4Placement {...baseProps} />);

    expect(
      screen.getByTestId("simulation-placement-initial")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("simulation-placement-regeneration")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/mise en place/i);
  });

  it("renders the previous result behind a translucent overlay during regeneration", () => {
    render(
      <Screen4Placement
        {...baseProps}
        previousResultImageUrl="https://signed.example/output-1.png"
      />
    );

    const canvas = screen.getByTestId("simulation-placement-regeneration");
    expect(canvas).toBeInTheDocument();
    expect(canvas.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/output-1.png"
    );
    expect(
      canvas.querySelector(".simulation-placement-regeneration-overlay")
    ).not.toBeNull();
    expect(
      screen.queryByTestId("simulation-placement-initial")
    ).not.toBeInTheDocument();
  });

  it("treats an empty previousResultImageUrl as no previous result and falls back to the initial view", () => {
    render(<Screen4Placement {...baseProps} previousResultImageUrl="" />);

    expect(
      screen.getByTestId("simulation-placement-initial")
    ).toBeInTheDocument();
  });
});
