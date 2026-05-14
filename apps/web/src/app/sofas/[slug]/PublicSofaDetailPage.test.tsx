/*
RU: Этот файл проверяет публичную страницу одного дивана.
RU: Во время проверки видны название, цена, ткань, вид, размеры, метки и кнопки для симуляции или заказа.
RU: Проверки помогают убедиться, что посетитель может выбрать ткань и вид, открыть симуляцию и увидеть главные данные дивана.
FR: Ce fichier verifie la page publique d'un canape.
FR: Pendant les tests, on voit le nom, le prix, le tissu, la vue, les tailles, les etiquettes et les boutons pour la simulation ou la commande.
FR: Les tests aident a verifier que le visiteur peut choisir le tissu et la vue, ouvrir la simulation et voir les donnees principales du canape.
RU: Также проверяется большое окно с картинкой дивана.
FR: Les tests verifient aussi la grande fenetre avec l'image du canape.
*/

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSofaDetailPage } from "./PublicSofaDetailPage";

// RU: Эти данные дают странице диван с ценой, тканями, видами, размерами и метками.
// FR: Ces donnees donnent a la page un canape avec prix, tissus, vues, tailles et etiquettes.
const detail = {
  defaults: {
    fabric_id: "fabric-boucle",
    visual_position_id: "front",
  },
  fabrics: [
    {
      id: "fabric-boucle",
      is_premium: false,
      public_name: "Bouclé ivoire",
      public_order: 1,
      swatch_small_url: "https://assets.example/fabrics/boucle-small.png",
      swatch_url: "https://assets.example/fabrics/boucle.png",
    },
    {
      id: "fabric-sauge",
      is_premium: true,
      public_name: "Velours sauge",
      public_order: 2,
      swatch_small_url: "https://assets.example/fabrics/sauge-small.png",
      swatch_url: "https://assets.example/fabrics/sauge.png",
    },
  ],
  renders: [
    {
      fabric_id: "fabric-boucle",
      height_px: 1200,
      render_medium_url: "https://assets.example/rivoli/boucle-face-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/boucle-face-original.png",
      render_url: "https://assets.example/rivoli/boucle-face-original.png",
      visual_position_id: "front",
      width_px: 1600,
    },
    {
      fabric_id: "fabric-boucle",
      height_px: 1200,
      render_medium_url: "https://assets.example/rivoli/boucle-profil-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/boucle-profil-original.png",
      render_url: "https://assets.example/rivoli/boucle-profil-original.png",
      visual_position_id: "profile",
      width_px: 1600,
    },
    {
      fabric_id: "fabric-sauge",
      height_px: 1200,
      render_medium_url: "https://assets.example/rivoli/sauge-face-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/sauge-face-original.png",
      render_url: "https://assets.example/rivoli/sauge-face-original.png",
      visual_position_id: "front",
      width_px: 1600,
    },
    {
      fabric_id: "fabric-sauge",
      height_px: 1200,
      render_medium_url: "https://assets.example/rivoli/sauge-profil-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/sauge-profil-original.png",
      render_url: "https://assets.example/rivoli/sauge-profil-original.png",
      visual_position_id: "profile",
      width_px: 1600,
    },
  ],
  sofa: {
    dimensions: {
      depth_cm: 96,
      footprint_measurements: null,
      footprint_type: "rectangle",
      height_cm: 82,
      length_cm: 240,
    },
    id: "sofa-rivoli",
    price: {
      amount_cents: 129900,
      currency: "EUR",
    },
    public_description: "Un canapé modulable pour le salon.",
    public_name: "Canapé Rivoli",
    public_slug: "canape-rivoli",
    shopify_order_url: "https://shopify.example/products/canape-rivoli",
    tags: [
      {
        public_label: "Angle",
        slug: "angle",
      },
      {
        public_label: "Convertible",
        slug: "convertible",
      },
    ],
  },
  visual_positions: [
    {
      id: "front",
      public_label: "Face",
      sequence: 1,
    },
    {
      id: "profile",
      public_label: "Profil",
      sequence: 2,
    },
  ],
};

// RU: Эти данные дают странице много меток, чтобы проверить короткий и полный вид меток.
// FR: Ces donnees donnent beaucoup d'etiquettes pour verifier la vue courte et la vue complete.
const manySofaTags = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");

  return {
    public_label: `Étiquette ${number}`,
    slug: `etiquette-${number}`,
  };
});

// RU: Этот класс заменяет встроенную картинку браузера, чтобы она сразу сообщала о готовности.
// FR: Cette classe remplace l'image du navigateur pour qu'elle signale tout de suite qu'elle est prete.
class InstantImage {
  private _src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  static loaded: string[] = [];

