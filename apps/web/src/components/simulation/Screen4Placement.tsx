"use client";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

export interface Screen4PlacementProps {
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  previousResultImageUrl?: string | null;
}

export function Screen4Placement(props: Screen4PlacementProps) {
  const copy = SIMULATION_LOCALE.screen4Placement;
  const isRegeneration = Boolean(props.previousResultImageUrl);

  if (isRegeneration && props.previousResultImageUrl) {
    return (
      <section
        aria-live="polite"
        className="simulation-placement-regeneration"
      >
        <SimulationContextStrip
          sofaName={props.sofaName}
          fabricName={props.fabricName}
          visualPositionLabel={props.visualPositionLabel}
        />
        <div
          className="simulation-placement-regeneration-canvas"
          data-testid="simulation-placement-regeneration"
        >
          <img
            alt={SIMULATION_LOCALE.screen5Result.resultImageAlt}
            src={props.previousResultImageUrl}
          />
          <div
            aria-hidden="true"
            className="simulation-placement-regeneration-overlay"
          />
          <div className="simulation-placement-regeneration-indicator">
            <span
              aria-hidden="true"
              className="simulation-status-spinner"
              data-testid="simulation-status-spinner"
            />
            <span>{copy.titleRegeneration}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      className="simulation-status-screen"
      data-testid="simulation-placement-initial"
    >
      <SimulationContextStrip
        sofaName={props.sofaName}
        fabricName={props.fabricName}
        visualPositionLabel={props.visualPositionLabel}
      />
      <div className="simulation-status-body">
        <span
          aria-hidden="true"
          className="simulation-status-spinner"
          data-testid="simulation-status-spinner"
        />
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.titleInitial}</h1>
        <p className="simulation-status-reassurance">{copy.reassuranceInitial}</p>
      </div>
    </section>
  );
}
