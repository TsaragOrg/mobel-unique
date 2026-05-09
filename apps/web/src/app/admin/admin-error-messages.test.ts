import { describe, expect, it } from "vitest";
import {
  formatAdminErrorMessage,
  formatAdminPublicationBlockerLabel,
  formatRenderCellBlockerLabel,
} from "./admin-error-messages";

describe("admin error messages", () => {
  it("turns known technical error codes into customer-facing messages", () => {
    expect(formatAdminErrorMessage("TAG_CONFLICT")).toBe(
      "A tag with this label or slug already exists.",
    );
    expect(formatAdminErrorMessage(new Error("TAG_IN_USE"))).toBe(
      "This tag is already assigned to a sofa, so it cannot be deleted.",
    );
    expect(formatAdminErrorMessage("REFINE_PROMPT_REQUIRED")).toBe(
      "Write what should be improved before starting refinement.",
    );
    expect(
      formatAdminErrorMessage("FABRIC_RENDER_SOFA_PROCESSING_CONFLICT"),
    ).toBe(
      "Another image generation is already running. Wait for it to finish before resuming a queued cell.",
    );
  });

  it("hides unknown technical codes behind a generic message", () => {
    expect(formatAdminErrorMessage("SOFA_LIST_FAILED")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("keeps normal sentences from the server", () => {
    expect(
      formatAdminErrorMessage(new Error("Catalog service is unavailable.")),
    ).toBe("Catalog service is unavailable.");
  });

  it("labels publication blockers without exposing their codes", () => {
    expect(formatAdminPublicationBlockerLabel("MISSING_PUBLIC_FABRIC")).toBe(
      "No public fabric yet",
    );
    expect(
      formatAdminPublicationBlockerLabel("INCOMPLETE_PUBLIC_RENDER_COVERAGE"),
    ).toBe("Missing public renders");
  });

  it("labels render cell blockers without exposing their codes", () => {
    expect(formatRenderCellBlockerLabel("MISSING_SOURCE_PHOTO")).toBe(
      "Source photo missing",
    );
    expect(formatRenderCellBlockerLabel("SOURCE_PHOTO_MISSING")).toBe(
      "Source photo missing",
    );
    expect(formatRenderCellBlockerLabel("MISSING_FABRIC_AI_REFERENCE")).toBe(
      "Fabric reference image missing",
    );
  });
});
