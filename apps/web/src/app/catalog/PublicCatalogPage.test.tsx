/*
RU: Этот файл проверяет публичную страницу каталога диванов.
RU: В проверках видны карточки диванов, фильтры, ткани, картинки и переход к странице дивана.
RU: Проверки помогают убедиться, что посетитель может фильтровать каталог, менять ткань в карточке и открыть выбранный диван.
FR: Ce fichier verifie la page publique du catalogue de canapes.
FR: Dans les controles, on voit les cartes, les filtres, les tissus, les images et le lien vers la page du canape.
FR: Les controles aident a verifier que le visiteur peut filtrer, changer le tissu dans une carte et ouvrir le canape choisi.
*/

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PublicCatalogPage,
  getMobileOneLineFilterLimit,
  getOneLineFilterLimit,
} from "./PublicCatalogPage";

// RU: Эти данные дают каталогу два дивана с картинками разных размеров.
// FR: Ces donnees donnent au catalogue deux canapes avec des images de tailles differentes.
const rivoli = {
  default_fabric_id: "fabric-boucle",
  default_render_medium_content_type: "image/jpeg",
  default_render_medium_height_px: 960,
  default_render_medium_url:
    "https://assets.example/rivoli/boucle-face-medium.jpg",
  default_render_medium_width_px: 1280,
  default_render_url: "https://assets.example/rivoli/boucle-face-original.png",
  default_visual_position_id: "front",
  dimensions: {
    depth_cm: 96,
    footprint_measurements: null,
    footprint_type: "rectangle",
    height_cm: 82,
    length_cm: 240,
  },
  fabrics: [
    {
      id: "fabric-boucle",
      is_premium: false,
      public_name: "BouclГ© ivoire",
      public_order: 1,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_url:
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      render_medium_width_px: 1280,
      swatch_small_content_type: "image/png",
      swatch_small_height_px: 96,
      swatch_small_url: "https://assets.example/fabrics/boucle-small.png",
      swatch_small_width_px: 96,
    },
    {
      id: "fabric-sauge",
      is_premium: true,
      public_name: "Velours sauge",
      public_order: 2,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_url: "https://assets.example/rivoli/sauge-face-medium.jpg",
      render_medium_width_px: 1280,
      swatch_small_content_type: "image/png",
      swatch_small_height_px: 96,
      swatch_small_url: "https://assets.example/fabrics/sauge-small.png",
      swatch_small_width_px: 96,
    },
  ],
  id: "sofa-rivoli",
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
    {
      public_label: "Grand format",
      slug: "grand-format",
    },
    {
      public_label: "Salon familial",
      slug: "salon-familial",
    },
  ],
};

const marais = {
  ...rivoli,
  default_fabric_id: "fabric-lin",
  default_render_medium_url: "https://assets.example/marais/lin-face-medium.jpg",
  default_render_url: "https://assets.example/marais/lin-face-original.png",
  fabrics: [
    {
      id: "fabric-lin",
      is_premium: false,
      public_name: "Lin naturel",
      public_order: 1,
      render_medium_content_type: "image/jpeg",
      render_medium_height_px: 960,
      render_medium_url: "https://assets.example/marais/lin-face-medium.jpg",
      render_medium_width_px: 1280,
      swatch_small_content_type: "image/png",
      swatch_small_height_px: 96,
      swatch_small_url: "https://assets.example/fabrics/lin-small.png",
      swatch_small_width_px: 96,
    },
  ],
  id: "sofa-marais",
  public_name: "Canapé Marais",
  public_slug: "canape-marais",
  tags: [
    {
      public_label: "Compact",
      slug: "compact",
    },
  ],
};

// RU: Эти данные дают длинный список меток, чтобы проверить короткий и полный вид фильтров.
// FR: Ces donnees donnent une longue liste d'etiquettes pour verifier la vue courte et la vue complete des filtres.
const manyTags = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");

  return {
    public_label: `Visual Test Tag ${number}`,
    slug: `visual-test-tag-${number}`,
  };
});

// RU: Эти данные дают карточке много меток, чтобы проверить две строки внизу карточки.
// FR: Ces donnees donnent beaucoup d'etiquettes a la carte pour verifier deux lignes en bas.
const manyCardTags = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");

  return {
    public_label: `Card Tag ${number}`,
    slug: `card-tag-${number}`,
  };
});

