import { describe, expect, it } from "vitest";
import {
  buildSofaEditTabReadiness,
  getPublicationBlockerTarget,
  getRenderCellDisplayStatus,
  getRenderCellPrimaryAction,
} from "./admin-sofa-edit-model";

describe("admin sofa edit model", () => {
  it("maps render cells to SPEC-0014 display statuses", () => {
    expect(
      getRenderCellDisplayStatus({
        blockers: ["SOURCE_PHOTO_MISSING"],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: null,
      }),
    ).toBe("blocked");

    expect(
      getRenderCellDisplayStatus({
        blockers: ["ACTIVE_RENDER_JOB_EXISTS"],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: { status: "queued" },
      }),
    ).toBe("queued");

    expect(
      getRenderCellDisplayStatus({
        blockers: ["SOURCE_PHOTO_RENDER_COMPLETE"],
        candidate_count: 0,
        has_private_render: true,
        has_public_render: false,
        latest_job: null,
      }),
    ).toBe("ready");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: { status: "processing" },
      }),
    ).toBe("processing");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 2,
        has_private_render: false,
        has_public_render: false,
        latest_job: null,
      }),
    ).toBe("candidate");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 0,
        has_private_render: true,
        has_public_render: false,
        latest_job: { status: "failed" },
      }),
    ).toBe("ready");

    expect(
      getRenderCellDisplayStatus({
        blockers: [],
        candidate_count: 0,
        has_private_render: false,
        has_public_render: false,
        latest_job: { status: "failed" },
      }),
    ).toBe("failed");
  });

  it("selects the primary render cell action", () => {
    expect(getRenderCellPrimaryAction("blocked")).toMatchObject({
      label: "Go to Visual matrix",
      targetTab: "visual_matrix",
    });
    expect(getRenderCellPrimaryAction("missing")).toMatchObject({
      label: "Generate",
    });
    expect(getRenderCellPrimaryAction("candidate")).toMatchObject({
      label: "Review candidates",
    });
    expect(getRenderCellPrimaryAction("ready")).toMatchObject({
      label: "View current render",
    });
    expect(getRenderCellPrimaryAction("queued")).toBeNull();
    expect(getRenderCellPrimaryAction("processing")).toBeNull();
    expect(getRenderCellPrimaryAction("failed")).toMatchObject({
      label: "Retry generation",
    });
  });

  it("builds tab readiness from sofa edit data", () => {
    expect(
      buildSofaEditTabReadiness({
        publicationReadiness: { ready: false },
        renderCells: [
          {
            blockers: ["SOURCE_PHOTO_MISSING"],
            candidate_count: 0,
            has_private_render: false,
            has_public_render: false,
            latest_job: null,
          },
        ],
        sofa: { internal_name: "" },
        sofaFabrics: [
          {
            fabric: {
              ai_reference_asset: null,
            },
          },
        ],
        visualMatrixColumns: [
          {
            current_source_photo_id: null,
          },
        ],
      }),
    ).toEqual({
      basics: "missing",
      fabrics: "blocked",
      publish: "blocked",
      renders: "blocked",
      visual_matrix: "partial",
    });

    expect(
      buildSofaEditTabReadiness({
        publicationReadiness: { ready: true },
        renderCells: [
          {
            blockers: [],
            candidate_count: 0,
            has_private_render: true,
            has_public_render: false,
            latest_job: null,
          },
        ],
        sofa: { internal_name: "Internal sofa" },
        sofaFabrics: [
          {
            fabric: {
              ai_reference_asset: { id: "asset-id" },
            },
          },
        ],
        visualMatrixColumns: [
          {
            current_source_photo_id: "source-photo-id",
          },
        ],
      }),
    ).toEqual({
      basics: "ready",
      fabrics: "ready",
      publish: "ready",
      renders: "ready",
      visual_matrix: "ready",
    });

    expect(
      buildSofaEditTabReadiness({
        publicationReadiness: { ready: false },
        renderCells: null,
        sofa: { internal_name: "Internal sofa" },
        sofaFabrics: [],
        visualMatrixColumns: [],
      }).renders,
    ).toBe("missing");
  });

  it("maps publication blockers to the tab that can fix them", () => {
    expect(getPublicationBlockerTarget("MISSING_PUBLIC_FABRIC")).toBe(
      "fabrics",
    );
    expect(getPublicationBlockerTarget("MISSING_SOURCE_PHOTO")).toBe(
      "visual_matrix",
    );
    expect(
      getPublicationBlockerTarget("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).toBe("renders");
    expect(getPublicationBlockerTarget("MISSING_PUBLIC_NAME")).toBe("basics");
  });
});
