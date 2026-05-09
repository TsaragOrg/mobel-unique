import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSimulationContinuation } from "./PublicSimulationContinuation";
import type { SubscribeToSimulationProgressArgs } from "../../../lib/simulation-client/realtime";
import type {
  SimulationJobStatus,
  SimulationStatusResponse
} from "../../../lib/simulation-public-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
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

  it("passes a safe failed-job diagnostic to Screen 6", async () => {
    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={async () =>
          snapshot("failed", {
            last_error:
              "Could not convert HEIC/HEIF input: libheif could not load: Module not found: https://esm.sh/libheif-js@1.18.1?bundle"
          })
        }
        loadJobContext={() => baseContext}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("simulation-screen-error")).toBeInTheDocument()
    );

    const text = screen.getByTestId("simulation-screen-error").textContent ?? "";
    expect(text).toMatch(/HEIC\/HEIF n'a pas pu être converti/i);
    expect(text).not.toMatch(/libheif|esm\.sh|https?:\/\//i);
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

  it("refreshes the signed status payload when a Realtime progress event arrives", async () => {
    let progressCallback: SubscribeToSimulationProgressArgs["onProgress"] | null =
      null;
    const subscribeProgress = vi.fn((args: SubscribeToSimulationProgressArgs) => {
      progressCallback = args.onProgress;
      return () => undefined;
    });
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(snapshot("queued"))
      .mockResolvedValueOnce(
        snapshot("awaiting_dimensions", {
          dimension_guide_overlay_url: "https://signed.example/guide.png"
        })
      );

    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={fetchStatus}
        loadJobContext={() => baseContext}
        subscribeProgress={subscribeProgress}
      />
    );

    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));
    expect(subscribeProgress).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "sim-1" })
    );

    await act(async () => {
      progressCallback?.({
        simulation_job_id: "sim-1",
        status: "awaiting_dimensions",
        progress_step_key: "awaiting_dimensions",
        progress_step_ordinal: 3,
        progress_total_steps: 4,
        visitor_action_required: true,
        guide_available: true,
        latest_result_available: false,
        regeneration_available: false,
        retention_deadline: "2026-05-03T10:00:00.000Z",
        updated_at: "2026-05-02T10:01:00.000Z"
      });
    });

    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/mesurez votre pièce/i);
  });

  it("uses Realtime step details to make room preparation loading copy specific", async () => {
    let progressCallback: SubscribeToSimulationProgressArgs["onProgress"] | null =
      null;
    const subscribeProgress = vi.fn((args: SubscribeToSimulationProgressArgs) => {
      progressCallback = args.onProgress;
      return () => undefined;
    });
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(snapshot("queued"))
      .mockResolvedValueOnce(snapshot("room_prep_processing"));

    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={fetchStatus}
        loadJobContext={() => baseContext}
        subscribeProgress={subscribeProgress}
      />
    );

    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      progressCallback?.({
        simulation_job_id: "sim-1",
        status: "room_prep_processing",
        progress_step_key: "room_cleaning",
        progress_step_ordinal: 2,
        progress_total_steps: 4,
        visitor_action_required: false,
        guide_available: false,
        latest_result_available: false,
        regeneration_available: false,
        retention_deadline: "2026-05-03T10:00:00.000Z",
        updated_at: "2026-05-02T10:01:00.000Z"
      });
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent("Préparation de votre image")
    );
    expect(screen.getByText("Étape 2 sur 4")).toBeInTheDocument();
  });

  it("uses Realtime step details to make placement loading copy specific", async () => {
    let progressCallback: SubscribeToSimulationProgressArgs["onProgress"] | null =
      null;
    const subscribeProgress = vi.fn((args: SubscribeToSimulationProgressArgs) => {
      progressCallback = args.onProgress;
      return () => undefined;
    });
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(snapshot("placement_queued"))
      .mockResolvedValueOnce(snapshot("placement_processing"));

    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={fetchStatus}
        loadJobContext={() => baseContext}
        subscribeProgress={subscribeProgress}
      />
    );

    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      progressCallback?.({
        simulation_job_id: "sim-1",
        status: "placement_processing",
        progress_step_key: "placement_generation",
        progress_step_ordinal: 4,
        progress_total_steps: 4,
        visitor_action_required: false,
        guide_available: false,
        latest_result_available: false,
        regeneration_available: false,
        retention_deadline: "2026-05-03T10:00:00.000Z",
        updated_at: "2026-05-02T10:03:00.000Z"
      });
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toHaveTextContent("Placement du canapé dans votre pièce")
    );
    expect(screen.getByText("Étape 4 sur 4")).toBeInTheDocument();
  });

  it("keeps a slow reconciliation read once Realtime is connected", async () => {
    vi.useFakeTimers();
    let progressCallback: SubscribeToSimulationProgressArgs["onProgress"] | null =
      null;
    let connectionCallback:
      | NonNullable<SubscribeToSimulationProgressArgs["onConnectionState"]>
      | null = null;
    const subscribeProgress = vi.fn((args: SubscribeToSimulationProgressArgs) => {
      progressCallback = args.onProgress;
      connectionCallback = args.onConnectionState ?? null;
      return () => undefined;
    });
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(snapshot("queued"))
      .mockResolvedValueOnce(snapshot("queued"))
      .mockResolvedValueOnce(
        snapshot("awaiting_dimensions", {
          dimension_guide_overlay_url: "https://signed.example/guide.png"
        })
      );

    render(
      <PublicSimulationContinuation
        jobId="sim-1"
        fetchStatus={fetchStatus}
        loadJobContext={() => baseContext}
        subscribeProgress={subscribeProgress}
      />
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      connectionCallback?.("connected");
      await flushMicrotasks();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(29_999);
      await flushMicrotasks();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/mesurez votre pièce/i);

    fetchStatus.mockResolvedValueOnce(
      snapshot("awaiting_dimensions", {
        dimension_guide_overlay_url: "https://signed.example/guide.png"
      })
    );

    await act(async () => {
      progressCallback?.({
        simulation_job_id: "sim-1",
        status: "awaiting_dimensions",
        progress_step_key: "awaiting_dimensions",
        progress_step_ordinal: 3,
        progress_total_steps: 4,
        visitor_action_required: true,
        guide_available: true,
        latest_result_available: false,
        regeneration_available: false,
        retention_deadline: "2026-05-03T10:00:00.000Z",
        updated_at: "2026-05-02T10:01:00.000Z"
      });
      await flushMicrotasks();
    });

    expect(fetchStatus).toHaveBeenCalledTimes(4);
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent(/mesurez votre pièce/i);
  });
});
