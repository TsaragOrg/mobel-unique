/*
RU: Этот файл проверяет страницу лидов в админке. Пользователь видит закрытую страницу со списком заявок после входа. Здесь можно убедиться, что страница закрыта для поиска и открывает нужный экран.
FR: Ce fichier verifie la page des leads dans l'admin. L'utilisateur voit une page protegee avec la liste apres l'entree. Ici on verifie que la page reste fermee aux moteurs et ouvre le bon ecran.
*/

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminLeadsPage, { metadata } from "./page";

vi.mock("./AdminSimulationLeadsDashboard", () => ({
  default: () => <div>Tableau des leads simulation</div>,
}));

describe("Admin leads page", () => {
  it("keeps noindex metadata for the protected route", () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false,
    });
    expect(metadata.title).toBe("Leads simulation | Mobel Unique");
  });

  it("uses the admin simulation leads dashboard", () => {
    render(<AdminLeadsPage />);

    expect(screen.getByText("Tableau des leads simulation")).toBeInTheDocument();
  });
});