const rivoliDetail = {
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
    {
      id: "fabric-lin",
      is_premium: false,
      public_name: "Lin naturel",
      public_order: 3,
      swatch_small_url: "https://assets.example/fabrics/lin-small.png",
      swatch_url: "https://assets.example/fabrics/lin.png",
    },
    {
      id: "fabric-galet",
      is_premium: false,
      public_name: "Chenille galet",
      public_order: 4,
      swatch_small_url: "https://assets.example/fabrics/galet-small.png",
      swatch_url: "https://assets.example/fabrics/galet.png",
    },
    {
      id: "fabric-nuit",
      is_premium: false,
      public_name: "Bleu nuit",
      public_order: 5,
      swatch_small_url: "https://assets.example/fabrics/nuit-small.png",
      swatch_url: "https://assets.example/fabrics/nuit.png",
    },
  ],
  renders: [
    {
      fabric_id: "fabric-boucle",
      height_px: 1200,
      render_medium_url:
        "https://assets.example/rivoli/boucle-face-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/boucle-face-original.png",
      render_url: "https://assets.example/rivoli/boucle-face-original.png",
      visual_position_id: "front",
      width_px: 1600,
    },
    {
      fabric_id: "fabric-sauge",
      height_px: 1200,
      render_medium_url:
        "https://assets.example/rivoli/sauge-face-medium.jpg",
      render_original_url:
        "https://assets.example/rivoli/sauge-face-original.png",
      render_url: "https://assets.example/rivoli/sauge-face-original.png",
      visual_position_id: "front",
      width_px: 1600,
    },
  ],
  sofa: {
    dimensions: rivoli.dimensions,
    id: "sofa-rivoli",
    public_description: "Un canapé modulable pour le salon.",
    public_name: "Canapé Rivoli",
    public_slug: "canape-rivoli",
    shopify_order_url: "https://shopify.example/products/canape-rivoli",
    tags: rivoli.tags,
  },
  visual_positions: [
    {
      id: "front",
      public_label: "Face",
      sequence: 1,
    },
  ],
};

