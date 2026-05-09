"use client";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

export interface Screen2RoomPrepProps {
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
  progressLabel?: string | null;
  reassurance?: string | null;
  title?: string | null;
}

export function Screen2RoomPrep(props: Screen2RoomPrepProps) {
  const copy = SIMULATION_LOCALE.screen2RoomPrep;
  const title = props.title ?? copy.title;
  const reassurance = props.reassurance ?? copy.reassurance;
  return (
    <section className="simulation-status-screen" aria-live="polite">
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
        <h1>{title}</h1>
        {props.progressLabel ? (
          <p className="simulation-status-progress">{props.progressLabel}</p>
        ) : null}
        <p className="simulation-status-reassurance">{reassurance}</p>
      </div>
    </section>
  );
}
