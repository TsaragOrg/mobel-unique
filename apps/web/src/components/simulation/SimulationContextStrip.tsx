import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";

export interface SimulationContextStripProps {
  sofaName: string;
  fabricName: string;
  visualPositionLabel: string;
}

export function SimulationContextStrip(props: SimulationContextStripProps) {
  const { sofaName, fabricName, visualPositionLabel } = props;
  const separator = SIMULATION_LOCALE.contextStrip.separator;
  return (
    <p
      aria-label="Contexte de la simulation"
      className="simulation-context-strip"
    >
      <span>{sofaName}</span>
      <span aria-hidden="true">{separator}</span>
      <span>{fabricName}</span>
      <span aria-hidden="true">{separator}</span>
      <span>{visualPositionLabel}</span>
    </p>
  );
}
