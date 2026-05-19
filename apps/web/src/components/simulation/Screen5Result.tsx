"use client";

/*
RU: Этот файл нужен для финального экрана симуляции.
RU: На экране посетитель видит готовую картинку комнаты, счетчик попыток и действия.
RU: Здесь можно скачать картинку, запустить новую генерацию, вернуться к дивану или перейти к покупке.
FR: Ce fichier sert a l'ecran final de la simulation.
FR: A l'ecran, le visiteur voit l'image terminee de la piece, le compteur d'essais et les actions.
FR: Ici, on peut telecharger l'image, lancer une nouvelle generation, revenir au canape ou aller acheter.
*/

import { useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

type RegenerateOutcome = { ok: true } | { ok: false; message?: string };
type DownloadOutcome = { ok: true } | { ok: false; message?: string };

export interface Screen5ResultProps {
  jobId: string;
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  resultImageUrl: string;
  backToSofaHref: string;
  orderHref?: string | null;
  generationCount: number;
  regenerationAvailable: boolean;
  onResultImageError: () => void;
  onRegenerationStarted: () => void;
  requestRegeneration?: (jobId: string) => Promise<RegenerateOutcome>;
  downloadResult?: (input: {
    filename: string;
    imageUrl: string;
  }) => Promise<DownloadOutcome>;
}

const GENERATION_LIMIT = 3;

export function Screen5Result(props: Screen5ResultProps) {
  // RU: Эти значения берут тексты и действия для экрана результата.
  // FR: Ces valeurs prennent les textes et les actions pour l'ecran du resultat.
  const copy = SIMULATION_LOCALE.screen5Result;
  const requestRegeneration =
    props.requestRegeneration ?? defaultRequestRegeneration;
  const downloadResult = props.downloadResult ?? defaultDownloadResult;
  const validOrderHref = isValidHttpUrl(props.orderHref)
    ? props.orderHref
    : null;

  // RU: Эти значения показывают, занята ли кнопка, и нужно ли показать ошибку.
  // FR: Ces valeurs indiquent si un bouton est occupe et si une erreur doit etre montree.
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showRegenError, setShowRegenError] = useState(false);
  const [showDownloadError, setShowDownloadError] = useState(false);

  // RU: Это действие просит новую картинку для той же симуляции.
  // FR: Cette action demande une nouvelle image pour la meme simulation.
  async function onRegenerate() {
    if (submitting) return;
    setSubmitting(true);
    setShowRegenError(false);
    setShowDownloadError(false);
    const outcome = await requestRegeneration(props.jobId);
    setSubmitting(false);
    if (outcome.ok) {
      props.onRegenerationStarted();
      return;
    }
    setShowRegenError(true);
  }

  // RU: Это действие скачивает готовую картинку на устройство посетителя.
  // FR: Cette action telecharge l'image terminee sur l'appareil du visiteur.
  async function onDownload() {
    if (downloading) return;
    setDownloading(true);
    setShowDownloadError(false);
    const outcome = await downloadResult({
      filename: `mobel-unique-simulation-${props.jobId}.png`,
      imageUrl: props.resultImageUrl
    });
    setDownloading(false);
    if (!outcome.ok) {
      setShowDownloadError(true);
    }
  }

  return (
    <section className="simulation-result-screen">
      <SimulationContextStrip
        sofaName={props.sofaName}
        fabricName={props.fabricName}
        visualPositionLabel={props.visualPositionLabel}
      />

      <header className="simulation-result-heading">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
      </header>

      <div className="simulation-result-workspace">
        <figure className="simulation-result-image">
          <img
            alt={copy.resultImageAlt}
            onError={props.onResultImageError}
            src={props.resultImageUrl}
          />
        </figure>

        <aside className="simulation-result-panel">
          <div className="simulation-result-panel-heading">
            <p className="simulation-result-panel-label">{copy.panelLabel}</p>
            <p className="simulation-result-count">
              {formatGenerationCount(copy.generationCountLabel, props.generationCount)}
            </p>
          </div>

          {showRegenError ? (
            <p className="simulation-result-error" role="alert">
              {copy.regenerationFailedNotice}
            </p>
          ) : null}

          {showDownloadError ? (
            <p className="simulation-result-error" role="alert">
              {copy.downloadFailedNotice}
            </p>
          ) : null}

          {!props.regenerationAvailable ? (
            <p className="simulation-result-limit">
              {copy.regenerationLimitNotice}
            </p>
          ) : null}

          {/* RU: Этот большой блок показывает действия после готовой симуляции. */}
          {/* FR: Ce grand bloc montre les actions apres la simulation terminee. */}
          <div className="simulation-result-actions">
            {props.regenerationAvailable ? (
              <button
                className="public-primary-button"
                disabled={submitting}
                onClick={() => void onRegenerate()}
                type="button"
              >
                {submitting ? copy.regeneratingButton : copy.regenerateButton}
              </button>
            ) : null}
            <button
              className="public-secondary-button"
              disabled={downloading}
              onClick={() => void onDownload()}
              type="button"
            >
              {downloading ? copy.downloadingButton : copy.downloadButton}
            </button>
            {validOrderHref ? (
              <a
                className="public-secondary-link"
                href={validOrderHref}
                rel="noreferrer"
              >
                {copy.orderLink}
              </a>
            ) : null}
            <a
              className={
                props.regenerationAvailable
                  ? "public-secondary-link"
                  : "public-primary-link"
              }
              href={props.backToSofaHref}
            >
              {copy.backToSofaLink}
            </a>
          </div>

          <p className="simulation-result-retention">{copy.retentionNotice}</p>
        </aside>
      </div>
    </section>
  );
}

function formatGenerationCount(template: string, generationCount: number) {
  const current = Math.max(1, Math.min(generationCount, GENERATION_LIMIT));
  return template
    .replace("{current}", String(current))
    .replace("{total}", String(GENERATION_LIMIT));
}

function isValidHttpUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function defaultDownloadResult(input: {
  filename: string;
  imageUrl: string;
}): Promise<DownloadOutcome> {
  try {
    const response = await fetch(input.imageUrl, { credentials: "omit" });
    if (!response.ok) {
      return { ok: false };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = input.filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

async function defaultRequestRegeneration(
  jobId: string
): Promise<RegenerateOutcome> {
  try {
    const response = await fetch(
      `/api/public/simulations/${encodeURIComponent(jobId)}/regenerations`,
      {
        credentials: "include",
        method: "POST"
      }
    );
    if (response.ok) {
      return { ok: true };
    }
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, message: payload?.error?.message };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
