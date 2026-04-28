import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminDashboard, {
  type AdminDashboardDependencies,
} from "./AdminDashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

function createDependencies(
  overrides: Partial<AdminDashboardDependencies>,
): AdminDashboardDependencies {
  return {
    clearTrustedDevice: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => "admin-token"),
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

describe("Admin dashboard", () => {
  it("redirects anonymous visitors without rendering protected admin content", async () => {
    const dependencies = createDependencies({
      getAccessToken: vi.fn(async () => null),
    });

    render(<AdminDashboard dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.redirect).toHaveBeenCalledWith("/admin/login");
    });
    expect(screen.queryByText("Admin dashboard")).not.toBeInTheDocument();
  });

  it("fails closed for authenticated non-admin users", async () => {
    const dependencies = createDependencies({
      verifyAdminSession: vi.fn(async () => ({
        ok: false,
        status: 403,
      })),
    });

    render(<AdminDashboard dependencies={dependencies} />);

    await screen.findByRole("heading", {
      name: "Admin access unavailable",
    });
    expect(screen.queryByText("Admin dashboard")).not.toBeInTheDocument();
  });

  it("renders protected admin content only after the first-party session facade succeeds", async () => {
    const dependencies = createDependencies({});

    render(<AdminDashboard dependencies={dependencies} />);

    await screen.findByRole("heading", {
      name: "Admin dashboard",
    });
    expect(dependencies.verifyAdminSession).toHaveBeenCalledWith("admin-token");
    expect(screen.getByRole("link", { name: "Sofas" })).toHaveAttribute(
      "href",
      "/admin/sofas",
    );
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute(
      "href",
      "/admin/tags",
    );
    expect(screen.getByRole("link", { name: "Fabrics" })).toHaveAttribute(
      "href",
      "/admin/fabrics",
    );
  });
});
