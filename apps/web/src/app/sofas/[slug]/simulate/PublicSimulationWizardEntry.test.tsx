/*
RU: Этот файл проверяет первый экран публичной симуляции для выбранного дивана.
RU: Во время проверки видны выбранный диван, ткань, вид, загрузка фото комнаты и кнопка продолжения.
RU: Проверки помогают убедиться, что посетитель может продолжить симуляцию с сохраненным выбором.
FR: Ce fichier verifie le premier ecran de la simulation publique pour le canape choisi.
FR: Pendant les tests, on voit le canape choisi, le tissu, la vue, l'envoi de photo de piece et le bouton pour continuer.
FR: Les tests aident a verifier que le visiteur peut continuer la simulation avec son choix garde.
*/

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PublicSimulationWizardEntry } from "./PublicSimulationWizardEntry";
import type { PublicSofaDetailResponse } from "../../../../lib/public-catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock("../../../../lib/simulation-client/compress", () => ({
  compressRoomPhoto: vi.fn(async (file: File) => ({
    blob: file,
    mimeType: file.type,
    width: 1600,
    height: 1200,
    sourceUsed: "compressed" as const
  }))
}));

vi.mock("../../../../lib/simulation-client/upload", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../lib/simulation-client/upload")
  >("../../../../lib/simulation-client/upload");
  return {
    ...actual,
    uploadRoomPhoto: vi.fn(async () => ({
      ok: true,
      jobId: "sim-from-route",
      status: "queued",
      createdAt: "x",
      retentionDeadline: "y",
      attempts: 1
    }))
  };
});

beforeAll(() => {
  URL.createObjectURL = (() => "blob:fake") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

afterEach(cleanup);

// RU: Эти данные дают проверке публичный диван, готовый для симуляции.
// FR: Ces donnees donnent a la verification un canape public pret pour la simulation.
const detail: PublicSofaDetailResponse = {
  defaults: { fabric_id: "fabric-boucle", visual_position_id: "front" },
  fabrics: [
    {
      id: "fabric-boucle",
      is_premium: false,
      public_name: "Bouclette",
      public_order: 1,
      swatch_url: "https://assets.example/boucle.png"
    }
  ],
  renders: [],
  sofa: {
    dimensions: {
      depth_cm: null,
      footprint_measurements: null,
      footprint_type: "rectangle",
      height_cm: null,
      length_cm: null
    },
    id: "sofa-rivoli",
    price: null,
    public_description: null,
    public_name: "Canapé Rivoli",
    public_slug: "canape-rivoli",
    shopify_order_url: null,
    tags: [{ slug: "convertible", public_label: "Convertible" }]
  },
  visual_positions: [
    { id: "front", public_label: "Vue de face", sequence: 1 }
  ]
};

describe("PublicSimulationWizardEntry", () => {
  it("renders Screen 1 once the sofa loads and a stored selection is found", async () => {
    render(
      <PublicSimulationWizardEntry
        slug="canape-rivoli"
        fetchSofa={async () => detail}
        readStoredSelection={() => ({
          fabric_id: "fabric-boucle",
          visual_position_id: "front"
        })}
        navigateToJob={() => undefined}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent(/photo de votre pièce/i);
    });
    expect(
      screen.getByLabelText("Contexte de la simulation")
    ).toHaveTextContent("Canapé Rivoli · Bouclette · Vue de face");
  });

  it("falls back to the missing-selection panel when sessionStorage holds nothing", async () => {
    render(
      <PublicSimulationWizardEntry
        slug="canape-rivoli"
        fetchSofa={async () => detail}
        readStoredSelection={() => null}
        navigateToJob={() => undefined}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Sélectionnez d'abord un tissu/i)
      ).toBeInTheDocument();
    });
  });

  it("shows the unavailable panel when the sofa endpoint returns null (404/410)", async () => {
    render(
      <PublicSimulationWizardEntry
        slug="canape-rivoli"
        fetchSofa={async () => null}
        readStoredSelection={() => null}
        navigateToJob={() => undefined}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/canapé n'est pas disponible/i)
      ).toBeInTheDocument();
    });
  });

  it("infers corner geometry mode when the sofa carries the corner tag", async () => {
    const cornerDetail = {
      ...detail,
      sofa: {
        ...detail.sofa,
        tags: [{ slug: "corner", public_label: "Angle" }]
      }
    } satisfies PublicSofaDetailResponse;

    render(
      <PublicSimulationWizardEntry
        slug="canape-rivoli"
        fetchSofa={async () => cornerDetail}
        readStoredSelection={() => ({
          fabric_id: "fabric-boucle",
          visual_position_id: "front"
        })}
        navigateToJob={() => undefined}
      />
    );

    expect(
      await screen.findByText(/coin de la pièce — deux murs qui se rencontrent/i)
    ).toBeInTheDocument();
  });

  it("calls navigateToJob with the new job id after Screen 1 finishes the upload", async () => {
    const navigateToJob = vi.fn();

    render(
      <PublicSimulationWizardEntry
        slug="canape-rivoli"
        fetchSofa={async () => detail}
        readStoredSelection={() => ({
          fabric_id: "fabric-boucle",
          visual_position_id: "front"
        })}
        navigateToJob={navigateToJob}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continuer/i })
      ).toBeInTheDocument()
    );

    const fileInput = screen.getByTestId("simulation-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([new ArrayBuffer(1024)], "room.jpg", { type: "image/jpeg" })
        ]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));

    await waitFor(() =>
      expect(navigateToJob).toHaveBeenCalledWith("sim-from-route")
    );
  });
});
