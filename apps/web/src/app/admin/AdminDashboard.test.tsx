/*
RU: Этот файл проверяет первый экран админки. Пользователь видит проверку доступа, отказ или рабочую панель. Здесь мы убеждаемся, что ссылки и выход ведут себя правильно.
FR: Ce fichier verifie le premier ecran admin. L'utilisateur voit le controle d'acces, un refus ou le panneau de travail. Ici nous verifions que les liens et la sortie restent corrects.
*/

import { render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.queryByText("Tableau de bord admin")).not.toBeInTheDocument();
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
      name: "Accès admin indisponible",
    });
    expect(screen.queryByText("Tableau de bord admin")).not.toBeInTheDocument();
  });

  it("renders protected admin content only after the first-party session facade succeeds", async () => {
    const dependencies = createDependencies({});

    render(<AdminDashboard dependencies={dependencies} />);

    await screen.findByRole("heading", {
      name: "Tableau de bord admin",
    });
    expect(dependencies.verifyAdminSession).toHaveBeenCalledWith("admin-token");
    expect(screen.getAllByText("MOBEL UNIQUE").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("navigation", {
        name: "Administration",
      }),
    ).toBeInTheDocument();
    const catalogActions = screen.getByRole("navigation", {
      name: "Actions du catalogue",
    });
    const actionIcons = catalogActions.querySelectorAll(".admin-action-icon");

    expect(
      within(catalogActions).getByRole("link", { name: "Canapés" }),
    ).toHaveAttribute("href", "/admin/sofas");
    expect(
      within(catalogActions).getByRole("link", { name: "Nouveau canapé" }),
    ).toHaveAttribute("href", "/admin/sofas/new");
    expect(
      within(catalogActions).getByRole("link", { name: "Étiquettes" }),
    ).toHaveAttribute("href", "/admin/tags");
    expect(
      within(catalogActions).getByRole("link", { name: "Tissus" }),
    ).toHaveAttribute("href", "/admin/fabrics");
    expect(
      within(catalogActions).queryByRole("link", { name: "Leads simulation" }),
    ).not.toBeInTheDocument();
    expect(actionIcons).toHaveLength(4);
    for (const icon of actionIcons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});
