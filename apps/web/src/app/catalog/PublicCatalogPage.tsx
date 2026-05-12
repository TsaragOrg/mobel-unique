"use client";

/*
RU: Этот файл нужен для публичной страницы каталога диванов.
RU: На экране посетитель видит карточки диванов, фильтры, ткани, картинки и ссылку на выбранный диван.
RU: Здесь можно фильтровать каталог, открыть окно со всеми фильтрами, менять ткань в карточке, догружать список и открыть страницу дивана.
FR: Ce fichier sert a la page publique du catalogue de canapes.
FR: A l'ecran, le visiteur voit les cartes de canapes, les filtres, les tissus, les images et le lien vers le canape choisi.
FR: Ici, on peut filtrer le catalogue, ouvrir une fenetre avec tous les filtres, changer le tissu dans une carte, charger la suite et ouvrir la page du canape.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicShell } from "../PublicShell";
import type {
  PublicCatalogItemResponse,
  PublicSofaDetailResponse,
  PublicTagResponse,
} from "../../lib/public-catalog";

// RU: Эти значения задают размер списка, короткий вид фильтров, ключ памяти и безопасный вид меток.
// FR: Ces valeurs fixent la taille de la liste, la vue courte des filtres, la cle de memoire et la forme sure des etiquettes.
const CATALOG_LIMIT = 12;
const CATALOG_CARD_TAG_LIMIT = 3;
const CATALOG_SELECTION_PREFIX = "mobel-unique:catalog-selection:";
const INLINE_FILTER_LIMIT = 2;
const MIN_INLINE_FILTER_LIMIT = 1;
const MOBILE_FILTER_MEDIA_QUERY = "(max-width: 680px)";
const VISIBLE_FABRIC_LIMIT = 4;
const TAG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type CatalogStatus = "idle" | "loading" | "ready" | "error";
type DetailStatus = "idle" | "loading" | "ready" | "error";

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    message?: string;
  };
  meta?: Record<string, unknown>;
}

export function PublicCatalogPage() {
  // RU: Эти значения держат метки, выбранные фильтры, места для замера строки, окно со всеми фильтрами, список диванов, страницу продолжения и сообщения загрузки.
  // FR: Ces valeurs gardent les etiquettes, les filtres choisis, les places pour mesurer la ligne, la fenetre avec tous les filtres, la liste des canapes, la suite et les messages de chargement.
  const filtersContainerRef = useRef<HTMLElement | null>(null);
  const filtersMeasureRef = useRef<HTMLDivElement | null>(null);
  const [tagOptions, setTagOptions] = useState<PublicTagResponse[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [inlineFilterLimit, setInlineFilterLimit] = useState(MIN_INLINE_FILTER_LIMIT);
  const [items, setItems] = useState<PublicCatalogItemResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<CatalogStatus>("idle");
  const [loadMoreStatus, setLoadMoreStatus] = useState<CatalogStatus>("idle");
  const [loadMoreError, setLoadMoreError] = useState(false);

  // RU: Это действие загружает первую страницу каталога и применяет фильтры из адреса.
  // FR: Cette action charge la premiere page du catalogue et applique les filtres de l'adresse.
  const loadFirstPage = useCallback(
    async (inputTags: string[], options: { replaceHistory?: boolean } = {}) => {
      const uniqueInputTags = uniqueSafeTags(inputTags);
      setStatus("loading");
      setLoadMoreStatus("idle");
      setLoadMoreError(false);
      setSelectedTags(uniqueInputTags);

      try {
        const loadedTags = await fetchCatalogTags();
        const knownSlugs = new Set(loadedTags.map((tag) => tag.slug));
        const validTags = uniqueInputTags.filter((tag) => knownSlugs.has(tag));

        setTagOptions(loadedTags);
        setTagsLoaded(true);
        setSelectedTags(validTags);

        if (options.replaceHistory || validTags.length !== uniqueInputTags.length) {
          writeCatalogUrl(validTags, "replace");
        }

        const page = await fetchCatalogPage({
          cursor: null,
          tags: validTags,
        });

        setItems(dedupeCatalogItems(page.items));
        setNextCursor(page.next_cursor);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  // RU: Этот автоматический блок загружает каталог при открытии страницы и при движении по истории браузера.
  // FR: Ce bloc automatique charge le catalogue a l'ouverture et quand l'historique du navigateur change.
  useEffect(() => {
    void loadFirstPage(readTagsFromLocation(), { replaceHistory: true });

    function onPopState() {
      void loadFirstPage(readTagsFromLocation(), { replaceHistory: true });
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [loadFirstPage]);

  // RU: Эти данные решают, какие части каталога надо показать сейчас.
  // FR: Ces donnees decident quelles parties du catalogue afficher maintenant.
  const hasSelectedFilters = selectedTags.length > 0;
  const showFilters = tagsLoaded && tagOptions.length > 0;
  const isEmpty = status === "ready" && items.length === 0 && !hasSelectedFilters;
  const isNoResults = status === "ready" && items.length === 0 && hasSelectedFilters;
  const orderedInlineTagOptions = useMemo(
    () =>
      getOrderedInlineFilterOptions({
        selectedTags,
        tags: tagOptions,
      }),
    [selectedTags, tagOptions],
  );
  const inlineTagOptions = orderedInlineTagOptions.slice(0, inlineFilterLimit);
  const showFilterToggle = tagOptions.length > inlineTagOptions.length;

  // RU: Этот автоматический блок выбирает, сколько фильтров помещается в верхнюю строку на телефоне, планшете и компьютере.
  // FR: Ce bloc automatique choisit combien de filtres tiennent sur la ligne du haut sur telephone, tablette et ordinateur.
  useEffect(() => {
    if (!showFilters) {
      setInlineFilterLimit(MIN_INLINE_FILTER_LIMIT);
      return;
    }

    function updateInlineFilterLimit() {
      const isMobile =
        typeof window.matchMedia === "function"
          ? window.matchMedia(MOBILE_FILTER_MEDIA_QUERY).matches
          : window.innerWidth <= 680;

      const container = filtersContainerRef.current;
      const measure = filtersMeasureRef.current;

      if (!container || !measure) {
        return;
      }

      const styles = window.getComputedStyle(container);
      const containerWidth = Math.max(
        0,
        container.getBoundingClientRect().width -
          parseCssPixelValue(styles.paddingLeft) -
          parseCssPixelValue(styles.paddingRight),
      );
      const gap = parseCssPixelValue(styles.columnGap || styles.gap);
      const tagWidths = Array.from(
        measure.querySelectorAll<HTMLButtonElement>('[data-filter-measure="tag"]'),
      ).map((button) => button.getBoundingClientRect().width);
      const hasMeasuredTags = tagWidths.some((width) => width > 0);

      if (containerWidth <= 0 || !hasMeasuredTags) {
        return;
      }

      if (isMobile) {
        const nextLimit = getMobileOneLineFilterLimit({
          containerWidth,
          gap,
          tagWidths,
        });

        setInlineFilterLimit((currentLimit) =>
          currentLimit === nextLimit ? currentLimit : nextLimit,
        );
        return;
      }

      const toggleWidth =
        measure
          .querySelector<HTMLButtonElement>('[data-filter-measure="toggle"]')
          ?.getBoundingClientRect().width ?? 0;
      const nextLimit = getOneLineFilterLimit({
        containerWidth,
        gap,
        tagWidths,
        toggleWidth,
      });

      setInlineFilterLimit((currentLimit) =>
        currentLimit === nextLimit ? currentLimit : nextLimit,
      );
    }

    updateInlineFilterLimit();
    window.addEventListener("resize", updateInlineFilterLimit);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateInlineFilterLimit);

    if (resizeObserver && filtersContainerRef.current) {
      resizeObserver.observe(filtersContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateInlineFilterLimit);
      resizeObserver?.disconnect();
    };
  }, [orderedInlineTagOptions, showFilters, tagOptions.length]);

  // RU: Это действие применяет выбранные метки и обновляет адрес страницы.
  // FR: Cette action applique les etiquettes choisies et met a jour l'adresse.
  function applyTags(tags: string[]) {
    const nextTags = uniqueSafeTags(tags).filter((tag) =>
      tagOptions.some((option) => option.slug === tag),
    );

    writeCatalogUrl(nextTags, "push");
    void loadFirstPage(nextTags);
  }

  // RU: Это действие включает или убирает одну метку фильтра.
  // FR: Cette action ajoute ou retire une etiquette de filtre.
  function toggleTag(tag: string) {
    applyTags(
      selectedTags.includes(tag)
        ? selectedTags.filter((selected) => selected !== tag)
        : [...selectedTags, tag],
    );
  }

  // RU: Это действие очищает все фильтры каталога.
  // FR: Cette action efface tous les filtres du catalogue.
  function clearFilters() {
    applyTags([]);
  }

  // RU: Это действие открывает окно со всеми фильтрами.
  // FR: Cette action ouvre la fenetre avec tous les filtres.
  function openFiltersDialog() {
    setFiltersDialogOpen(true);
  }

  // RU: Это действие закрывает окно со всеми фильтрами.
  // FR: Cette action ferme la fenetre avec tous les filtres.
  function closeFiltersDialog() {
    setFiltersDialogOpen(false);
  }

  // RU: Это действие загружает следующую страницу диванов.
  // FR: Cette action charge la page suivante de canapes.
  async function loadMore() {
    if (!nextCursor || loadMoreStatus === "loading") {
      return;
    }

    setLoadMoreStatus("loading");
    setLoadMoreError(false);

    try {
      const page = await fetchCatalogPage({
        cursor: nextCursor,
        tags: selectedTags,
      });

      setItems((currentItems) =>
        dedupeCatalogItems([...currentItems, ...page.items]),
      );
      setNextCursor(page.next_cursor);
      setLoadMoreStatus("ready");
    } catch {
      setLoadMoreStatus("error");
      setLoadMoreError(true);
    }
  }

  return (
    <PublicShell currentPath="catalog">
      <section className="public-page-hero" aria-labelledby="catalog-title">
        <p className="public-eyebrow">Catalogue</p>
        <h1 id="catalog-title">Choisissez le canapé à simuler</h1>
        <p className="public-page-lede">
          Parcourez les modèles publiés, filtrez par ambiance, puis ouvrez une
          fiche pour choisir le tissu et lancer une simulation dans votre pièce.
        </p>
      </section>

      {showFilters ? (
        // RU: Эта область показывает фильтры каталога и кнопку для полного списка.
        // FR: Cette zone montre les filtres du catalogue et le bouton pour la liste complete.
        <section
          aria-label="Filtres de catalogue"
          className="catalog-filters"
          ref={filtersContainerRef}
          role="group"
        >
          {inlineTagOptions.map((tag) => (
            <button
              aria-pressed={selectedTags.includes(tag.slug)}
              className="catalog-filter-button"
              key={tag.slug}
              onClick={() => toggleTag(tag.slug)}
              type="button"
            >
              {tag.public_label}
            </button>
          ))}
          {showFilterToggle ? (
            <button
              aria-expanded={filtersDialogOpen}
              aria-haspopup="dialog"
              className="catalog-filter-toggle"
              onClick={openFiltersDialog}
              type="button"
            >
              Voir plus
            </button>
          ) : null}
        </section>
      ) : null}

      {showFilters ? (
        <div
          aria-hidden="true"
          className="catalog-filter-measure"
          ref={filtersMeasureRef}
        >
          {orderedInlineTagOptions.map((tag) => (
            <button
              className="catalog-filter-button"
              data-filter-measure="tag"
              key={tag.slug}
              tabIndex={-1}
              type="button"
            >
              {tag.public_label}
            </button>
          ))}
          <button
            className="catalog-filter-toggle"
            data-filter-measure="toggle"
            tabIndex={-1}
            type="button"
          >
            Voir plus
          </button>
        </div>
      ) : null}

      {filtersDialogOpen ? (
        // RU: Эта область показывает окно, где доступны все фильтры каталога.
        // FR: Cette zone montre la fenetre avec tous les filtres du catalogue.
        <div className="catalog-filter-dialog-backdrop">
          <section
            aria-labelledby="catalog-filter-dialog-title"
            aria-modal="true"
            className="catalog-filter-dialog"
            role="dialog"
          >
            <div className="catalog-filter-dialog-header">
              <h2 id="catalog-filter-dialog-title">Tous les filtres</h2>
              <button
                aria-label="Fermer les filtres"
                className="catalog-filter-dialog-close"
                onClick={closeFiltersDialog}
                type="button"
              >
                X
              </button>
            </div>
            <div className="catalog-filter-dialog-list">
              {tagOptions.map((tag) => (
                <button
                  aria-pressed={selectedTags.includes(tag.slug)}
                  className="catalog-filter-button catalog-filter-dialog-button"
                  key={tag.slug}
                  onClick={() => toggleTag(tag.slug)}
                  type="button"
                >
                  {tag.public_label}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {status === "loading" ? (
        <section className="public-status-panel" aria-live="polite">
          Chargement du catalogue...
        </section>
      ) : null}

      {status === "error" ? (
        <section className="public-status-panel" aria-live="polite">
          <p>Le catalogue est temporairement indisponible.</p>
          <button
            className="public-secondary-button"
            onClick={() => loadFirstPage(readTagsFromLocation(), { replaceHistory: true })}
            type="button"
          >
            Réessayer
          </button>
        </section>
      ) : null}

      {isEmpty ? (
        <section className="public-status-panel">
          Aucun canapé publié pour le moment.
        </section>
      ) : null}

      {isNoResults ? (
        <section className="public-status-panel">
          <p>Aucun canapé ne correspond à ces filtres.</p>
          <button
            className="public-secondary-button"
            onClick={clearFilters}
            type="button"
          >
            Réinitialiser les filtres
          </button>
        </section>
      ) : null}

      {items.length > 0 ? (
        // RU: Эта область показывает карточки опубликованных диванов.
        // FR: Cette zone montre les cartes des canapes publies.
        <section className="catalog-grid" aria-label="Canapés publiés">
          {items.map((item) => (
            <CatalogCard item={item} key={item.id} />
          ))}
        </section>
      ) : null}

      {items.length > 0 && nextCursor ? (
        <section className="catalog-pagination" aria-live="polite">
          {loadMoreError ? (
            <p>Impossible de charger la suite du catalogue.</p>
          ) : null}
          <button
            className="public-primary-button"
            disabled={loadMoreStatus === "loading"}
            onClick={loadMore}
            type="button"
          >
            {loadMoreError ? "Réessayer" : "Charger plus"}
          </button>
        </section>
      ) : null}
    </PublicShell>
  );
}

function CatalogCard({ item }: { item: PublicCatalogItemResponse }) {
  // RU: Эти значения держат загрузку тканей, выбранную ткань и ошибку картинки в карточке.
  // FR: Ces valeurs gardent le chargement des tissus, le tissu choisi et l'erreur d'image dans la carte.
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [detail, setDetail] = useState<PublicSofaDetailResponse | null>(null);
  const [selectedFabricId, setSelectedFabricId] = useState(item.default_fabric_id);
  const [imageFailed, setImageFailed] = useState(false);

  // RU: Этот автоматический блок загружает ткани и картинки для смены ткани в карточке.
  // FR: Ce bloc automatique charge les tissus et les images pour changer le tissu dans la carte.
  useEffect(() => {
    let isCurrent = true;

    async function loadFabricControls() {
      setDetailStatus("loading");

      try {
        const loadedDetail = await fetchSofaDetail(item.public_slug);

        if (!isCurrent) {
          return;
        }

        const hasSelectedFabric = loadedDetail.fabrics.some(
          (fabric) => fabric.id === item.default_fabric_id,
        );

        setDetail(loadedDetail);
        setSelectedFabricId(
          hasSelectedFabric
            ? item.default_fabric_id
            : loadedDetail.defaults.fabric_id,
        );
        setDetailStatus("ready");
      } catch {
        if (isCurrent) {
          setDetailStatus("error");
        }
      }
    }

    void loadFabricControls();

    return () => {
      isCurrent = false;
    };
  }, [item.default_fabric_id, item.public_slug]);

  // RU: Этот адрес показывает среднюю картинку выбранной ткани в карточке каталога.
  // FR: Cette adresse montre l'image moyenne du tissu choisi dans la carte du catalogue.
  const activeRenderUrl = useMemo(() => {
    const render = detail?.renders.find(
      (candidate) =>
        candidate.fabric_id === selectedFabricId &&
        candidate.visual_position_id === item.default_visual_position_id,
    );

    return (
      render?.render_medium_url ??
      item.default_render_medium_url ??
      render?.render_url ??
      item.default_render_url
    );
  }, [
    detail?.renders,
    item.default_render_medium_url,
    item.default_render_url,
    item.default_visual_position_id,
    selectedFabricId,
  ]);

  // RU: Эти данные показывают первые ткани и число скрытых тканей в карточке.
  // FR: Ces donnees montrent les premiers tissus et le nombre de tissus caches dans la carte.
  const visibleFabrics = detail?.fabrics.slice(0, VISIBLE_FABRIC_LIMIT) ?? [];
  const hiddenFabricCount = detail
    ? Math.max(0, detail.fabrics.length - VISIBLE_FABRIC_LIMIT)
    : 0;
  // RU: Эти данные показывают метки карточки и число оставшихся меток в том же списке.
  // FR: Ces donnees montrent les etiquettes de la carte et le nombre d'etiquettes restantes dans la meme liste.
  const visibleTags = item.tags.slice(0, CATALOG_CARD_TAG_LIMIT);
  const hiddenTagCount = Math.max(0, item.tags.length - visibleTags.length);

  // RU: Это действие выбирает ткань в карточке и снова пробует показать картинку.
  // FR: Cette action choisit un tissu dans la carte et essaie a nouveau d'afficher l'image.
  function selectFabric(fabricId: string) {
    setSelectedFabricId(fabricId);
    setImageFailed(false);
  }

  // RU: Это действие запоминает выбранную ткань перед переходом к странице дивана.
  // FR: Cette action garde le tissu choisi avant d'aller vers la page du canape.
  function rememberSelection() {
    if (selectedFabricId !== item.default_fabric_id) {
      writeSessionJson(`${CATALOG_SELECTION_PREFIX}${item.public_slug}`, {
        fabric_id: selectedFabricId,
      });
    }
  }

  return (
    <article className="catalog-card">
      <div className="catalog-card-image">
        {imageFailed ? (
          <span>Image indisponible</span>
        ) : (
          <img
            alt={item.public_name}
            onError={() => setImageFailed(true)}
            src={activeRenderUrl}
          />
        )}
      </div>
      <div className="catalog-card-body">
        <div>
          <h2>{item.public_name}</h2>
          <p>{formatCompactMetadata(item)}</p>
        </div>
        <TagList hiddenCount={hiddenTagCount} tags={visibleTags} />
        <div className="catalog-card-preview">
          <p className="catalog-fabric-label">Tissus</p>
          {detailStatus === "loading" ? <p>Chargement des tissus...</p> : null}
          {detailStatus === "error" ? (
            <p>Les tissus ne peuvent pas être affichés pour le moment.</p>
          ) : null}
          {detailStatus === "ready" && detail ? (
            <div className="catalog-swatches" aria-label={`Tissus de ${item.public_name}`}>
              {visibleFabrics.map((fabric) => (
                <button
                  aria-label={fabric.public_name}
                  aria-pressed={selectedFabricId === fabric.id}
                  className="catalog-swatch-button"
                  key={fabric.id}
                  onClick={() => selectFabric(fabric.id)}
                  type="button"
                >
                  <img alt="" src={fabric.swatch_small_url} />
                </button>
              ))}
              {hiddenFabricCount > 0 ? (
                <span className="catalog-swatch-more">+{hiddenFabricCount}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <a
          className="catalog-card-link"
          href={`/sofas/${item.public_slug}`}
          onClick={rememberSelection}
        >
          <span aria-hidden="true">✧</span>
          <span>Simuler {item.public_name}</span>
        </a>
      </div>
    </article>
  );
}

function TagList({
  hiddenCount,
  tags,
}: {
  hiddenCount: number;
  tags: PublicTagResponse[];
}) {
  if (tags.length === 0 && hiddenCount === 0) {
    return null;
  }

  return (
    <ul className="public-tag-list">
      {tags.map((tag) => (
        <li key={tag.slug}>{tag.public_label}</li>
      ))}
      {hiddenCount > 0 ? (
        <li className="catalog-more-tags">+{hiddenCount} tag</li>
      ) : null}
    </ul>
  );
}

async function fetchCatalogTags() {
  const response = await fetch("/api/public/catalog/tags");
  const body = (await response.json()) as ApiEnvelope<{ items: PublicTagResponse[] }>;

  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Catalog tags unavailable.");
  }

  return body.data.items;
}

async function fetchCatalogPage(input: { cursor: string | null; tags: string[] }) {
  const params = new URLSearchParams();
  params.set("limit", String(CATALOG_LIMIT));

  for (const tag of input.tags) {
    params.append("tag", tag);
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  const response = await fetch(`/api/public/catalog?${params.toString()}`);
  const body = (await response.json()) as ApiEnvelope<{
    items: PublicCatalogItemResponse[];
    next_cursor: string | null;
  }>;

  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Catalog unavailable.");
  }

  return body.data;
}

async function fetchSofaDetail(publicSlug: string) {
  const response = await fetch(`/api/public/sofas/${publicSlug}`);
  const body = (await response.json()) as ApiEnvelope<PublicSofaDetailResponse>;

  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Sofa detail unavailable.");
  }

  return body.data;
}

function dedupeCatalogItems(items: PublicCatalogItemResponse[]) {
  const byId = new Map<string, PublicCatalogItemResponse>();

  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}

function readTagsFromLocation() {
  return uniqueSafeTags(new URLSearchParams(window.location.search).getAll("tag"));
}

function writeCatalogUrl(tags: string[], mode: "push" | "replace") {
  const params = new URLSearchParams();

  for (const tag of uniqueSafeTags(tags)) {
    params.append("tag", tag);
  }

  const url = params.toString() ? `/catalog?${params.toString()}` : "/catalog";

  if (mode === "push") {
    window.history.pushState({}, "", url);
    return;
  }

  window.history.replaceState({}, "", url);
}

function getOrderedInlineFilterOptions(input: {
  selectedTags: string[];
  tags: PublicTagResponse[];
}) {
  if (input.selectedTags.length === 0) {
    return input.tags;
  }

  const selected = new Set(input.selectedTags);
  const selectedTags = input.tags.filter((tag) => selected.has(tag.slug));
  const unselectedTags = input.tags.filter((tag) => !selected.has(tag.slug));

  return [...selectedTags, ...unselectedTags];
}

export function getOneLineFilterLimit(input: {
  containerWidth: number;
  gap: number;
  tagWidths: number[];
  toggleWidth: number;
}) {
  if (input.tagWidths.length === 0) {
    return 0;
  }

  const allTagsWidth =
    input.tagWidths.reduce((total, width) => total + width, 0) +
    input.gap * Math.max(0, input.tagWidths.length - 1);

  if (allTagsWidth <= input.containerWidth) {
    return input.tagWidths.length;
  }

  let selectedWidth = 0;
  let visibleCount = 0;

  for (const width of input.tagWidths) {
    const nextCount = visibleCount + 1;
    const nextTagsWidth = selectedWidth + width;
    const nextWidthWithToggle =
      nextTagsWidth + input.gap * nextCount + input.toggleWidth;

    if (nextWidthWithToggle > input.containerWidth) {
      break;
    }

    selectedWidth = nextTagsWidth;
    visibleCount = nextCount;
  }

  return Math.max(1, Math.min(visibleCount, input.tagWidths.length - 1));
}

export function getMobileOneLineFilterLimit(input: {
  containerWidth: number;
  gap: number;
  tagWidths: number[];
}) {
  if (input.tagWidths.length === 0) {
    return 0;
  }

  let selectedWidth = 0;
  let visibleCount = 0;

  for (const width of input.tagWidths) {
    const nextWidth =
      selectedWidth + width + (visibleCount > 0 ? input.gap : 0);

    if (nextWidth > input.containerWidth) {
      break;
    }

    selectedWidth = nextWidth;
    visibleCount += 1;
  }

  return Math.max(1, Math.min(visibleCount, input.tagWidths.length));
}

function parseCssPixelValue(value: string) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueSafeTags(values: string[]) {
  const unique = new Set<string>();

  for (const value of values) {
    const tag = value.trim().toLowerCase();

    if (TAG_SLUG_PATTERN.test(tag)) {
      unique.add(tag);
    }
  }

  return [...unique];
}

function formatCompactMetadata(item: PublicCatalogItemResponse) {
  const dimensions = [
    item.dimensions.length_cm ? `${item.dimensions.length_cm} cm` : null,
    item.dimensions.depth_cm ? `P ${item.dimensions.depth_cm} cm` : null,
    item.dimensions.height_cm ? `H ${item.dimensions.height_cm} cm` : null,
  ].filter(Boolean);

  return dimensions.length > 0
    ? dimensions.join(" · ")
    : "Prêt pour la simulation à domicile";
}

function writeSessionJson(key: string, value: Record<string, string>) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session memory is a small extra for internal navigation.
  }
}
