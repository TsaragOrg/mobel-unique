"use client";

import { SIMULATION_LOCALE } from "../../lib/simulation-client/locale";
import { SimulationContextStrip } from "./SimulationContextStrip";

export type Screen6Variant = "error" | "expired";

export interface Screen6ErrorExpiredProps {
  variant: Screen6Variant;
  context?: {
    sofaName: string;
    fabricName: string;
    visualPositionLabel: string;
  };
  restartHref?: string;
  backToSofaHref?: string;
  backToCatalogHref?: string;
}

export function Screen6ErrorExpired(props: Screen6ErrorExpiredProps) {
  if (props.variant === "expired") {
    const expired = SIMULATION_LOCALE.screen6ErrorOrExpired.expired;
    return (
      <section
        className="simulation-terminal-screen simulation-terminal-expired"
        data-testid="simulation-screen-expired"
      >
        <div className="simulation-terminal-body">
          <span
            aria-hidden="true"
            className="simulation-terminal-icon simulation-terminal-icon-expired"
          />
          <p className="public-eyebrow">{expired.eyebrow}</p>
          <h1>{expired.title}</h1>
          <p>{expired.notice}</p>
          <div className="simulation-terminal-actions">
            <a
              className="public-primary-link"
              href={props.backToCatalogHref ?? "/catalog"}
            >
              {expired.backToCatalogLink}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const error = SIMULATION_LOCALE.screen6ErrorOrExpired.error;
  return (
    <section
      className="simulation-terminal-screen simulation-terminal-error"
      data-testid="simulation-screen-error"
    >
      {props.context ? (
        <SimulationContextStrip
          sofaName={props.context.sofaName}
          fabricName={props.context.fabricName}
          visualPositionLabel={props.context.visualPositionLabel}
        />
      ) : null}
      <div className="simulation-terminal-body">
        <span
          aria-hidden="true"
          className="simulation-terminal-icon simulation-terminal-icon-error"
        />
        <p className="public-eyebrow">{error.eyebrow}</p>
        <h1>{error.title}</h1>
        <p>{error.instruction}</p>
        <div className="simulation-terminal-actions">
          {props.restartHref ? (
            <a className="public-primary-link" href={props.restartHref}>
              {error.restartButton}
            </a>
          ) : null}
          {props.backToSofaHref ? (
            <a className="public-secondary-link" href={props.backToSofaHref}>
              {error.backToSofaLink}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
