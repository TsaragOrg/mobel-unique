/*
RU: Этот файл проверяет главную страницу. Посетитель видит бренд, видео, шаги, кнопку выбора дивана и нижнюю ссылку конфиденциальности. Здесь можно сменить цвет дивана, открыть каталог и перейти к политике конфиденциальности.
FR: Ce fichier verifie la page d'accueil. Le visiteur voit la marque, la video, les etapes, le bouton pour choisir un canape et le lien de confidentialite en bas. Ici, il peut changer la couleur du canape, ouvrir le catalogue et aller a la page de confidentialite.
*/

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import Home, { metadata } from "./page";

describe("Home page", () => {
  beforeAll(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
  });

  it("renders the redesigned public home hero and simulation path", () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "Simulez nos canapés chez vous",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("MÖBEL UNIQUE")[0]).toBeInTheDocument();

    expect(screen.getByText("Choisissez un canapé")).toBeInTheDocument();
    expect(screen.getByText("Lancez la simulation")).toBeInTheDocument();
    expect(
      screen.getByText("Découvrez le rendu chez vous"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/téléversez/i)).not.toBeInTheDocument();

    expect(
      screen.getByText(/L'achat final reste séparé sur Shopify/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Le rendu généré reste une estimation visuelle/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Changer la couleur du canapé" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Changer la couleur")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navigation publique" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Voir les collections" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Déposez votre photo")).not.toBeInTheDocument();
    expect(
      screen.queryByText("ou cliquez pour importer"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("JPG, PNG — Max 10 Mo")).not.toBeInTheDocument();
    expect(screen.getByText("Simulation instantanée")).toBeInTheDocument();
    expect(screen.getByText("Ajustement réaliste")).toBeInTheDocument();
    expect(screen.getByText("Rendu en quelques secondes")).toBeInTheDocument();

    const cta = screen.getByRole("link", {
      name: /choisir un autre canapé/i,
    });

    expect(cta).toHaveAttribute("href", "/catalog");
    expect(
      screen.queryByRole("link", { name: /voir un exemple/i }),
    ).not.toBeInTheDocument();

    const video = container.querySelector('video[data-direction="forward"]');

    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute(
      "aria-label",
      "Transformation du canapé entre le tissu vert et le tissu blanc",
    );
    expect(video).not.toHaveAttribute("loop");
    expect(video).toHaveAttribute("muted");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveAttribute("data-active", "true");
    expect(video).toHaveAttribute(
      "poster",
      "/videos/home-sofa-transform-forward-poster.jpg",
    );
    expect(video?.querySelector('source[type="video/webm"]')).toHaveAttribute(
      "src",
      "/videos/home-sofa-transform-forward.webm",
    );
    expect(video?.querySelector('source[type="video/mp4"]')).toHaveAttribute(
      "src",
      "/videos/home-sofa-transform-forward.mp4",
    );
    expect(video?.compareDocumentPosition(cta) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const colorButton = screen.getByRole("button", {
      name: "Changer la couleur du canapé",
    });

    fireEvent.ended(video as HTMLVideoElement);
    fireEvent.click(colorButton);

    const reverseVideo = container.querySelector(
      'video[data-direction="reverse"]',
    );

    expect(video).toHaveAttribute("data-active", "true");
    expect(reverseVideo).toHaveAttribute("data-active", "false");
    expect(reverseVideo).toHaveAttribute("preload", "auto");
    expect(reverseVideo).toHaveAttribute(
      "poster",
      "/videos/home-sofa-transform-reverse-poster.jpg",
    );

    fireEvent.playing(reverseVideo as HTMLVideoElement);

    expect(reverseVideo).toHaveAttribute("data-active", "true");
    expect(
      reverseVideo?.querySelector('source[type="video/webm"]'),
    ).toHaveAttribute("src", "/videos/home-sofa-transform-reverse.webm");
    expect(
      reverseVideo?.querySelector('source[type="video/mp4"]'),
    ).toHaveAttribute("src", "/videos/home-sofa-transform-reverse.mp4");
  });

  it("links to the privacy policy from the home footer", () => {
    render(<Home />);

    const privacyLink = screen.getByRole("link", {
      name: "Politique de confidentialité",
    });

    expect(privacyLink).toHaveAttribute(
      "href",
      "/politique-de-confidentialite",
    );
  });

  it("does not autoplay the transformation for reduced motion users", async () => {
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: true,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
      writable: true,
    });

    try {
      const { container } = render(<Home />);
      const colorButton = screen.getByRole("button", {
        name: "Changer la couleur du canapé",
      });

      await waitFor(() => expect(colorButton).toBeEnabled());

      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

      fireEvent.click(colorButton);

      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
      expect(
        container.querySelector('video[data-direction="reverse"]'),
      ).toHaveAttribute("data-active", "true");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
        writable: true,
      });
    }
  });

  it("does not expose foundation debug, admin, or ecommerce surfaces", () => {
    render(<Home />);

    expect(
      screen.queryByText("Monorepo foundation is ready."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
    expect(screen.queryByText("API")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/panier|checkout|compte|prix|stock/i),
    ).not.toBeInTheDocument();
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
