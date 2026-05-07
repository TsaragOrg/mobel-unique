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
import { PublicCatalogPage } from "./PublicCatalogPage";

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
      swatch_url: "https://assets.example/fabrics/boucle.png",
    },
    {
      id: "fabric-sauge",
      is_premium: true,
      public_name: "Velours sauge",
      public_order: 2,
      swatch_url: "https://assets.example/fabrics/sauge.png",
    },
    {
      id: "fabric-lin",
      is_premium: false,
      public_name: "Lin naturel",
      public_order: 3,
      swatch_url: "https://assets.example/fabrics/lin.png",
    },
    {
      id: "fabric-galet",
      is_premium: false,
      public_name: "Chenille galet",
      public_order: 4,
      swatch_url: "https://assets.example/fabrics/galet.png",
    },
    {
      id: "fabric-nuit",
      is_premium: false,
      public_name: "Bleu nuit",
      public_order: 5,
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

describe("PublicCatalogPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/catalog");
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
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

    expect(screen.getByText("Chargement du catalogue...")).toBeInTheDocument();
    expect(await screen.findByText("Canapé Rivoli")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtres de catalogue" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/catalog?limit=12");
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

      if (url === "/api/public/sofas/canape-rivoli") {
        return Promise.resolve(jsonResponse({ data: rivoliDetail, meta: {} }));
      }

      if (url === "/api/public/sofas/canape-marais") {
        return Promise.resolve(jsonResponse({ data: maraisDetail, meta: {} }));
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

    expect(await screen.findByRole("button", { name: "Velours sauge" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aperçu tissus pour Canapé Rivoli" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Velours sauge")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Velours sauge" }));

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
