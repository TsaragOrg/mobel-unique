/*
RU: Этот файл проверяет рабочий экран лидов в админке. Пользователь видит проверку входа, таблицу email, фильтры, окно заявок и удаление. Здесь можно искать email, менять даты, смотреть заявки и удалять email из записей сайта.
FR: Ce fichier verifie l'ecran de travail des leads dans l'admin. L'utilisateur voit le controle d'entree, le tableau des emails, les filtres, la fenetre des demandes et la suppression. Ici on peut chercher un email, changer les dates, voir les demandes et retirer l'email des traces du site.
*/

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminSimulationLeadsDashboard, {
  type AdminSimulationLeadsDashboardDependencies,
} from "./AdminSimulationLeadsDashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

function createDependencies(
  overrides: Partial<AdminSimulationLeadsDashboardDependencies> = {},
): AdminSimulationLeadsDashboardDependencies {
  return {
    clearTrustedDevice: vi.fn(async () => {}),
    deleteLead: vi.fn(async () => ({
      deleted: true as const,
    })),
    getAccessToken: vi.fn(async () => "admin-token"),
    listLeadJobs: vi.fn(async () => ({
      email: "client@example.com",
      jobs: [
        {
          fabric_name: "Tissu beige",
          preview_image_url:
            "/api/admin/storage-assets/00000000-0000-4000-8000-000000000812/preview?variant=medium",
          private_room_photo: "customer-room/private.png",
          simulation_date: "2026-05-11T10:00:00.000Z",
          sofa_name: "Canape droit",
          status_label: "Terminee",
          visual_position_label: "Vue de face",
        },
        {
          fabric_name: "Tissu archive",
          preview_image_url: null,
          generated_output_url: "outputs/private-result.png",
          simulation_date: "2026-05-10T09:00:00.000Z",
          sofa_name: "Canape archive",
          status_label: "En cours",
          visual_position_label: "Vue cote",
        },
      ],
      matching_job_count: 2,
    })),
    listLeads: vi.fn(async () => ({
      leads: [
        {
          consent_id: "consent-private",
          email: "client@example.com",
          job_id: "job-private",
          last_simulation_at: "2026-05-11T10:00:00.000Z",
          lead_id: "00000000-0000-4000-8000-000000000811",
          matching_job_count: 2,
          session_id: "session-private",
          signed_url: "https://storage.example/signed/private",
          storage_path: "customer-room/private.png",
        },
      ],
      next_cursor: null,
    })),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin simulation leads dashboard", () => {
  it("redirects anonymous visitors through the admin access flow", async () => {
    const dependencies = createDependencies({
      getAccessToken: vi.fn(async () => null),
    });

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);

    await waitFor(() => {
      expect(dependencies.redirect).toHaveBeenCalledWith("/admin/login");
    });
    expect(screen.queryByText("Leads simulation")).not.toBeInTheDocument();
  });

  it("shows the safe forbidden screen for authenticated non-admin users", async () => {
    const dependencies = createDependencies({
      verifyAdminSession: vi.fn(async () => ({
        ok: false,
        status: 403,
      })),
    });

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);

    await screen.findByRole("heading", {
      name: "Accès admin indisponible",
    });
    expect(screen.queryByText("Leads simulation")).not.toBeInTheDocument();
  });

  it("shows empty retained, date-filtered, and exact-email states", async () => {
    const dependencies = createDependencies({
      listLeads: vi
        .fn()
        .mockResolvedValueOnce({
          leads: [],
          next_cursor: null,
        })
        .mockResolvedValueOnce({
          leads: [],
          next_cursor: null,
        })
        .mockResolvedValueOnce({
          leads: [],
          next_cursor: null,
        }),
    });

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);

    await screen.findByText("Aucun lead conservé.");
    fireEvent.click(screen.getByRole("button", { name: "Dernier jour" }));
    await screen.findByText("Aucun lead pour ce filtre.");
    fireEvent.change(screen.getByLabelText("Email exact"), {
      target: { value: " CLIENT@EXAMPLE.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await screen.findByText("Aucun lead pour cet email.");
  });

  it("shows safe lead rows and never displays private ids or artifact paths", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);

    await screen.findByText("client@example.com");
    expect(screen.getByText("11/05/2026 10:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 jobs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer client@example.com" })).toBeInTheDocument();

    const pageText = document.body.textContent ?? "";
    expect(pageText).not.toContain("00000000-0000-4000-8000-000000000811");
    expect(pageText).not.toContain("consent-private");
    expect(pageText).not.toContain("session-private");
    expect(pageText).not.toContain("customer-room");
    expect(pageText).not.toContain("signed");
  });

  it("reloads with date filters, sorting, and normalized exact email search", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);
    await screen.findByText("client@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Dernier jour" }));
    fireEvent.click(screen.getByRole("button", { name: "Dernière semaine" }));
    fireEvent.click(screen.getByRole("button", { name: "Dernier mois" }));
    fireEvent.change(screen.getByLabelText("Début"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer les dates" }));
    fireEvent.change(screen.getByLabelText("Tri"), {
      target: { value: "oldest" },
    });
    fireEvent.change(screen.getByLabelText("Email exact"), {
      target: { value: " CLIENT@EXAMPLE.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.click(screen.getByRole("button", { name: "Effacer" }));

    await waitFor(() => {
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ range: "day" }),
      );
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ range: "week" }),
      );
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ range: "month" }),
      );
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          from: "2026-05-01",
          to: "2026-05-10",
        }),
      );
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ sort: "oldest" }),
      );
      expect(dependencies.listLeads).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ email: "client@example.com" }),
      );
    });
  });

  it("opens one centered jobs dialog with safe catalog previews and closes it by button or Escape", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);
    fireEvent.click(await screen.findByRole("button", { name: "2 jobs" }));

    const dialog = await screen.findByRole("dialog", {
      name: "client@example.com - 2 jobs",
    });
    expect(dialog.parentElement).toHaveClass("admin-leads-dialog-scrim");
    expect(dialog).toHaveClass("admin-leads-dialog");
    expect(dependencies.listLeadJobs).toHaveBeenCalledWith(
      "admin-token",
      "00000000-0000-4000-8000-000000000811",
      expect.any(Object),
    );
    expect(
      within(dialog).getByAltText("Canape droit - Tissu beige - Vue de face"),
    ).toHaveAttribute(
      "src",
      "/api/admin/storage-assets/00000000-0000-4000-8000-000000000812/preview?variant=medium",
    );
    expect(within(dialog).getByText("Canape archive")).toBeInTheDocument();
    expect(within(dialog).getByText("Aucun aperçu")).toBeInTheDocument();
    expect(within(dialog).getByText("En cours")).toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toContain("customer-room");
    expect(dialog.textContent ?? "").not.toContain("private-result");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "2 jobs" }));
    const reopened = await screen.findByRole("dialog");
    fireEvent.click(within(reopened).getByRole("button", { name: "Fermer" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows a safe jobs dialog error when loading fails", async () => {
    const dependencies = createDependencies({
      listLeadJobs: vi.fn(async () => {
        throw new Error("SQL storage path stack trace");
      }),
    });

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);
    fireEvent.click(await screen.findByRole("button", { name: "2 jobs" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Impossible de charger les demandes.")).toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toMatch(/SQL|storage|stack/i);
  });

  it("confirms, cancels, deletes, and removes stale leads without showing technical ids", async () => {
    const dependencies = createDependencies();

    render(<AdminSimulationLeadsDashboard dependencies={dependencies} />);
    await screen.findByText("client@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Supprimer client@example.com" }));
    expect(
      screen.getByText(
        "Retirer cet email du tableau et des traces email du site ?",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByText("client@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer client@example.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    await waitFor(() => {
      expect(dependencies.deleteLead).toHaveBeenCalledWith(
        "admin-token",
        "00000000-0000-4000-8000-000000000811",
      );
      expect(screen.queryByText("client@example.com")).not.toBeInTheDocument();
    });
    expect(document.body.textContent ?? "").not.toContain(
      "00000000-0000-4000-8000-000000000811",
    );
  });
});
