import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AdminSimulationAnalytics,
  AdminSimulationAnalyticsQuery,
} from "../../lib/admin-simulation-analytics";
import AdminSimulationAnalyticsPage, {
  type AdminSimulationAnalyticsPageDependencies,
} from "./AdminSimulationAnalyticsPage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const analytics: AdminSimulationAnalytics = {
  combinations: [
    {
      fabric_name: "Tissu lin",
      simulation_count: 4,
      sofa_name: "Canape Oslo",
    },
  ],
  fabrics: [
    {
      fabric_name: "Tissu lin",
      simulation_count: 7,
    },
  ],
  period: "30d",
  sofas: [
    {
      simulation_count: 9,
      sofa_name: "Canape Oslo",
      top_fabric_name: "Tissu lin",
    },
  ],
  sort: "most",
  summary: {
    total_simulations: 12,
    unique_fabrics: 3,
    unique_sofas: 4,
  },
};

function createDependencies(
  overrides: Partial<AdminSimulationAnalyticsPageDependencies> = {},
): AdminSimulationAnalyticsPageDependencies {
  return {
    clearTrustedDevice: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => "admin-token"),
    getSimulationAnalytics: vi.fn(
      async (_accessToken: string, query: AdminSimulationAnalyticsQuery) => ({
        ...analytics,
        period: query.period,
        sort: query.sort,
      }),
    ),
    redirect: vi.fn(),
    refreshAccessToken: vi.fn(async () => null),
    signOut: vi.fn(async () => {}),
    verifyAdminSession: vi.fn(async () => ({
      ok: true,
      status: 200,
    })),
    ...overrides,
  };
}

describe("Admin simulation analytics page", () => {
  it("redirects anonymous visitors without loading analytics", async () => {
    const dependencies = createDependencies({
      getAccessToken: vi.fn(async () => null),
    });

    render(<AdminSimulationAnalyticsPage dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.redirect).toHaveBeenCalledWith("/admin/login");
    });
    expect(dependencies.getSimulationAnalytics).not.toHaveBeenCalled();
    expect(screen.queryByText("Simulations")).not.toBeInTheDocument();
  });

  it("loads last 30 days by default and renders aggregate-only simulation rankings", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationAnalyticsPage dependencies={dependencies} />);

    await screen.findByRole("heading", {
      name: "Simulations",
    });
    await screen.findByRole("heading", {
      name: "Canapés simulés",
    });

    expect(dependencies.verifyAdminSession).toHaveBeenCalledWith(
      "admin-token",
    );
    expect(dependencies.getSimulationAnalytics).toHaveBeenCalledWith(
      "admin-token",
      {
        limit: 10,
        period: "30d",
        sort: "most",
      },
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("Canape Oslo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tissu lin").length).toBeGreaterThan(0);
    expect(screen.getByText("Associations canapé + tissu")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("00000000-0000");
    expect(document.body.textContent).not.toContain("email");
    expect(document.body.textContent).not.toContain("object_path");
  });

  it("reloads analytics when period and sort controls change", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationAnalyticsPage dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.getSimulationAnalytics).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "7 jours" }));

    await waitFor(() => {
      expect(dependencies.getSimulationAnalytics).toHaveBeenLastCalledWith(
        "admin-token",
        {
          limit: 10,
          period: "7d",
          sort: "most",
        },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Moins simulés" }));

    await waitFor(() => {
      expect(dependencies.getSimulationAnalytics).toHaveBeenLastCalledWith(
        "admin-token",
        {
          limit: 10,
          period: "7d",
          sort: "least",
        },
      );
    });
  });

  it("renders empty and safe error states", async () => {
    const emptyDependencies = createDependencies({
      getSimulationAnalytics: vi.fn(async () => ({
        ...analytics,
        combinations: [],
        fabrics: [],
        sofas: [],
        summary: {
          total_simulations: 0,
          unique_fabrics: 0,
          unique_sofas: 0,
        },
      })),
    });

    const { unmount } = render(
      <AdminSimulationAnalyticsPage dependencies={emptyDependencies} />,
    );

    expect(
      await screen.findByText(
        "Aucune simulation n'a été trouvée pour cette période.",
      ),
    ).toBeInTheDocument();

    unmount();

    const failingDependencies = createDependencies({
      getSimulationAnalytics: vi.fn(async () => {
        throw new Error("ANALYTICS_UNAVAILABLE");
      }),
    });

    render(<AdminSimulationAnalyticsPage dependencies={failingDependencies} />);

    expect(
      await screen.findByText(
        "Les statistiques des simulations sont indisponibles.",
      ),
    ).toBeInTheDocument();
  });
});
