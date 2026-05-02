"use client";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

export interface Screen2RoomPrepProps {
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
}

export function Screen2RoomPrep(props: Screen2RoomPrepProps) {
  const copy = SIMULATION_LOCALE.screen2RoomPrep;
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
        <h1>{copy.title}</h1>
        <p className="simulation-status-reassurance">{copy.reassurance}</p>
      </div>
    </section>
  );
}
