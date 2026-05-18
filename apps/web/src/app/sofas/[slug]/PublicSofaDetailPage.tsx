"use client";

/*
RU: Этот файл нужен для страницы одного дивана на публичном сайте.
RU: На экране посетитель видит диван, цену, ткань, вид, размеры, метки и кнопки для симуляции или заказа.
RU: Здесь можно выбрать ткань и вид, открыть симуляцию, перейти к заказу и проверить главные данные дивана.
FR: Ce fichier sert a la page d'un canape sur le site public.
FR: A l'ecran, le visiteur voit le canape, le prix, le tissu, la vue, les tailles, les etiquettes et les boutons pour la simulation ou la commande.
FR: Ici, on peut choisir le tissu et la vue, ouvrir la simulation, aller vers la commande et verifier les donnees principales du canape.
RU: Пока данные дивана загружаются, посетитель видит пустую область с местом под картинку, выборы и кнопки.
FR: Pendant le chargement, le visiteur voit une zone vide avec la place pour l'image, les choix et les boutons.
RU: Обычная картинка на странице легче, а большая картинка открывается только в отдельном окне.
FR: L'image normale sur la page est plus legere, et la grande image s'ouvre seulement dans une fenetre separee.
RU: Картинку дивана можно открыть большим окном, чтобы рассмотреть ее ближе.
FR: L'image du canape peut s'ouvrir en grand pour mieux la regarder.
*/

import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "../../PublicShell";
import type { PublicSofaDetailResponse } from "../../../lib/public-catalog";

