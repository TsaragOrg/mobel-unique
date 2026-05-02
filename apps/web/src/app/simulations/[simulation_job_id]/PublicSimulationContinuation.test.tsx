import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSimulationContinuation } from "./PublicSimulationContinuation";
import type {
  SimulationJobStatus,
  SimulationStatusResponse
} from "../../../lib/simulation-public-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

afterEach(cleanup);

const baseContext = {
  slug: "canape-rivoli",
  sofaName: "Canapé Rivoli",
  fabricName: "Bouclette",
  visualPositionLabel: "Vue de face"
};

function snapshot(
  status: SimulationJobStatus,
  overrides: Partial<SimulationStatusResponse> = {}
): SimulationStatusResponse {
  return {
    simulation_job_id: "sim-1",
    status,
    room_geometry_mode: "back_wall",
    created_at: "2026-05-02T10:00:00.000Z",
    retention_deadline: "2026-05-03T10:00:00.000Z",
    generated_output_count: 0,
    regeneration_available: false,
    ...overrides
  };
}

describe("PublicSimulationContinuation", () => {
  it("renders Screen 2 (room preparation) while the status is queued", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () => snapshot("queued")}
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent(/préparation/i)
    );
  });

  it("renders Screen 3 (dimensions) once awaiting_dimensions is reported", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () =>
          snapshot("awaiting_dimensions", {
            dimension_guide_overlay_url: "https://signed.example/guide.png"
          })
        }
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent(/mesurez votre pièce/i)
    );
    expect(screen.getByAltText(/lignes colorées/i)).toHaveAttribute(
      "src",
      "https://signed.example/guide.png"
    );
  });

  it("renders Screen 4 (placement initial) on placement_processing without a previous result", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () => snapshot("placement_processing")}
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("simulation-placement-initial")
      ).toBeInTheDocument()
    );
  });

  it("renders Screen 5 (result) once the job succeeds", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () =>
          snapshot("succeeded", {
            latest_output_url: "https://signed.example/output-1.png",
            generated_output_count: 1,
            regeneration_available: true
          })
        }
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent(/votre canapé dans votre pièce/i)
    );
    expect(screen.getByAltText(/votre canapé placé/i)).toHaveAttribute(
      "src",
      "https://signed.example/output-1.png"
    );
    expect(
      screen.getByRole("button", { name: /nouvelle génération/i })
    ).toBeInTheDocument();
  });

  it("renders Screen 6 error variant on failed status with a Restart link to the wizard entry", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () => snapshot("failed")}
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("simulation-screen-error")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: /recommencer la simulation/i })
    ).toHaveAttribute("href", "/sofas/canape-rivoli/simulate");
  });

  it("renders Screen 6 expired variant on expired status without a Restart action", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () => snapshot("expired")}
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("simulation-screen-expired")).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("link", { name: /recommencer/i })
    ).not.toBeInTheDocument();
  });

  it("falls back to a generic context when sessionStorage holds no job context", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () => snapshot("succeeded", {
          latest_output_url: "https://signed.example/output-1.png",
          regeneration_available: false
        })}
        loadJobContext={() => null}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByAltText(/votre canapé placé/i)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: /retour au canapé/i })
    ).toHaveAttribute("href", "/catalog");
  });
});