  set src(value: string) {
    this._src = value;
    InstantImage.loaded.push(value);
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this._src;
  }

  decode(): Promise<void> {
    return Promise.resolve();
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function mockDetailResponse(body: unknown = { data: detail, meta: {} }, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, status)));
}

describe("PublicSofaDetailPage", () => {
  beforeEach(() => {
    InstantImage.loaded = [];
    vi.stubGlobal("Image", InstantImage);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("uses a detail-hero shaped skeleton while the sofa detail loads", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    expect(
      screen.getByRole("article", { name: "Chargement du canape" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".public-status-panel")).toBeNull();
    expect(container.querySelector(".sofa-detail-skeleton")).toBeInTheDocument();
    expect(
      container.querySelector(".sofa-detail-skeleton .sofa-detail-image"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".sofa-detail-skeleton .sofa-detail-copy"),
    ).toBeInTheDocument();
  });

  it("loads default fabric and visual position from direct entry", async () => {
    mockDetailResponse();
    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    expect(screen.queryByRole("link", { name: "Catalogue" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au catalogue" })).toHaveAttribute(
      "href",
      "/catalog",
    );
    expect(await screen.findByRole("heading", { name: "Canapé Rivoli" })).toBeInTheDocument();
    expect(screen.getByText("Un canapé modulable pour le salon.")).toBeInTheDocument();
    expect(screen.getByText("1 299 €")).toBeInTheDocument();
    expect(screen.getByText("Longueur 240 cm")).toBeInTheDocument();
    expect(screen.getByText("Profondeur 96 cm")).toBeInTheDocument();
    expect(screen.getByText("Hauteur 82 cm")).toBeInTheDocument();
    expect(screen.getByText("Angle")).toBeInTheDocument();
    expect(screen.getByText("Convertible")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ivoire/ }).querySelector("img"),
    ).toHaveAttribute("src", "https://assets.example/fabrics/boucle-small.png");
    expect(screen.getByRole("button", { name: "Bouclé ivoire" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Face" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(container.querySelector('img[alt="Canapé Rivoli en Bouclé ivoire, Face"]')).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-medium.jpg",
    );
    expect(screen.getByRole("link", { name: "Lancer ma simulation" })).toHaveAttribute(
      "href",
      "/sofas/canape-rivoli/simulate/start",
    );
    expect(screen.getByRole("link", { name: "Commander" })).toHaveAttribute(
      "href",
      "https://shopify.example/products/canape-rivoli",
    );
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/public/sofas/canape-rivoli", {
      cache: "no-store",
    });
    expect(screen.getByText(/Le rendu IA reste une estimation visuelle/i)).toBeInTheDocument();
  });

  it("keeps sofa detail tags compact until the visitor opens the full list", async () => {
    const detailWithManyTags = {
      ...detail,
      sofa: {
        ...detail.sofa,
        tags: manySofaTags,
      },
    };
    mockDetailResponse({ data: detailWithManyTags, meta: {} });

    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: detailWithManyTags.sofa.public_name });
    const tagGroup = screen.getByRole("list", { name: "Étiquettes du canapé" });

    expect(within(tagGroup).getByText("Étiquette 01")).toBeInTheDocument();
    expect(within(tagGroup).getByText("Étiquette 02")).toBeInTheDocument();
    expect(within(tagGroup).getByText("Étiquette 03")).toBeInTheDocument();
    expect(within(tagGroup).queryByText("Étiquette 04")).not.toBeInTheDocument();

    fireEvent.click(within(tagGroup).getByRole("button", { name: "Voir plus" }));

    expect(within(tagGroup).getByText("Étiquette 10")).toBeInTheDocument();
    expect(within(tagGroup).getByRole("button", { name: "Voir moins" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("restores a valid internal catalog preview fabric from session storage", async () => {
    window.sessionStorage.setItem(
      "mobel-unique:catalog-selection:canape-rivoli",
      JSON.stringify({ fabric_id: "fabric-sauge" }),
    );
    mockDetailResponse();
    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    expect(await screen.findByRole("button", { name: "Velours sauge" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(container.querySelector('img[alt="Canapé Rivoli en Velours sauge, Face"]')).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/sauge-face-medium.jpg",
    );
    expect(
      window.sessionStorage.getItem("mobel-unique:catalog-selection:canape-rivoli"),
    ).toBeNull();
  });

  it("preloads every fabric render for the active visual position", async () => {
    mockDetailResponse();

    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Profil" }));

    await waitFor(() => {
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/boucle-profil-medium.jpg",
      );
      expect(InstantImage.loaded).toContain(
        "https://assets.example/rivoli/sauge-profil-medium.jpg",
      );
    });
  });

  it("keeps the previous detail image visible until the next render is decoded", async () => {
    mockDetailResponse();

    const gate: { resolveSauge: (() => void) | null } = { resolveSauge: null };

    class GatedImage extends InstantImage {
      set src(value: string) {
        if (value === "https://assets.example/rivoli/sauge-face-medium.jpg") {
          InstantImage.loaded.push(value);
          (this as unknown as { _src: string })._src = value;
          return;
        }

        super.src = value;
      }

      decode(): Promise<void> {
        if (
          (this as unknown as { _src: string })._src ===
          "https://assets.example/rivoli/sauge-face-medium.jpg"
        ) {
          return new Promise((resolve) => {
            gate.resolveSauge = resolve;
          });
        }

        return super.decode();
      }
    }

    vi.stubGlobal("Image", GatedImage);

    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });

    fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

    expect(
      container.querySelector(
        'img[alt="Canapé Rivoli en Bouclé ivoire, Face"]',
      ),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-medium.jpg",
    );

    gate.resolveSauge?.();

    await waitFor(() =>
      expect(
        container.querySelector(
          'img[alt="Canapé Rivoli en Velours sauge, Face"]',
        ),
      ).toHaveAttribute(
        "src",
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      ),
    );
  });

  it("keeps fabric and visual position selections independent", async () => {
    mockDetailResponse();
    const { container } = render(<PublicSofaDetailPage slug="canape-rivoli" />);

    await screen.findByRole("heading", { name: "Canapé Rivoli" });
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    await waitFor(() =>
      expect(
        container.querySelector(
          'img[alt="Canapé Rivoli en Bouclé ivoire, Profil"]',
        ),
      ).toHaveAttribute(
        "src",
        "https://assets.example/rivoli/boucle-profil-medium.jpg",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

    expect(
      screen.getByRole("button", { name: "Velours sauge" }).querySelector("img"),
    ).toHaveAttribute("src", "https://assets.example/fabrics/sauge-small.png");
    expect(screen.getByRole("button", { name: "Profil" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() =>
      expect(
        container.querySelector(
          'img[alt="Canapé Rivoli en Velours sauge, Profil"]',
        ),
      ).toHaveAttribute(
        "src",
        "https://assets.example/rivoli/sauge-profil-medium.jpg",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /Agrandir l'image du canap/i }));

    const dialog = screen.getByRole("dialog", { name: /Image du canap/i });
    expect(
      within(dialog).getByRole("img", {
        name: /Rivoli en Velours sauge, Profil/,
      }),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/sauge-profil-original.png",
    );
  });

  it("opens the selected sofa image in a full-screen viewer and closes it", async () => {
    mockDetailResponse();
    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    const openButton = await screen.findByRole("button", {
      name: "Agrandir l'image du canapé",
    });

    fireEvent.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Image du canapé" });
    expect(
      within(dialog).getByRole("img", {
        name: "Canapé Rivoli en Bouclé ivoire, Face",
      }),
    ).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-original.png",
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer l'image" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "Image du canapé" }),
    ).not.toBeInTheDocument();

    fireEvent.click(openButton);
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Image du canapé" }),
      ).not.toBeInTheDocument();
    });
  });

  it("blocks simulation when session-scoped selection state is stale", async () => {
    window.sessionStorage.setItem(
      "mobel-unique:catalog-selection:canape-rivoli",
      JSON.stringify({ fabric_id: "fabric-missing", visual_position_id: "profile" }),
    );
    mockDetailResponse();
    render(<PublicSofaDetailPage slug="canape-rivoli" />);

    expect(
      await screen.findByText("Votre sélection précédente n'est plus disponible."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lancer ma simulation" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Utiliser la première sélection disponible" }));

    expect(screen.getByRole("link", { name: "Lancer ma simulation" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows safe unavailable copy for missing or removed sofas", async () => {
    mockDetailResponse(
      {
        error: {
          code: "SOFA_UNAVAILABLE",
          details: {
            lifecycle_state: "archived",
          },
          message: "Ce canapé n'est plus disponible.",
        },
      },
      410,
    );

    render(<PublicSofaDetailPage slug="ancien-canape" />);

    expect(await screen.findByText("Ce canapé n'est pas disponible.")).toBeInTheDocument();
    expect(screen.queryByText(/archived|draft|unpublished|storage/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au catalogue" })).toHaveAttribute(
      "href",
      "/catalog",
    );
  });
});
