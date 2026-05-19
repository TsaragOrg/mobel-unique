/*
RU: Этот файл проверяет экран результата симуляции.
RU: В проверках видны картинка результата, кнопки и ссылки.
RU: Здесь проверяется, что посетитель может скачать картинку, запустить новую генерацию, вернуться к дивану и перейти к покупке.
FR: Ce fichier verifie l'ecran du resultat de simulation.
FR: Dans les verifications, on voit l'image du resultat, les boutons et les liens.
FR: Ici, on verifie que le visiteur peut telecharger l'image, lancer une nouvelle generation, revenir au canape et aller acheter.
*/

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Screen5Result } from "../Screen5Result";

afterEach(cleanup);

// RU: Эти данные дают проверкам обычный успешный результат.
// FR: Ces donnees donnent aux verifications un resultat reussi simple.
const baseProps = {
  jobId: "sim-1",
  sofaName: "Canapé Rivoli",
  fabricName: "Bouclette",
  visualPositionLabel: "Vue de face",
  resultImageUrl: "https://signed.example/output-1.png",
  backToSofaHref: "/sofas/canape-rivoli",
  generationCount: 1,
  onResultImageError: vi.fn(),
  onRegenerationStarted: vi.fn()
};

// RU: Эти типы описывают действия, которые проверки заменяют быстрыми ответами.
// FR: Ces types decrivent les actions que les verifications remplacent par des reponses rapides.
type RegenerateFn = (
  jobId: string
) => Promise<{ ok: true } | { ok: false; message?: string }>;
type DownloadFn = (input: {
  filename: string;
  imageUrl: string;
}) => Promise<{ ok: true } | { ok: false; message?: string }>;

describe("Screen5Result", () => {
  it("shows the result image and compact action panel metadata", () => {
    render(
      <Screen5Result
        {...baseProps}
        generationCount={2}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(screen.getByText("Résultat")).toBeInTheDocument();
    expect(screen.getByText("Génération 2 sur 3")).toBeInTheDocument();
    expect(screen.getByAltText(/votre canapé placé/i)).toHaveAttribute(
      "src",
      "https://signed.example/output-1.png"
    );
  });

  it("always shows the muted retention notice", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.getByText(/sera supprimée automatiquement dans 24 heures/i)
    ).toBeInTheDocument();
  });

  it("renders the regeneration button when regeneration_available is true", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.getByRole("button", { name: /nouvelle génération/i })
    ).toBeInTheDocument();
  });

  it("downloads the result image through a button without rendering a signed download link", async () => {
    const downloadResult = vi.fn<DownloadFn>(async () => ({ ok: true }));
    render(
      <Screen5Result
        {...baseProps}
        downloadResult={downloadResult}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.queryByRole("link", { name: /télécharger l'image/i })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /télécharger l'image/i })
    );
    expect(
      screen.getByRole("button", { name: /téléchargement en cours/i })
    ).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(downloadResult).toHaveBeenCalledWith({
      filename: "mobel-unique-simulation-sim-1.png",
      imageUrl: "https://signed.example/output-1.png"
    });
  });

  it("shows the order CTA as a secondary link when a valid order URL is available", () => {
    const propsWithOrder = {
      ...baseProps,
      orderHref: "https://shopify.example/products/canape-rivoli"
    };

    const { container } = render(
      <Screen5Result
        {...propsWithOrder}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    const orderLink = screen.getByRole("link", { name: "Commander" });
    expect(orderLink).toHaveAttribute(
      "href",
      "https://shopify.example/products/canape-rivoli"
    );
    expect(orderLink).toHaveClass("public-secondary-link");
    expect(container.textContent).not.toContain("https://signed.example/output-1.png");
  });

  it("hides the order CTA when the order URL is invalid", () => {
    const propsWithInvalidOrder = {
      ...baseProps,
      orderHref: "javascript:alert(1)"
    };

    render(
      <Screen5Result
        {...propsWithInvalidOrder}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(screen.queryByRole("link", { name: "Commander" })).not.toBeInTheDocument();
  });

  it("shows an inline download error when result image download fails", async () => {
    render(
      <Screen5Result
        {...baseProps}
        downloadResult={vi.fn<DownloadFn>(async () => ({
          ok: false,
          message: "boom"
        }))}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /télécharger l'image/i })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /téléchargement n'a pas abouti/i
    );
  });

  it("removes the regeneration button from the DOM (not just disabled) when unavailable", () => {
    render(
      <Screen5Result
        {...baseProps}
        regenerationAvailable={false}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    expect(
      screen.queryByRole("button", { name: /nouvelle génération/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/limite de générations atteinte/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /retour au canapé/i })
    ).toHaveAttribute("href", "/sofas/canape-rivoli");
  });

  it("triggers onResultImageError when the result image fails to load", () => {
    const onResultImageError = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onResultImageError={onResultImageError}
        regenerationAvailable={true}
        requestRegeneration={vi.fn<RegenerateFn>(async () => ({ ok: true }))}
      />
    );

    fireEvent.error(screen.getByAltText(/votre canapé placé/i));

    expect(onResultImageError).toHaveBeenCalledTimes(1);
  });

  it("calls requestRegeneration and notifies the parent on a successful regeneration", async () => {
    const requestRegeneration = vi.fn<RegenerateFn>(async () => ({ ok: true }));
    const onRegenerationStarted = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onRegenerationStarted={onRegenerationStarted}
        regenerationAvailable={true}
        requestRegeneration={requestRegeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /nouvelle génération/i }));
    expect(
      screen.getByRole("button", { name: /nouvelle génération en cours/i })
    ).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(requestRegeneration).toHaveBeenCalledWith("sim-1");
    expect(onRegenerationStarted).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/n'a pas abouti/i)
    ).not.toBeInTheDocument();
  });

  it("shows the inline regeneration-failed message after a failed regeneration", async () => {
    const requestRegeneration = vi.fn<RegenerateFn>(async () => ({
      ok: false,
      message: "boom"
    }));
    const onRegenerationStarted = vi.fn();
    render(
      <Screen5Result
        {...baseProps}
        onRegenerationStarted={onRegenerationStarted}
        regenerationAvailable={true}
        requestRegeneration={requestRegeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /nouvelle génération/i }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.getByRole("alert")).toHaveTextContent(/n'a pas abouti/i);
    expect(onRegenerationStarted).not.toHaveBeenCalled();
  });
});
