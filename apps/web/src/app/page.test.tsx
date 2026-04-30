import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import Home, { metadata } from "./page";

describe("Home page", () => {
  it("renders the public home hero and simulation path", () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "In-home simulation, in-home sofa simulation with AI",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("MÖBEL UNIQUE")[0]).toBeInTheDocument();

    expect(screen.getByText("Choisis ton canapé")).toBeInTheDocument();
    expect(screen.getByText("Sélectionne un tissu et une vue")).toBeInTheDocument();
    expect(screen.getByText("Ajoute une photo de ton salon")).toBeInTheDocument();
    expect(screen.getByText("Découvre une visualisation générée par IA")).toBeInTheDocument();

    expect(
      screen.getByText(/La commande finale se fait sur Shopify/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/visualisation générée par IA est une estimation/i),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", {
      name: /choisir un canapé pour simuler chez toi/i,
    });

    expect(cta).toHaveAttribute("href", "/catalog");

    const video = container.querySelector("video");

    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute(
      "aria-label",
      "Démonstration vidéo de simulation de canapé à domicile",
    );
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("muted");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("poster", "/videos/home-hero-poster.jpg");
    expect(video?.closest(".home-phone-frame")).toHaveAttribute(
      "data-orientation",
      "landscape",
    );
    expect(video?.querySelector('source[type="video/webm"]')).toHaveAttribute(
      "src",
      "/videos/home-hero-pingpong.webm",
    );
    expect(video?.querySelector('source[type="video/mp4"]')).toHaveAttribute(
      "src",
      "/videos/home-hero-pingpong.mp4",
    );
    expect(
      video?.compareDocumentPosition(cta) ?? 0,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not expose foundation debug, admin, or ecommerce surfaces", () => {
    render(<Home />);

    expect(
      screen.queryByText("Monorepo foundation is ready."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
    expect(screen.queryByText("API")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/panier|checkout|compte|prix|stock/i)).not.toBeInTheDocument();
  });

  it("defines public indexable metadata without private values", () => {
    expect(metadata).toMatchObject({
      description: expect.stringContaining("canapé"),
      title: expect.stringContaining("MÖBEL UNIQUE"),
    });

    expect(JSON.stringify(metadata)).not.toContain("SUPABASE");
    expect(JSON.stringify(metadata)).not.toContain("localhost");
  });
});
