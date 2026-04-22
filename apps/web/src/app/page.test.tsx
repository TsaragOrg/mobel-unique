import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the monorepo foundation shell", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "Monorepo foundation is ready."
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Mobel Unique")).toBeInTheDocument();
  });
});
