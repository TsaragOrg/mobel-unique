import { describe, expect, it } from "vitest";
import {
  buildAdminSimulationAnalytics,
  parseAdminSimulationAnalyticsQuery,
  type AdminSimulationAnalyticsJobRow,
} from "./admin-simulation-analytics";

const now = new Date("2026-05-18T12:00:00.000Z");

const jobs: AdminSimulationAnalyticsJobRow[] = [
  {
    created_at: "2026-05-17T10:00:00.000Z",
    selected_fabric_id: "fabric-linen",
    selected_sofa_id: "sofa-oslo",
    status: "queued",
  },
  {
    created_at: "2026-05-16T10:00:00.000Z",
    selected_fabric_id: "fabric-linen",
    selected_sofa_id: "sofa-oslo",
    status: "failed",
  },
  {
    created_at: "2026-05-15T10:00:00.000Z",
    selected_fabric_id: "fabric-velvet",
    selected_sofa_id: "sofa-oslo",
    status: "succeeded",
  },
  {
    created_at: "2026-05-14T10:00:00.000Z",
    selected_fabric_id: "fabric-velvet",
    selected_sofa_id: "sofa-lisbon",
    status: "awaiting_dimensions",
  },
  {
    created_at: "2026-05-09T10:00:00.000Z",
    selected_fabric_id: "fabric-cotton",
    selected_sofa_id: "sofa-lisbon",
    status: "expired",
  },
  {
    created_at: "2026-05-17T08:00:00.000Z",
    selected_fabric_id: "fabric-missing",
    selected_sofa_id: "sofa-missing",
    status: "processing",
  },
  {
    created_at: "2026-04-10T10:00:00.000Z",
    selected_fabric_id: "fabric-linen",
    selected_sofa_id: "sofa-archive",
    status: "succeeded",
  },
];

const sofas = [
  {
    id: "sofa-oslo",
    internal_name: "OSLO_INTERNAL",
    public_name: "Canape Oslo",
  },
  {
    id: "sofa-lisbon",
    internal_name: "Lisbon internal",
    public_name: "Canape Lisbon",
  },
  {
    id: "sofa-archive",
    internal_name: "Archived internal",
    public_name: null,
  },
];

const fabrics = [
  {
    id: "fabric-linen",
    internal_name: "Linen internal",
    public_name: "Tissu lin",
  },
  {
    id: "fabric-velvet",
    internal_name: "Velvet internal",
    public_name: "Tissu velours",
  },
  {
    id: "fabric-cotton",
    internal_name: "Tissu coton interne",
    public_name: null,
  },
];

describe("admin simulation analytics", () => {
  it("defaults to last 30 days, counts every created job status, and returns aggregate rankings", () => {
    const analytics = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        limit: 10,
        period: "30d",
        sort: "most",
      },
      sofas,
    });

    expect(analytics.period).toBe("30d");
    expect(analytics.sort).toBe("most");
    expect(analytics.summary).toEqual({
      total_simulations: 6,
      unique_fabrics: 4,
      unique_sofas: 3,
    });
    expect(analytics.sofas).toEqual([
      {
        simulation_count: 3,
        sofa_name: "Canape Oslo",
        top_fabric_name: "Tissu lin",
      },
      {
        simulation_count: 2,
        sofa_name: "Canape Lisbon",
        top_fabric_name: "Tissu coton interne",
      },
      {
        simulation_count: 1,
        sofa_name: "Canapé archivé",
        top_fabric_name: "Tissu archivé",
      },
    ]);
    expect(analytics.fabrics).toEqual([
      {
        fabric_name: "Tissu lin",
        simulation_count: 2,
      },
      {
        fabric_name: "Tissu velours",
        simulation_count: 2,
      },
      {
        fabric_name: "Tissu archivé",
        simulation_count: 1,
      },
      {
        fabric_name: "Tissu coton interne",
        simulation_count: 1,
      },
    ]);
    expect(analytics.combinations[0]).toEqual({
      fabric_name: "Tissu lin",
      simulation_count: 2,
      sofa_name: "Canape Oslo",
    });
  });

  it("applies rolling 7 day, 30 day, and all time periods from created_at", () => {
    const sevenDays = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        period: "7d",
      },
      sofas,
    });
    const thirtyDays = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        period: "30d",
      },
      sofas,
    });
    const allTime = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        period: "all",
      },
      sofas,
    });

    expect(sevenDays.summary.total_simulations).toBe(5);
    expect(thirtyDays.summary.total_simulations).toBe(6);
    expect(allTime.summary.total_simulations).toBe(7);
  });

  it("sorts least simulations first and keeps stable display-name tie breaks", () => {
    const analytics = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        limit: 4,
        period: "30d",
        sort: "least",
      },
      sofas,
    });

    expect(analytics.sofas.map((row) => row.sofa_name)).toEqual([
      "Canapé archivé",
      "Canape Lisbon",
      "Canape Oslo",
    ]);
    expect(analytics.fabrics.map((row) => row.fabric_name)).toEqual([
      "Tissu archivé",
      "Tissu coton interne",
      "Tissu lin",
      "Tissu velours",
    ]);
  });

  it("keeps technical identifiers out of the shaped analytics response", () => {
    const analytics = buildAdminSimulationAnalytics({
      fabrics,
      jobs,
      now,
      query: {
        period: "all",
      },
      sofas,
    });
    const serialized = JSON.stringify(analytics);

    expect(serialized).not.toContain("sofa-oslo");
    expect(serialized).not.toContain("fabric-linen");
    expect(serialized).not.toContain("in_home_simulation_jobs");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("signed");
    expect(serialized).not.toContain("object_path");
  });

  it("validates query parameters before route handlers create a store", () => {
    expect(parseAdminSimulationAnalyticsQuery(new URLSearchParams())).toEqual({
      ok: true,
      value: {
        limit: 10,
        period: "30d",
        sort: "most",
      },
    });
    expect(
      parseAdminSimulationAnalyticsQuery(
        new URLSearchParams("period=90d&sort=most"),
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      parseAdminSimulationAnalyticsQuery(
        new URLSearchParams("period=30d&sort=newest"),
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      parseAdminSimulationAnalyticsQuery(
        new URLSearchParams("period=30d&sort=most&limit=10abc"),
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      parseAdminSimulationAnalyticsQuery(
        new URLSearchParams("period=30d&sort=most&limit=1000"),
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