const CATALOG_SELECTION_PREFIX = "mobel-unique:catalog-selection:";
const SIMULATION_CONTEXT_PREFIX = "mobel-unique:simulation-context:";
// RU: Это число ограничивает короткий список меток дивана двумя строками.
// FR: Ce nombre limite la liste courte des etiquettes du canape a deux lignes.
const SOFA_DETAIL_COLLAPSED_TAG_LIMIT = 3;

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
  // RU: Эти значения держат данные дивана, выбранную ткань, выбранный вид, сообщения и картинку.
  // FR: Ces valeurs gardent les donnees du canape, le tissu choisi, la vue choisie, les messages et l'image.
  const [detail, setDetail] = useState<PublicSofaDetailResponse | null>(null);
  const [status, setStatus] = useState<DetailStatus>("idle");
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedVisualPositionId, setSelectedVisualPositionId] =
    useState<string | null>(null);
  // RU: Здесь хранится ткань, которая сейчас видна на большой картинке дивана.
  // FR: Ici on garde le tissu visible en ce moment sur la grande image du canape.
  const [displayedFabricId, setDisplayedFabricId] = useState<string | null>(null);
  // RU: Здесь хранится вид дивана, который сейчас виден на большой картинке.
  // FR: Ici on garde la vue du canape visible en ce moment sur la grande image.
  const [displayedVisualPositionId, setDisplayedVisualPositionId] =
    useState<string | null>(null);
  const [staleSelection, setStaleSelection] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // RU: Это значение показывает, открыто ли большое окно с картинкой.
  // FR: Cette valeur indique si la grande fenetre avec l'image est ouverte.
  const [isImageViewerOpen, setImageViewerOpen] = useState(false);
  // RU: Это значение показывает, открыт ли полный список меток дивана.
  // FR: Cette valeur indique si la liste complete des etiquettes du canape est ouverte.
  const [sofaTagsExpanded, setSofaTagsExpanded] = useState(false);

  // RU: Этот автоматический блок получает данные дивана при открытии страницы.
  // FR: Ce bloc automatique prend les donnees du canape quand la page s'ouvre.
  useEffect(() => {
    let isCurrent = true;

    async function loadDetail() {
      setStatus("loading");

      try {
        const response = await fetch(`/api/public/sofas/${slug}`, {
          cache: "no-store",
        });
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
        setSofaTagsExpanded(false);
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
        setDisplayedFabricId(
          hasStaleFabric
            ? null
            : storedFabric && fabricIds.has(storedFabric)
              ? storedFabric
              : body.data.defaults.fabric_id,
        );
        setDisplayedVisualPositionId(
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

  // RU: Этот автоматический блок закрывает большое окно клавишей Escape и останавливает прокрутку страницы.
  // FR: Ce bloc automatique ferme la grande fenetre avec Escape et arrete le defilement de la page.
  useEffect(() => {
    if (!isImageViewerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setImageViewerOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isImageViewerOpen]);

  // RU: Эти данные находят выбранные ткань, вид и картинку для кнопок и большой просмотровой.
  // FR: Ces donnees trouvent le tissu, la vue et l'image choisis pour les boutons et la grande vue.
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
  const selectedVisualPositionIndex = useMemo(
    () =>
      detail?.visual_positions.findIndex(
        (position) => position.id === selectedVisualPositionId,
      ) ?? -1,
    [detail?.visual_positions, selectedVisualPositionId],
  );
  const previousVisualPosition =
    detail && selectedVisualPositionIndex > 0
      ? (detail.visual_positions[selectedVisualPositionIndex - 1] ?? null)
      : null;
  const nextVisualPosition =
    detail &&
    selectedVisualPositionIndex >= 0 &&
    selectedVisualPositionIndex < detail.visual_positions.length - 1
      ? (detail.visual_positions[selectedVisualPositionIndex + 1] ?? null)
      : null;
  const selectedVisualPositionLabel = selectedVisualPosition
    ? formatVisualPositionLabel(selectedVisualPosition)
    : null;
  const selectedRender = useMemo(
    () =>
      detail?.renders.find(
        (render) =>
          render.fabric_id === selectedFabricId &&
          render.visual_position_id === selectedVisualPositionId,
      ) ?? null,
    [detail?.renders, selectedFabricId, selectedVisualPositionId],
  );
  const selectedRenderPreviewUrl =
    selectedRender?.render_medium_url ??
    selectedRender?.render_url ??
    selectedRender?.render_original_url ??
    null;
  const selectedRenderOriginalUrl =
    selectedRender?.render_original_url ??
    selectedRender?.render_url ??
    selectedRender?.render_medium_url ??
    null;

  // RU: Эти данные находят ткань, вид и картинку, которые сейчас видны на странице.
  // FR: Ces donnees trouvent le tissu, la vue et l'image visibles en ce moment sur la page.
  const displayedFabric = useMemo(
    () => detail?.fabrics.find((fabric) => fabric.id === displayedFabricId) ?? null,
    [detail?.fabrics, displayedFabricId],
  );
  const displayedVisualPosition = useMemo(
    () =>
      detail?.visual_positions.find(
        (position) => position.id === displayedVisualPositionId,
      ) ?? null,
    [detail?.visual_positions, displayedVisualPositionId],
  );
  const displayedRender = useMemo(
    () =>
      detail?.renders.find(
        (render) =>
          render.fabric_id === displayedFabricId &&
          render.visual_position_id === displayedVisualPositionId,
      ) ?? null,
    [detail?.renders, displayedFabricId, displayedVisualPositionId],
  );
  const displayedRenderPreviewUrl =
    displayedRender?.render_medium_url ??
    displayedRender?.render_url ??
    displayedRender?.render_original_url ??
    null;

  // RU: Заранее качаем и готовим картинки выбранного вида и выбранной ткани, чтобы кнопки ткани и фото отвечали быстрее.
  // FR: On telecharge et prepare a l'avance les images de la vue choisie et du tissu choisi pour accelerer les boutons de tissu et de photo.
  useEffect(() => {
    if (!detail || !selectedFabricId || !selectedVisualPositionId) {
      return;
    }

    const preloadedUrls = new Set<string>();

    for (const render of detail.renders) {
      const isSelectedVisualPosition =
        render.visual_position_id === selectedVisualPositionId;
      const isSelectedFabric = render.fabric_id === selectedFabricId;

      if (!isSelectedVisualPosition && !isSelectedFabric) {
        continue;
      }

      if (!render.render_medium_url || preloadedUrls.has(render.render_medium_url)) {
        continue;
      }

      preloadedUrls.add(render.render_medium_url);

      const preloader = new Image();
      preloader.src = render.render_medium_url;
      preloader.decode().catch(() => {
        // RU: Ошибка ранней подготовки безопасна: видимая картинка повторит попытку при переключении.
        // FR: Une erreur de preparation reste sans risque: l'image visible reessayera lors du changement.
      });
    }
  }, [detail, selectedFabricId, selectedVisualPositionId]);

  // RU: Меняем видимую картинку только когда новая полностью готова к показу, чтобы не было пустого белого места.
  // FR: On change l'image visible seulement quand la nouvelle est prete a etre affichee, pour eviter un blanc.
  useEffect(() => {
    if (
      !selectedFabricId ||
      !selectedVisualPositionId ||
      !selectedRenderPreviewUrl
    ) {
      return;
    }

    if (
      selectedFabricId === displayedFabricId &&
      selectedVisualPositionId === displayedVisualPositionId
    ) {
      return;
    }

    let isCurrent = true;
    const preloader = new Image();

    function finishSwap() {
      if (isCurrent) {
        setDisplayedFabricId(selectedFabricId);
        setDisplayedVisualPositionId(selectedVisualPositionId);
      }
    }

    preloader.src = selectedRenderPreviewUrl;
    preloader.decode().then(finishSwap, finishSwap);

    return () => {
      isCurrent = false;
    };
  }, [
    displayedFabricId,
    displayedVisualPositionId,
    selectedFabricId,
    selectedRenderPreviewUrl,
    selectedVisualPositionId,
  ]);

  const canLaunchSimulation = Boolean(
    detail &&
      selectedFabric &&
      selectedVisualPosition &&
      selectedRender &&
      !staleSelection,
  );
  // RU: Этот текст описывает картинку, которая сейчас видна, для читателей экрана.
  // FR: Ce texte decrit l'image visible en ce moment pour les lecteurs d'ecran.
  const selectedImageAlt = detail
    ? `${detail.sofa.public_name} en ${displayedFabric?.public_name ?? "tissu sélectionné"}, ${
        displayedVisualPosition
          ? formatVisualPositionLabel(displayedVisualPosition)
          : "vue sélectionnée"
      }`
    : "";
  // RU: Эта проверка говорит, можно ли открыть выбранную картинку большим окном.
  // FR: Cette verification dit si l'image choisie peut s'ouvrir en grand.
  const canOpenImageViewer = Boolean(selectedRenderOriginalUrl && !imageFailed);
  // RU: Эти данные готовят короткий или полный список меток дивана.
  // FR: Ces donnees preparent la liste courte ou complete des etiquettes du canape.
  const sofaTags = detail?.sofa.tags ?? [];
  const visibleSofaTags = sofaTagsExpanded
    ? sofaTags
    : sofaTags.slice(0, SOFA_DETAIL_COLLAPSED_TAG_LIMIT);
  const showSofaTagToggle = sofaTags.length > SOFA_DETAIL_COLLAPSED_TAG_LIMIT;

  // RU: Это действие выбирает ткань и снова показывает картинку.
  // FR: Cette action choisit le tissu et montre de nouveau l'image.
  // RU: Если большое окно открыто, оно закрывается.
  // FR: Si la grande fenetre est ouverte, elle se ferme.
  function chooseFabric(fabricId: string) {
    setSelectedFabricId(fabricId);
    setStaleSelection(false);
    setImageFailed(false);
    setImageViewerOpen(false);
  }

  // RU: Это действие выбирает вид дивана и снова показывает картинку.
  // FR: Cette action choisit la vue du canape et montre de nouveau l'image.
  // RU: Если большое окно открыто, оно закрывается.
  // FR: Si la grande fenetre est ouverte, elle se ferme.
  function chooseVisualPosition(visualPositionId: string) {
    setSelectedVisualPositionId(visualPositionId);
    setStaleSelection(false);
    setImageFailed(false);
    setImageViewerOpen(false);
  }

  // RU: Это действие возвращает первый доступный выбор.
  // FR: Cette action remet le premier choix disponible.
  // RU: Если большое окно открыто, оно закрывается.
  // FR: Si la grande fenetre est ouverte, elle se ferme.
  function resetToDefaults() {
    if (!detail) {
      return;
    }

    setSelectedFabricId(detail.defaults.fabric_id);
    setSelectedVisualPositionId(detail.defaults.visual_position_id);
    setDisplayedFabricId(detail.defaults.fabric_id);
    setDisplayedVisualPositionId(detail.defaults.visual_position_id);
    setStaleSelection(false);
    setImageFailed(false);
    setImageViewerOpen(false);
  }

  // RU: Это действие открывает выбранную картинку большим окном.
  // FR: Cette action ouvre l'image choisie en grand.
  function openImageViewer() {
    if (canOpenImageViewer) {
      setImageViewerOpen(true);
    }
  }

  // RU: Это действие закрывает большое окно с картинкой.
  // FR: Cette action ferme la grande fenetre avec l'image.
  function closeImageViewer() {
    setImageViewerOpen(false);
  }

  // RU: Это действие закрывает большое окно, когда нажимают на темный фон.
  // FR: Cette action ferme la grande fenetre quand on appuie sur le fond sombre.
  function closeImageViewerFromBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeImageViewer();
    }
  }

  // RU: Это действие показывает, что картинка не загрузилась, и закрывает большое окно.
  // FR: Cette action indique que l'image ne charge pas et ferme la grande fenetre.
  function handleSelectedImageError() {
    setImageFailed(true);
    setImageViewerOpen(false);
  }

  // RU: Это действие открывает или снова сокращает список меток дивана.
  // FR: Cette action ouvre ou raccourcit la liste des etiquettes du canape.
  function toggleSofaTags() {
    setSofaTagsExpanded((isExpanded) => !isExpanded);
  }

  // RU: Это действие запоминает выбор перед открытием симуляции.
  // FR: Cette action garde le choix avant d'ouvrir la simulation.
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
      {/* RU: Эти части показывают пустую область загрузки, ошибку или недоступный диван. */}
      {/* FR: Ces parties montrent la zone vide de chargement, l'erreur ou le canape indisponible. */}
      {status === "loading" || status === "idle" ? (
        <SofaDetailLoadingSkeleton />
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
          <a className="public-secondary-link" href="/catalog">
            Revenir au catalogue
          </a>
        </section>
      ) : null}

      {status === "unavailable" ? (
        <section className="public-status-panel">
          <p>Ce canapé n'est pas disponible.</p>
          <a className="public-secondary-link" href="/catalog">
            Revenir au catalogue
          </a>
        </section>
      ) : null}

      {/* RU: Эта большая часть показывает выбранный диван и действия для посетителя. */}
      {/* FR: Cette grande partie montre le canape choisi et les actions du visiteur. */}
      {status === "ready" && detail ? (
        <article className="sofa-detail">
          <a className="sofa-detail-return-link" href="/catalog">
            <span aria-hidden="true">←</span>
            <span>Revenir au catalogue</span>
          </a>

          <section className="sofa-detail-media">
            <div className="sofa-detail-image">
              {imageFailed || !displayedRenderPreviewUrl ? (
                <span>Image indisponible</span>
              ) : (
                <button
                  aria-label="Agrandir l'image du canapé"
                  className="sofa-detail-image-button"
                  onClick={openImageViewer}
                  type="button"
                >
                  <img
                    key={displayedRenderPreviewUrl}
                    alt={selectedImageAlt}
                    decoding="async"
                    onError={handleSelectedImageError}
                    src={displayedRenderPreviewUrl}
                  />
                  <span className="sofa-detail-image-viewer-icon">
                    <PublicExpandIcon />
                  </span>
                </button>
              )}
            </div>
            {detail.visual_positions.length > 1 &&
            selectedVisualPositionLabel &&
            selectedVisualPositionIndex >= 0 ? (
              <div className="sofa-photo-controls" aria-label="Changer de photo">
                <button
                  aria-label="Photo précédente"
                  className="sofa-photo-control-button"
                  disabled={!previousVisualPosition}
                  onClick={() => {
                    if (previousVisualPosition) {
                      chooseVisualPosition(previousVisualPosition.id);
                    }
                  }}
                  type="button"
                >
                  <PublicArrowLeftIcon />
                </button>
                <p className="sofa-photo-control-label">
                  Photo {selectedVisualPositionIndex + 1} sur{" "}
                  {detail.visual_positions.length}
                </p>
                <button
                  aria-label="Photo suivante"
                  className="sofa-photo-control-button"
                  disabled={!nextVisualPosition}
                  onClick={() => {
                    if (nextVisualPosition) {
                      chooseVisualPosition(nextVisualPosition.id);
                    }
                  }}
                  type="button"
                >
                  <PublicArrowRightIcon />
                </button>
              </div>
            ) : null}
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
              <SelectionGroup
                title="Tissu"
                selectedLabel={selectedFabric?.public_name}
              >
                {detail.fabrics.map((fabric) => (
                  <button
                    aria-pressed={selectedFabricId === fabric.id}
                    className="sofa-choice-button"
                    key={fabric.id}
                    onClick={() => chooseFabric(fabric.id)}
                    type="button"
                  >
                    <img
                      alt=""
                      decoding="async"
                      loading="lazy"
                      src={fabric.swatch_small_url}
                    />
                    <span>{fabric.public_name}</span>
                  </button>
                ))}
              </SelectionGroup>

            </div>

            <div className="sofa-actions">
              <a
                aria-disabled={canLaunchSimulation ? undefined : "true"}
                className="public-primary-link"
                href={`/sofas/${slug}/simulate/start`}
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
                  Commander
                </a>
              ) : null}
            </div>

            <section className="sofa-info-grid" aria-label="Informations publiques">
              {detail.sofa.price ? (
                <div>
                  <h2>Prix</h2>
                  <p className="sofa-price">
                    {formatPublicWholeEuroPrice(detail.sofa.price)}
                  </p>
                </div>
              ) : null}
              <div>
                <h2>Dimensions</h2>
                <DimensionList dimensions={detail.sofa.dimensions} />
              </div>
              {detail.sofa.tags.length > 0 ? (
                <div className="sofa-tags-panel">
                  <h2>Étiquettes</h2>
                  {/* RU: Эта область показывает метки дивана коротко или полностью. */}
                  {/* FR: Cette zone montre les etiquettes du canape en version courte ou complete. */}
                  <ul
                    aria-label="Étiquettes du canapé"
                    className={`public-tag-list public-tag-list-full sofa-tag-list${
                      sofaTagsExpanded ? " sofa-tag-list-expanded" : ""
                    }`}
                  >
                    {visibleSofaTags.map((tag) => (
                      <li key={tag.slug}>{tag.public_label}</li>
                    ))}
                    {showSofaTagToggle ? (
                      <li className="sofa-tag-list-toggle-item">
                        <button
                          aria-expanded={sofaTagsExpanded}
                          className="sofa-tag-list-toggle"
                          onClick={toggleSofaTags}
                          type="button"
                        >
                          {sofaTagsExpanded ? "Voir moins" : "Voir plus"}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </section>

            <p className="sofa-limits">
              Le rendu IA reste une estimation visuelle. Vérifiez toujours le
              modèle, le tissu et les dimensions avant de finaliser votre achat.
            </p>
          </section>
          {/* RU: Это большое окно показывает картинку дивана почти на весь экран. */}
          {/* FR: Cette grande fenetre montre l'image du canape presque sur tout l'ecran. */}
          {isImageViewerOpen && selectedRenderOriginalUrl ? (
            <div
              className="sofa-image-viewer-backdrop"
              onClick={closeImageViewerFromBackdrop}
            >
              <section
                aria-label="Image du canapé"
                aria-modal="true"
                className="sofa-image-viewer-dialog"
                role="dialog"
              >
                <header className="sofa-image-viewer-header">
                  <button
                    aria-label="Fermer l'image"
                    autoFocus
                    className="sofa-image-viewer-close"
                    onClick={closeImageViewer}
                    type="button"
                  >
                    <PublicCloseIcon />
                  </button>
                </header>
                <div className="sofa-image-viewer-frame">
                  <img
                    alt={selectedImageAlt}
                    decoding="async"
                    onError={handleSelectedImageError}
                    src={selectedRenderOriginalUrl}
                  />
                </div>
              </section>
            </div>
          ) : null}
        </article>
      ) : null}
    </PublicShell>
  );
}

// RU: Эта область держит место под страницу дивана, пока данные еще загружаются.
// FR: Cette zone garde la place de la fiche canape pendant que les donnees chargent.
function SofaDetailLoadingSkeleton() {
  return (
    <article
      aria-busy="true"
      aria-label="Chargement du canape"
      aria-live="polite"
      className="sofa-detail sofa-detail-skeleton"
    >
      <section className="sofa-detail-media" aria-hidden="true">
        <div className="sofa-detail-image catalog-skeleton-block" />
      </section>
      <section className="sofa-detail-copy" aria-hidden="true">
        <div className="sofa-detail-skeleton-heading">
          <span className="catalog-skeleton-line sofa-detail-skeleton-eyebrow" />
          <span className="catalog-skeleton-line sofa-detail-skeleton-title" />
          <span className="catalog-skeleton-line sofa-detail-skeleton-description" />
        </div>
        <div className="sofa-detail-skeleton-selector">
          <span className="catalog-skeleton-line sofa-detail-skeleton-label" />
          <span className="sofa-detail-skeleton-choice-row" />
          <span className="catalog-skeleton-line sofa-detail-skeleton-label" />
          <span className="sofa-detail-skeleton-view-row" />
        </div>
        <div className="sofa-detail-skeleton-actions">
          <span />
          <span />
        </div>
        <div className="sofa-detail-skeleton-info">
          <span />
          <span />
        </div>
        <span className="catalog-skeleton-line sofa-detail-skeleton-note" />
      </section>
    </article>
  );
}

function PublicExpandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="sofa-detail-expand-icon"
      viewBox="0 0 24 24"
    >
      <path d="M8 3H3v5h2V6.41l4.3 4.3 1.4-1.42L6.41 5H8V3Zm8 0v2h1.59l-4.3 4.29 1.42 1.42 4.29-4.3V8h2V3h-5ZM9.29 13.29 5 17.59V16H3v5h5v-2H6.41l4.3-4.29-1.42-1.42Zm5.42 0-1.42 1.42 4.3 4.29H16v2h5v-5h-2v1.59l-4.29-4.3Z" />
    </svg>
  );
}

function PublicCloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="sofa-image-viewer-close-icon"
      viewBox="0 0 24 24"
    >
      <path d="m6.4 5 5.6 5.59L17.6 5 19 6.4 13.41 12 19 17.6 17.6 19 12 13.41 6.4 19 5 17.6 10.59 12 5 6.4 6.4 5Z" />
    </svg>
  );
}

