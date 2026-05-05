import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SofaDetailPage, { metadata } from "./page";

describe("Sofa detail page", () => {
  it("renders the public detail shell for the requested slug", async () => {
    render(await SofaDetailPage({ params: Promise.resolve({ slug: "canape-rivoli" }) }));

    expect(screen.getByRole("link", { name: "MÖBEL UNIQUE" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Retour au catalogue" })).toHaveAttribute(
      "href",
      "/catalog",
    );
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("defines indexable public metadata", () => {
    expect(metadata).toMatchObject({
      description: expect.stringContaining("tissu"),
      title: "MÖBEL UNIQUE | Canapé à simuler",
    });
    expect(JSON.stringify(metadata)).not.toContain("noindex");
    expect(JSON.stringify(metadata)).not.toContain("SUPABASE");
  });
});
