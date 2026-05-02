"use client";

import { useState } from "react";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

type RegenerateOutcome = { ok: true } | { ok: false; message?: string };

export interface Screen5ResultProps {
  jobId: string;
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  resultImageUrl: string;
  backToSofaHref: string;
  regenerationAvailable: boolean;
  onResultImageError: () => void;
  onRegenerationStarted: () => void;
  requestRegeneration?: (jobId: string) => Promise<RegenerateOutcome>;
}

export function Screen5Result(props: Screen5ResultProps) {
  const copy = SIMULATION_LOCALE.screen5Result;
  const requestRegeneration =
    props.requestRegeneration ?? defaultRequestRegeneration;

  const [submitting, setSubmitting] = useState(false);
  const [showRegenError, setShowRegenError] = useState(false);

  async function onRegenerate() {
    if (submitting) return;
    setSubmitting(true);
    setShowRegenError(false);
    const outcome = await requestRegeneration(props.jobId);
    setSubmitting(false);
    if (outcome.ok) {
      props.onRegenerationStarted();
      return;
    }
    setShowRegenError(true);
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

      <div className="simulation-result-image">
        <img
          alt={copy.resultImageAlt}
          onError={props.onResultImageError}
          src={props.resultImageUrl}
        />
      </div>

      {showRegenError ? (
        <p className="simulation-result-error" role="alert">
          {copy.regenerationFailedNotice}
        </p>
      ) : null}

      <div className="simulation-result-actions">
        {props.regenerationAvailable ? (
          <button
            className="public-primary-button"
            disabled={submitting}
            onClick={() => void onRegenerate()}
            type="button"
          >
            {copy.regenerateButton}
          </button>
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
    </section>
  );
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
