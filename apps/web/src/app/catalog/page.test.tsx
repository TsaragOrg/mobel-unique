import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CatalogPage, { metadata } from "./page";

describe("Catalog page", () => {
  it("renders the public catalog shell", () => {
    render(<CatalogPage />);

    expect(
      screen.getByRole("heading", {
        name: "Choisissez le canapé à simuler",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MÖBEL UNIQUE" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("link", { name: "Catalogue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/panier|checkout|prix|stock/i)).not.toBeInTheDocument();
  });

  it("defines indexable public metadata", () => {
    expect(metadata).toMatchObject({
      description: expect.stringContaining("canapé"),
      title: "MÖBEL UNIQUE | Catalogue de canapés à simuler",
    });
    expect(JSON.stringify(metadata)).not.toContain("noindex");
    expect(JSON.stringify(metadata)).not.toContain("SUPABASE");
  });
});
