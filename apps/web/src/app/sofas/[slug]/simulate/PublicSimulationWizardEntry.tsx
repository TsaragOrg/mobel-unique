"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PublicShell } from "../../../PublicShell";
import { Screen1PhotoUpload } from "../../../../components/simulation/Screen1PhotoUpload";
import { SIMULATION_LOCALE } from "../../../../lib/simulation-client/locale";
import { stashJobContext } from "../../../../lib/simulation-client/job-context";
import type { PublicSofaDetailResponse } from "../../../../lib/public-catalog";
import type { RoomGeometryMode } from "../../../../lib/simulation-public-api";

const SIMULATION_CONTEXT_PREFIX = "mobel-unique:simulation-context:";
const CORNER_TAG_SLUG = "corner";

type EntryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing-selection"
  | "unavailable"
  | "error";

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

interface StoredSelection {
  fabric_id?: string;
  visual_position_id?: string;
}

export interface PublicSimulationWizardEntryProps {
  slug: string;
  fetchSofa?: (slug: string) => Promise<PublicSofaDetailResponse | null>;
  navigateToJob?: (jobId: string) => void;
  readStoredSelection?: (slug: string) => StoredSelection | null;
}

export function PublicSimulationWizardEntry(
  props: PublicSimulationWizardEntryProps
) {
  const router = useRouter();
  const fetchSofa = props.fetchSofa ?? defaultFetchSofa;
  const readStoredSelection =
    props.readStoredSelection ?? defaultReadStoredSelection;

  const [detail, setDetail] = useState<PublicSofaDetailResponse | null>(null);
  const [selection, setSelection] = useState<StoredSelection | null>(null);
  const [status, setStatus] = useState<EntryStatus>("idle");

  useEffect(() => {
    let isCurrent = true;
    setStatus("loading");
    fetchSofa(props.slug)
      .then((response) => {
        if (!isCurrent) return;
        if (!response) {
          setStatus("unavailable");
          return;
        }
        setDetail(response);
        const stored = readStoredSelection(props.slug);
        if (
          !stored?.fabric_id ||
          !stored?.visual_position_id ||
          !response.fabrics.some((f) => f.id === stored.fabric_id) ||
          !response.visual_positions.some(
            (p) => p.id === stored.visual_position_id
          )
        ) {
          setStatus("missing-selection");
          return;
        }
        setSelection(stored);
        setStatus("ready");
      })
      .catch(() => {
        if (isCurrent) setStatus("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [props.slug, fetchSofa, readStoredSelection]);

  const geometryMode = useMemo<RoomGeometryMode>(() => {
    if (!detail) return "back_wall";
    return detail.sofa.tags.some((tag) => tag.slug === CORNER_TAG_SLUG)
      ? "corner"
      : "back_wall";
  }, [detail]);

  const fabric = useMemo(
    () =>
      detail?.fabrics.find((entry) => entry.id === selection?.fabric_id) ?? null,
    [detail?.fabrics, selection?.fabric_id]
  );

  const visualPosition = useMemo(
    () =>
      detail?.visual_positions.find(
        (entry) => entry.id === selection?.visual_position_id
      ) ?? null,
    [detail?.visual_positions, selection?.visual_position_id]
  );

  function handleJobCreated(jobId: string) {
    if (detail && fabric && visualPosition) {
      stashJobContext(jobId, {
        slug: props.slug,
        sofaName: detail.sofa.public_name,
        fabricName: fabric.public_name,
        visualPositionLabel:
          visualPosition.public_label ?? `Vue ${visualPosition.sequence}`
      });
    }
    if (props.navigateToJob) {
      props.navigateToJob(jobId);
      return;
    }
    router.replace(`/simulations/${jobId}`);
  }

  return (
    <PublicShell currentPath="detail">
      <a className="public-back-link" href={`/sofas/${props.slug}`}>
        Retour au canapé
      </a>

      {status === "loading" || status === "idle" ? (
        <section className="public-status-panel" aria-live="polite">
          {SIMULATION_LOCALE.screen2RoomPrep.reassurance}
        </section>
      ) : null}

      {status === "unavailable" ? (
        <section className="public-status-panel">
          <p>Ce canapé n'est pas disponible.</p>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="public-status-panel" aria-live="polite">
          <p>{SIMULATION_LOCALE.screen6ErrorOrExpired.error.instruction}</p>
          <a className="public-secondary-link" href={`/sofas/${props.slug}`}>
            {SIMULATION_LOCALE.screen6ErrorOrExpired.error.backToSofaLink}
          </a>
        </section>
      ) : null}

      {status === "missing-selection" ? (
        <section className="public-status-panel">
          <p>
            Sélectionnez d'abord un tissu et une vue avant de lancer la
            simulation.
          </p>
          <a className="public-primary-link" href={`/sofas/${props.slug}`}>
            Retour au canapé
          </a>
        </section>
      ) : null}

      {status === "ready" && detail && fabric && visualPosition && selection ? (
        <Screen1PhotoUpload
          backToSofaHref={`/sofas/${props.slug}`}
          fabricId={fabric.id}
          fabricName={fabric.public_name}
          geometryMode={geometryMode}
          onJobCreated={handleJobCreated}
          sofaName={detail.sofa.public_name}
          sofaSlug={props.slug}
          visualPositionId={visualPosition.id}
          visualPositionLabel={
            visualPosition.public_label ?? `Vue ${visualPosition.sequence}`
          }
        />
      ) : null}
    </PublicShell>
  );
}

async function defaultFetchSofa(
  slug: string
): Promise<PublicSofaDetailResponse | null> {
  const response = await fetch(`/api/public/sofas/${encodeURIComponent(slug)}`);
  if (response.status === 404 || response.status === 410) {
    return null;
  }
  if (!response.ok) {
    throw new Error("sofa unavailable");
  }
  const body = (await response.json()) as ApiEnvelope<PublicSofaDetailResponse>;
  return body.data ?? null;
}

function defaultReadStoredSelection(slug: string): StoredSelection | null {
  if (typeof window === "undefined") return null;
  const key = `${SIMULATION_CONTEXT_PREFIX}${slug}`;
  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredSelection;
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}