function PublicArrowLeftIcon() {
  return (
    <svg aria-hidden="true" className="sofa-photo-control-icon" viewBox="0 0 24 24">
      <path d="M15.5 5.4 9 12l6.5 6.6-1.4 1.4L6.1 12l8-8 1.4 1.4Z" />
    </svg>
  );
}

function PublicArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="sofa-photo-control-icon" viewBox="0 0 24 24">
      <path d="m8.5 18.6 6.5-6.6-6.5-6.6L9.9 4l8 8-8 8-1.4-1.4Z" />
    </svg>
  );
}

function SelectionGroup({
  children,
  selectedLabel,
  title,
}: {
  children?: React.ReactNode;
  selectedLabel?: string | null;
  title: string;
}) {
  return (
    <section className="sofa-selection-group" aria-label={title}>
      <div className="sofa-selection-group-heading">
        <h2>{title}</h2>
        {selectedLabel ? (
          <p className="sofa-selected-choice-name">{selectedLabel}</p>
        ) : null}
      </div>
      {children ? (
        <div className="sofa-selection-group-options">{children}</div>
      ) : null}
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

function formatPublicWholeEuroPrice(
  price: PublicSofaDetailResponse["sofa"]["price"],
) {
  if (!price || price.currency !== "EUR" || price.amount_cents <= 0) {
    return "";
  }

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  })
    .format(price.amount_cents / 100)
    .replace(/\u202f|\u00a0/g, " ")} €`;
}

function formatVisualPositionLabel(
  position: PublicSofaDetailResponse["visual_positions"][number],
) {
  return position.public_label ?? `Vue ${position.sequence}`;
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
    // RU: Запоминание выбора помогает открыть будущий мастер, но страница работает и без него.
    // FR: Garder le choix aide a ouvrir le futur parcours, mais la page marche aussi sans cela.
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
