"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "../../PublicShell";
import type { PublicSofaDetailResponse } from "../../../lib/public-catalog";

const CATALOG_SELECTION_PREFIX = "mobel-unique:catalog-selection:";
const SIMULATION_CONTEXT_PREFIX = "mobel-unique:simulation-context:";

type DetailStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    message?: string;
  };
  meta?: Record<string, unknown>;
}

interface StoredSelection {
  fabric_id?: string;
  visual_position_id?: string;
}

export function PublicSofaDetailPage({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<PublicSofaDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>("idle");
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedVisualPositionId, setSelectedVisualPositionId] =
    useState<string | null>(null);
  const [staleSelection, setStaleSelection] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadDetail() {
      setStatus("loading");

      try {
        const response = await fetch(`/api/public/sofas/${slug}`);
        const body = (await response.json()) as ApiEnvelope<PublicSofaDetailResponse>;

        if (!response.ok || !body.data) {
          if (response.status === 404 || response.status === 410) {
            setStatus("unavailable");
            return;
          }

          throw new Error(body.error?.message ?? "Sofa unavailable.");
        }

        if (!isCurrent) {
          return;
        }

        const storedSelection = consumeStoredSelection(slug);
        const fabricIds = new Set(body.data.fabrics.map((fabric) => fabric.id));
        const visualPositionIds = new Set(
          body.data.visual_positions.map((position) => position.id),
        );
        const storedFabric = storedSelection?.fabric_id;
        const storedVisualPosition = storedSelection?.visual_position_id;
        const hasStaleFabric = Boolean(storedFabric && !fabricIds.has(storedFabric));
        const hasStaleVisualPosition = Boolean(
          storedVisualPosition && !visualPositionIds.has(storedVisualPosition),
        );

        setDetail(body.data);
        setStaleSelection(hasStaleFabric || hasStaleVisualPosition);
        setSelectedFabricId(
          hasStaleFabric
            ? null
            : storedFabric && fabricIds.has(storedFabric)
              ? storedFabric
              : body.data.defaults.fabric_id,
        );
        setSelectedVisualPositionId(
          hasStaleVisualPosition
            ? null
            : storedVisualPosition && visualPositionIds.has(storedVisualPosition)
              ? storedVisualPosition
              : body.data.defaults.visual_position_id,
        );
        setStatus("ready");
      } catch {
        if (isCurrent) {
          setStatus("error");
        }
      }
    }

    void loadDetail();

    return () => {
      isCurrent = false;
    };
  }, [slug]);

  const selectedFabric = useMemo(
    () => detail?.fabrics.find((fabric) => fabric.id === selectedFabricId) ?? null,
    [detail?.fabrics, selectedFabricId],
  );
  const selectedVisualPosition = useMemo(
    () =>
      detail?.visual_positions.find(
        (position) => position.id === selectedVisualPositionId,
      ) ?? null,
    [detail?.visual_positions, selectedVisualPositionId],
  );
  const selectedRender = useMemo(
    () =>
      detail?.renders.find(
        (render) =>
          render.fabric_id === selectedFabricId &&
          render.visual_position_id === selectedVisualPositionId,
      ) ?? null,
    [detail?.renders, selectedFabricId, selectedVisualPositionId],
  );
  const canLaunchSimulation = Boolean(
    detail &&
      selectedFabric &&
      selectedVisualPosition &&
      selectedRender &&
      !staleSelection,
  );

  function chooseFabric(fabricId: string) {
    setSelectedFabricId(fabricId);
    setStaleSelection(false);
    setImageFailed(false);
  }

  function chooseVisualPosition(visualPositionId: string) {
    setSelectedVisualPositionId(visualPositionId);
    setStaleSelection(false);
    setImageFailed(false);
  }

  function resetToDefaults() {
    if (!detail) {
      return;
    }

    setSelectedFabricId(detail.defaults.fabric_id);
    setSelectedVisualPositionId(detail.defaults.visual_position_id);
    setStaleSelection(false);
    setImageFailed(false);
  }

  function rememberSimulationContext(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!canLaunchSimulation || !selectedFabricId || !selectedVisualPositionId) {
      event.preventDefault();
      return;
    }

    writeSessionJson(`${SIMULATION_CONTEXT_PREFIX}${slug}`, {
      fabric_id: selectedFabricId,
      visual_position_id: selectedVisualPositionId,
    });
  }

  return (
    <PublicShell currentPath="detail">
      <a className="public-back-link" href="/catalog">
        Retour au catalogue
      </a>

      {status === "loading" || status === "idle" ? (
        <section className="public-status-panel" aria-live="polite">
          Chargement du canapé...
        </section>
      ) : null}

      {status === "error" ? (
        <section className="public-status-panel" aria-live="polite">
          <p>La fiche canapé est temporairement indisponible.</p>
          <button
            className="public-secondary-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Réessayer
          </button>
        </section>
      ) : null}

      {status === "unavailable" ? (
        <section className="public-status-panel">
          <p>Ce canapé n'est pas disponible.</p>
        </section>
      ) : null}

      {status === "ready" && detail ? (
        <article className="sofa-detail">
          <section className="sofa-detail-media">
            <div className="sofa-detail-image">
              {imageFailed || !selectedRender ? (
                <span>Image indisponible</span>
              ) : (
                <img
                  alt={`${detail.sofa.public_name} en ${selectedFabric?.public_name ?? "tissu sélectionné"}, ${selectedVisualPosition?.public_label ?? "vue sélectionnée"}`}
                  onError={() => setImageFailed(true)}
                  src={selectedRender.render_url}
                />
              )}
            </div>
          </section>

          <section className="sofa-detail-copy" aria-labelledby="sofa-title">
            <div className="sofa-detail-heading">
              <p className="public-eyebrow">Canapé à simuler</p>
              <h1 id="sofa-title">{detail.sofa.public_name}</h1>
              {detail.sofa.public_description ? (
                <p className="sofa-description">{detail.sofa.public_description}</p>
              ) : null}
            </div>

            {staleSelection ? (
              <div className="sofa-selection-warning" role="status">
                <p>Votre sélection précédente n'est plus disponible.</p>
                <button
                  className="public-secondary-button"
                  onClick={resetToDefaults}
                  type="button"
                >
                  Utiliser la première sélection disponible
                </button>
              </div>
            ) : null}

            <div className="sofa-selector-panel">
              <SelectionGroup title="Tissu">
                {detail.fabrics.map((fabric) => (
                  <button
                    aria-pressed={selectedFabricId === fabric.id}
                    className="sofa-choice-button"
                    key={fabric.id}
                    onClick={() => chooseFabric(fabric.id)}
                    type="button"
                  >
                    <img alt="" src={fabric.swatch_url} />
                    <span>{fabric.public_name}</span>
                  </button>
                ))}
              </SelectionGroup>

              <SelectionGroup title="Vue">
                {detail.visual_positions.map((position) => (
                  <button
                    aria-pressed={selectedVisualPositionId === position.id}
                    className="sofa-view-button"
                    key={position.id}
                    onClick={() => chooseVisualPosition(position.id)}
                    type="button"
                  >
                    {position.public_label ?? `Vue ${position.sequence}`}
                  </button>
                ))}
              </SelectionGroup>
            </div>

            <div className="sofa-actions">
              <a
                aria-disabled={canLaunchSimulation ? undefined : "true"}
                className="public-primary-link"
                href={`/sofas/${slug}/simulate`}
                onClick={rememberSimulationContext}
              >
                Lancer ma simulation
              </a>
              {isValidHttpUrl(detail.sofa.shopify_order_url) ? (
                <a
                  className="public-secondary-link"
                  href={detail.sofa.shopify_order_url ?? undefined}
                  rel="noreferrer"
                >
                  Commander sur Shopify
                </a>
              ) : null}
            </div>

            <section className="sofa-info-grid" aria-label="Informations publiques">
              <div>
                <h2>Dimensions</h2>
                <DimensionList dimensions={detail.sofa.dimensions} />
              </div>
              {detail.sofa.tags.length > 0 ? (
                <div>
                  <h2>Étiquettes</h2>
                  <ul className="public-tag-list public-tag-list-full">
                    {detail.sofa.tags.map((tag) => (
                      <li key={tag.slug}>{tag.public_label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <p className="sofa-limits">
              Le rendu IA reste une estimation visuelle. Vérifiez toujours le
              modèle, le tissu et les dimensions avant de finaliser votre achat.
            </p>
          </section>
        </article>
      ) : null}
    </PublicShell>
  );
}

function SelectionGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="sofa-selection-group" aria-label={title}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function DimensionList({
  dimensions,
}: {
  dimensions: PublicSofaDetailResponse["sofa"]["dimensions"];
}) {
  const items = [
    dimensions.length_cm ? `Longueur ${dimensions.length_cm} cm` : null,
    dimensions.depth_cm ? `Profondeur ${dimensions.depth_cm} cm` : null,
    dimensions.height_cm ? `Hauteur ${dimensions.height_cm} cm` : null,
  ].filter(Boolean);

  if (items.length === 0) {
    return <p>Dimensions à confirmer sur la fiche produit.</p>;
  }

  return (
    <ul className="sofa-dimensions-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function consumeStoredSelection(slug: string): StoredSelection | null {
  const key = `${CATALOG_SELECTION_PREFIX}${slug}`;

  try {
    const value = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);

    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as StoredSelection;

    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, value: Record<string, string>) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session state is a progressive enhancement for the future wizard.
  }
}

function isValidHttpUrl(value: string | null) {
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