const maraisDetail = {
  ...rivoliDetail,
  defaults: {
    fabric_id: "fabric-lin",
    visual_position_id: "front",
  },
  fabrics: [
    {
      id: "fabric-lin",
      is_premium: false,
      public_name: "Lin naturel",
      public_order: 1,
      swatch_small_url: "https://assets.example/fabrics/lin-small.png",
      swatch_url: "https://assets.example/fabrics/lin.png",
    },
  ],
  renders: [
    {
      fabric_id: "fabric-lin",
      height_px: 1200,
      render_medium_url: "https://assets.example/marais/lin-face-medium.jpg",
      render_original_url:
        "https://assets.example/marais/lin-face-original.png",
      render_url: "https://assets.example/marais/lin-face-original.png",
      visual_position_id: "front",
      width_px: 1600,
    },
  ],
  sofa: {
    ...rivoliDetail.sofa,
    id: "sofa-marais",
    public_name: "Canapé Marais",
    public_slug: "canape-marais",
    tags: marais.tags,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function catalogEnvelope(items: unknown[], nextCursor: string | null = null) {
  return {
    data: {
      items,
      next_cursor: nextCursor,
    },
    meta: {},
  };
}

function tagsEnvelope(items: unknown[]) {
  return {
    data: {
      items,
    },
    meta: {},
  };
}

// RU: Эта помощь задает ширину окна для проверок фильтров.
// FR: Cette aide fixe la largeur de la fenetre pour les controles des filtres.
function setCatalogViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  vi.stubGlobal("matchMedia", (query: string) => {
    return {
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === "(max-width: 680px)" ? width <= 680 : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

// RU: Эта помощь задает размеры фильтров, чтобы проверить мобильную строку с разной длиной текста.
// FR: Cette aide fixe les tailles des filtres pour verifier la ligne mobile avec des textes differents.
function mockFilterMeasurements(input: {
  containerWidth: number;
  fallbackTagWidth: number;
  tagWidths?: Record<string, number>;
  toggleWidth?: number;
}) {
  const baseRect = (width: number) =>
    ({
      bottom: 0,
      height: 42,
      left: 0,
      right: width,
      toJSON: () => ({}),
      top: 0,
      width,
      x: 0,
      y: 0,
    }) as DOMRect;

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains("catalog-filters")) {
      return baseRect(input.containerWidth);
    }

    if (this.getAttribute("data-filter-measure") === "toggle") {
      return baseRect(input.toggleWidth ?? 96);
    }

    if (this.getAttribute("data-filter-measure") === "tag") {
      const label = this.textContent?.trim() ?? "";

      return baseRect(input.tagWidths?.[label] ?? input.fallbackTagWidth);
    }

    return baseRect(0);
  });
}

describe("PublicCatalogPage", () => {
  beforeEach(() => {
    setCatalogViewport(390);
    window.history.replaceState({}, "", "/catalog");
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("uses a catalog-card shaped skeleton while the first catalog page loads", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const { container } = render(<PublicCatalogPage />);

    expect(
      screen.getByRole("region", { name: "Chargement du catalogue" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".public-status-panel")).toBeNull();
    expect(container.querySelectorAll(".catalog-card-skeleton")).toHaveLength(6);
    expect(
      container.querySelectorAll(
        ".catalog-card-skeleton .catalog-card-image",
      ),
    ).toHaveLength(6);
    expect(
      container.querySelectorAll(".catalog-card-skeleton .catalog-card-body"),
    ).toHaveLength(6);
  });

  it("loads published sofas and hides filters when no public tags exist", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope([])));
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli])));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicCatalogPage />);

    expect(
      screen.getByRole("region", { name: "Chargement du catalogue" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("Canapé Rivoli")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtres de catalogue" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog?limit=12");
  });

  it("keeps the remaining catalog card tag count inside the two-line tag list", async () => {
    const sofaWithManyTags = {
      ...rivoli,
      tags: manyCardTags,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope([])));
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([sofaWithManyTags])));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<PublicCatalogPage />);

    await screen.findByRole("heading", { name: sofaWithManyTags.public_name });
    const card = container.querySelector(".catalog-card") as HTMLElement;
    const tagList = card.querySelector(".public-tag-list") as HTMLElement;

    expect(tagList).toBeInTheDocument();
    expect(tagList).toContainElement(screen.getByText("+17 tag"));
    expect(Array.from(tagList.children).map((child) => child.textContent)).toEqual([
      "Card Tag 01",
      "Card Tag 02",
      "Card Tag 03",
      "+17 tag",
    ]);
    expect(
      Array.from(card.querySelector(".catalog-card-body")?.children ?? []).some(
        (child) =>
          child.classList.contains("catalog-more-tags") &&
          child.textContent?.trim() === "+17 tag",
      ),
    ).toBe(false);
  });

  it("fits mobile filters by measured label width and opens every filter in a popup", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope(manyTags)));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([])));
    });
    vi.stubGlobal("fetch", fetchMock);
    mockFilterMeasurements({
      containerWidth: 390,
      fallbackTagWidth: 170,
    });

    render(<PublicCatalogPage />);

    expect(await screen.findByRole("button", { name: "Visual Test Tag 001" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Visual Test Tag 002" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visual Test Tag 003" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Voir plus \(\+\d+\)/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }));

    expect(screen.getByRole("dialog", { name: "Tous les filtres" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visual Test Tag 003" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visual Test Tag 010" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer les filtres" }));

    expect(screen.queryByRole("dialog", { name: "Tous les filtres" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visual Test Tag 003" })).not.toBeInTheDocument();
  });

  it("keeps a selected hidden filter visible while other filters stay in the popup", async () => {
    window.history.replaceState({}, "", "/catalog?tag=visual-test-tag-010");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope(manyTags)));
      }

      if (url.includes("tag=visual-test-tag-010")) {
        return Promise.resolve(jsonResponse(catalogEnvelope([])));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli])));
    });
    vi.stubGlobal("fetch", fetchMock);
    mockFilterMeasurements({
      containerWidth: 390,
      fallbackTagWidth: 110,
    });

    render(<PublicCatalogPage />);

    expect(await screen.findByRole("button", { name: "Visual Test Tag 010" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Visual Test Tag 009" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Voir plus \(\+\d+\)/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }));

    expect(screen.getByRole("dialog", { name: "Tous les filtres" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visual Test Tag 009" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer les filtres" }));

    expect(screen.getByRole("button", { name: "Visual Test Tag 010" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Visual Test Tag 009" })).not.toBeInTheDocument();
  });

  it("calculates a desktop filter limit that leaves room for Voir plus on one line", () => {
    expect(
      getOneLineFilterLimit({
        containerWidth: 500,
        gap: 10,
        tagWidths: [100, 100, 100, 100, 100],
        toggleWidth: 80,
      }),
    ).toBe(3);
    expect(
      getOneLineFilterLimit({
        containerWidth: 600,
        gap: 10,
        tagWidths: [100, 100, 100],
        toggleWidth: 80,
      }),
    ).toBe(3);
  });

  it("calculates a mobile filter limit from label widths without reserving Voir plus", () => {
    expect(
      getMobileOneLineFilterLimit({
        containerWidth: 390,
        gap: 8,
        tagWidths: [140, 120, 90, 80],
      }),
    ).toBe(3);
    expect(
      getMobileOneLineFilterLimit({
        containerWidth: 390,
        gap: 8,
        tagWidths: [360, 60, 60],
      }),
    ).toBe(1);
    expect(
      getMobileOneLineFilterLimit({
        containerWidth: 390,
        gap: 8,
        tagWidths: [90, 80],
      }),
    ).toBe(2);
  });

  it("uses repeated tag query parameters for AND filtering and keeps browser history", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(
          jsonResponse(
            tagsEnvelope([
              { public_label: "Angle", slug: "angle" },
              { public_label: "Convertible", slug: "convertible" },
            ]),
          ),
        );
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      if (url === "/api/public/sofas/canape-marais") {
        return Promise.resolve(jsonResponse({ data: maraisDetail, meta: {} }));
      }

      if (url.includes("tag=angle") && url.includes("tag=convertible")) {
        return Promise.resolve(jsonResponse(catalogEnvelope([rivoli])));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli, marais])));
    });
    vi.stubGlobal("fetch", fetchMock);
    mockFilterMeasurements({
      containerWidth: 390,
      fallbackTagWidth: 110,
    });

    render(<PublicCatalogPage />);

    await screen.findByText("Canapé Rivoli");
    fireEvent.click(screen.getByRole("button", { name: "Angle" }));
    await waitFor(() => expect(window.location.search).toBe("?tag=angle"));
    fireEvent.click(screen.getByRole("button", { name: "Convertible" }));

    await waitFor(() => {
      expect(window.location.search).toBe("?tag=angle&tag=convertible");
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/public/catalog?limit=12&tag=angle&tag=convertible",
    );
  });

  it("shows no-results copy and resets pagination when filters are cleared", async () => {
    window.history.replaceState({}, "", "/catalog?tag=angle&tag=unknown");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(
          jsonResponse(tagsEnvelope([{ public_label: "Angle", slug: "angle" }])),
        );
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      if (url.includes("tag=angle")) {
        return Promise.resolve(jsonResponse(catalogEnvelope([])));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli])));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicCatalogPage />);

    expect(
      await screen.findByText("Aucun canapé ne correspond à ces filtres."),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?tag=angle");

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));

    expect(await screen.findByText("Canapé Rivoli")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog?limit=12");
  });

  it("appends load-more results, removes duplicates, and retries after page failures", async () => {
    let loadMoreAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope([])));
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      if (url === "/api/public/sofas/canape-marais") {
        return Promise.resolve(jsonResponse({ data: maraisDetail, meta: {} }));
      }

      if (url.includes("cursor=next-page")) {
        loadMoreAttempts += 1;

        if (loadMoreAttempts === 1) {
          return Promise.resolve(jsonResponse({ error: { message: "Nope" } }, 503));
        }

        return Promise.resolve(jsonResponse(catalogEnvelope([rivoli, marais])));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli], "next-page")));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicCatalogPage />);

    expect(await screen.findByText("Canapé Rivoli")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Charger plus" }));

    expect(await screen.findByText("Impossible de charger la suite du catalogue.")).toBeInTheDocument();
    expect(screen.getByText("Canapé Rivoli")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Canapé Marais")).toBeInTheDocument();
    expect(screen.getAllByText("Canapé Rivoli")).toHaveLength(1);
  });

  it("shows card fabric controls automatically and swaps only the active card image", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope([])));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli, marais])));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PublicCatalogPage />);

    await screen.findByText("Canapé Rivoli");
    const rivoliImage = container.querySelector<HTMLImageElement>(
      'img[alt="Canapé Rivoli"]',
    );
    const maraisImage = container.querySelector<HTMLImageElement>(
      'img[alt="Canapé Marais"]',
    );

    expect(rivoliImage).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/boucle-face-medium.jpg",
    );

    const saugeButton = await screen.findByRole("button", {
      name: "Velours sauge",
    });
    expect(saugeButton).toBeInTheDocument();
    expect(saugeButton.querySelector("img")).toHaveAttribute(
      "src",
      "https://assets.example/fabrics/sauge-small.png",
    );
    expect(
      screen.queryByRole("button", { name: "Aperçu tissus pour Canapé Rivoli" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Velours sauge")).not.toBeInTheDocument();
    fireEvent.click(saugeButton);

    expect(rivoliImage).toHaveAttribute(
      "src",
      "https://assets.example/rivoli/sauge-face-medium.jpg",
    );
    expect(maraisImage).toHaveAttribute(
      "src",
      "https://assets.example/marais/lin-face-medium.jpg",
    );

    const detailLink = screen.getByRole("link", {
      name: "Simuler Canapé Rivoli",
    });
    detailLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(detailLink);
    expect(window.sessionStorage.getItem("mobel-unique:catalog-selection:canape-rivoli")).toContain(
      "fabric-sauge",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog?limit=12");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/public/sofas/"),
      ),
    ).toBe(false);
  });

  it("uses a French placeholder when a catalog image fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/public/catalog/tags") {
        return Promise.resolve(jsonResponse(tagsEnvelope([])));
      }

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      return Promise.resolve(jsonResponse(catalogEnvelope([rivoli])));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PublicCatalogPage />);

    await screen.findByText("Canapé Rivoli");
    fireEvent.error(container.querySelector('img[alt="Canapé Rivoli"]') as HTMLImageElement);

    expect(screen.getByText("Image indisponible")).toBeInTheDocument();
  });
});
