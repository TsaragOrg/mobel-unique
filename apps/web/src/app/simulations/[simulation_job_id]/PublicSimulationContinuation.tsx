"use client";

/*
RU: Этот файл нужен для страницы, которая продолжает уже созданную симуляцию.
RU: На экране посетитель видит ожидание, ввод размеров, готовый результат или сообщение об ошибке.
RU: Здесь можно дождаться результата, обновить картинку, скачать ее, вернуться к дивану или перейти к покупке.
FR: Ce fichier sert a la page qui continue une simulation deja creee.
FR: A l'ecran, le visiteur voit l'attente, la saisie des mesures, le resultat pret ou un message d'erreur.
FR: Ici, on peut attendre le resultat, actualiser l'image, la telecharger, revenir au canape ou aller acheter.
*/

import { useEffect, useMemo, useState } from "react";

import { PublicShell } from "../../PublicShell";
import { Screen2RoomPrep } from "../../../components/simulation/Screen2RoomPrep";
import { Screen3Dimensions } from "../../../components/simulation/Screen3Dimensions";
import { Screen4Placement } from "../../../components/simulation/Screen4Placement";
import { Screen5Result } from "../../../components/simulation/Screen5Result";
import { Screen6ErrorExpired } from "../../../components/simulation/Screen6ErrorExpired";
import {
  POLL_TERMINAL_STATUSES,
  useSimulationStatusPoll
} from "../../../lib/simulation-client/poll";
import {
  subscribeToSimulationProgress,
  type SimulationProgressConnectionState,
  type SubscribeToSimulationProgressArgs
} from "../../../lib/simulation-client/realtime";
import {
  clearJobContext,
  readJobContext,
  type SimulationJobContext
} from "../../../lib/simulation-client/job-context";
import { SIMULATION_LOCALE } from "../../../lib/simulation-client/locale";
import type {
  SimulationPublicProgressPayload,
  SimulationStatusResponse
} from "../../../lib/simulation-public-api";

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

const FALLBACK_CONTEXT: SimulationJobContext = {
  slug: "",
  sofaName: "Simulation",
  fabricName: "",
  visualPositionLabel: "",
  shopifyOrderUrl: null
};
const REALTIME_CONNECTED_RECONCILE_POLL_MS = 30_000;
const REALTIME_CONNECTING_POLL_MS = 10_000;
const REALTIME_UNAVAILABLE_POLL_MS = 5_000;
const STATUS_ERROR_BACKOFF_MS = [5_000, 10_000, 20_000, 30_000] as const;

export interface PublicSimulationContinuationProps {
  jobId: string;
  fetchStatus?: (jobId: string) => Promise<SimulationStatusResponse>;
  loadJobContext?: (jobId: string) => SimulationJobContext | null;
  subscribeProgress?: (
    args: SubscribeToSimulationProgressArgs
  ) => () => void;
}

export function PublicSimulationContinuation(
  props: PublicSimulationContinuationProps
) {
  const fetchStatus = props.fetchStatus ?? defaultFetchStatus;
  const loadJobContext = props.loadJobContext ?? readJobContext;
  const subscribeProgress =
    props.subscribeProgress ?? subscribeToSimulationProgress;

  // RU: Эти значения держат видимые данные во время пути.
  // FR: Ces valeurs gardent les informations visibles pendant le parcours.
  const [context] = useState<SimulationJobContext>(
    () => loadJobContext(props.jobId) ?? FALLBACK_CONTEXT
  );
  const [latestProgress, setLatestProgress] =
    useState<SimulationPublicProgressPayload | null>(null);
  const [previousResultUrl, setPreviousResultUrl] = useState<string | null>(null);
  const [realtimeConnection, setRealtimeConnection] =
    useState<SimulationProgressConnectionState>("connecting");

  // RU: Эти данные приходят от проверки статуса симуляции.
  // FR: Ces donnees viennent de la verification du statut de simulation.
  const { snapshot, error, refresh } = useSimulationStatusPoll(props.jobId, {
    errorBackoffMs: STATUS_ERROR_BACKOFF_MS,
    fetchStatus: () => fetchStatus(props.jobId),
    intervalMs:
      realtimeConnection === "connected"
        ? REALTIME_CONNECTED_RECONCILE_POLL_MS
        : realtimeConnection === "unavailable"
        ? REALTIME_UNAVAILABLE_POLL_MS
        : REALTIME_CONNECTING_POLL_MS
  });

  // RU: Этот автоматический блок слушает быстрые обновления симуляции.
  // FR: Ce bloc automatique ecoute les mises a jour rapides de la simulation.
  useEffect(() => {
    return subscribeProgress({
      jobId: props.jobId,
      onConnectionState: setRealtimeConnection,
      onError: (error) => {
        console.error("[simulations] progress realtime failed:", error);
      },
      onProgress: (payload) => {
        setLatestProgress(payload);
        refresh();
      }
    });
    // Realtime is the primary progress path. The poller stays as a slow
    // reconciliation read so a missed Realtime event cannot leave the UI behind.
  }, [props.jobId, subscribeProgress]);

  // RU: Этот автоматический блок хранит последнюю удачную картинку.
  // FR: Ce bloc automatique garde la derniere image reussie.
  useEffect(() => {
    if (snapshot?.status === "succeeded" && snapshot.latest_output_url) {
      setPreviousResultUrl(snapshot.latest_output_url);
    }
  }, [snapshot?.status, snapshot?.latest_output_url]);

  // RU: Этот автоматический блок убирает старые данные после конца симуляции.
  // FR: Ce bloc automatique enleve les anciennes donnees apres la fin de simulation.
  useEffect(() => {
    if (snapshot && POLL_TERMINAL_STATUSES.has(snapshot.status)) {
      // Once a job reaches a final result, the cached display context is no
      // longer needed; clear it so a different job in the same browser does not
      // inherit stale labels.
      if (snapshot.status === "expired") {
        clearJobContext(props.jobId);
      }
    }
  }, [snapshot?.status, props.jobId]);

  // RU: Это значение выбирает, какой экран показать посетителю сейчас.
  // FR: Cette valeur choisit quel ecran montrer au visiteur maintenant.
  const screen = useMemo(() => {
    const stripContext = {
      sofaName: context.sofaName,
      fabricName: context.fabricName,
      visualPositionLabel: context.visualPositionLabel
    };
    const backToSofaHref = context.slug ? `/sofas/${context.slug}` : "/catalog";
    const restartHref = context.slug
      ? `/sofas/${context.slug}/simulate`
      : undefined;

    if (!snapshot && error) {
      return (
        <Screen6ErrorExpired
          backToSofaHref={backToSofaHref}
          context={stripContext}
          restartHref={restartHref}
          variant="error"
        />
      );
    }

    if (!snapshot) {
      return (
        <section className="public-status-panel" aria-live="polite">
          {SIMULATION_LOCALE.screen2RoomPrep.reassurance}
        </section>
      );
    }
    return renderScreenForStatus({
      jobId: props.jobId,
      snapshot,
      progress: latestProgress,
      context,
      previousResultUrl,
      onRefresh: refresh
    });
  }, [
    snapshot,
    error,
    latestProgress,
    context,
    previousResultUrl,
    refresh,
    props.jobId
  ]);

  return <PublicShell currentPath="detail">{screen}</PublicShell>;
}

interface RenderScreenArgs {
  jobId: string;
  snapshot: SimulationStatusResponse;
  progress: SimulationPublicProgressPayload | null;
  context: SimulationJobContext;
  previousResultUrl: string | null;
  onRefresh: () => void;
}

function renderScreenForStatus(args: RenderScreenArgs) {
  const { snapshot, progress, context, jobId, previousResultUrl, onRefresh } = args;
  const backToSofaHref = context.slug ? `/sofas/${context.slug}` : "/catalog";
  const restartHref = context.slug
    ? `/sofas/${context.slug}/simulate`
    : undefined;
  const stripContext = {
    sofaName: context.sofaName,
    fabricName: context.fabricName,
    visualPositionLabel: context.visualPositionLabel
  };
  const progressCopy = getSimulationProgressCopy(snapshot, progress);

  switch (snapshot.status) {
    case "queued":
    case "room_prep_processing":
      return <Screen2RoomPrep {...stripContext} {...progressCopy.roomPrep} />;

    case "awaiting_dimensions":
      if (!snapshot.dimension_guide_overlay_url) {
        return <Screen2RoomPrep {...stripContext} {...progressCopy.roomPrep} />;
      }
      return (
        <Screen3Dimensions
          {...stripContext}
          geometryMode={snapshot.room_geometry_mode}
          guideImageUrl={snapshot.dimension_guide_overlay_url}
          jobId={jobId}
          onGuideImageError={onRefresh}
          onSubmitted={onRefresh}
        />
      );

    case "placement_queued":
    case "placement_processing":
      return (
        <Screen4Placement
          {...stripContext}
          {...progressCopy.placement}
          previousResultImageUrl={previousResultUrl}
        />
      );

    case "succeeded":
      if (!snapshot.latest_output_url) {
        return <Screen2RoomPrep {...stripContext} />;
      }
      return (
        <Screen5Result
          {...stripContext}
          backToSofaHref={backToSofaHref}
          generationCount={snapshot.generated_output_count}
          jobId={jobId}
          onRegenerationStarted={onRefresh}
          onResultImageError={onRefresh}
          orderHref={context.shopifyOrderUrl}
          regenerationAvailable={snapshot.regeneration_available}
          resultImageUrl={snapshot.latest_output_url}
        />
      );

    case "failed":
    case "canceled":
      return (
        <Screen6ErrorExpired
          backToSofaHref={backToSofaHref}
          context={stripContext}
          errorDetail={snapshot.last_error ?? null}
          restartHref={restartHref}
          variant="error"
        />
      );

    case "expired":
      return <Screen6ErrorExpired variant="expired" backToCatalogHref="/catalog" />;
  }
}

interface LoadingProgressCopy {
  progressLabel?: string | null;
  reassurance?: string | null;
  title?: string | null;
}

function getSimulationProgressCopy(
  snapshot: SimulationStatusResponse,
  progress: SimulationPublicProgressPayload | null
): {
  placement: LoadingProgressCopy;
  roomPrep: LoadingProgressCopy;
} {
  const progressForJob =
    progress?.simulation_job_id === snapshot.simulation_job_id ? progress : null;
  const key = progressForJob?.progress_step_key ?? null;
  const label = formatProgressStepLabel(
    progressForJob?.progress_step_ordinal ?? null,
    progressForJob?.progress_total_steps ?? null,
    snapshot.status === "placement_queued" || snapshot.status === "placement_processing"
      ? SIMULATION_LOCALE.screen4Placement.progressStepLabel
      : SIMULATION_LOCALE.screen2RoomPrep.progressStepLabel
  );

  if (key === "room_validation") {
    return {
      placement: {},
      roomPrep: {
        ...SIMULATION_LOCALE.screen2RoomPrep.progress.roomValidation,
        progressLabel: label
      }
    };
  }

  if (key === "room_cleaning") {
    return {
      placement: {},
      roomPrep: {
        ...SIMULATION_LOCALE.screen2RoomPrep.progress.roomCleaning,
        progressLabel: label
      }
    };
  }

  if (key === "room_corners") {
    return {
      placement: {},
      roomPrep: {
        ...SIMULATION_LOCALE.screen2RoomPrep.progress.roomCorners,
        progressLabel: label
      }
    };
  }

  if (key === "dimension_guide") {
    return {
      placement: {},
      roomPrep: {
        ...SIMULATION_LOCALE.screen2RoomPrep.progress.dimensionGuide,
        progressLabel: label
      }
    };
  }

  if (key === "awaiting_dimensions") {
    return {
      placement: {},
      roomPrep: {
        ...SIMULATION_LOCALE.screen2RoomPrep.progress.awaitingDimensions,
        progressLabel: label
      }
    };
  }

  if (
    key === "placement_generation" ||
    snapshot.status === "placement_queued" ||
    snapshot.status === "placement_processing"
  ) {
    return {
      placement: {
        ...SIMULATION_LOCALE.screen4Placement.progress.placementGeneration,
        progressLabel: label
      },
      roomPrep: {}
    };
  }

  return {
    placement: {},
    roomPrep: {}
  };
}

function formatProgressStepLabel(
  ordinal: number | null,
  total: number | null,
  template: string
): string | null {
  if (!ordinal || !total) return null;
  return template
    .replace("{current}", String(ordinal))
    .replace("{total}", String(total));
}

async function defaultFetchStatus(
  jobId: string
): Promise<SimulationStatusResponse> {
  const response = await fetch(
    `/api/public/simulations/${encodeURIComponent(jobId)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error(`status request failed (${response.status})`);
  }
  const body = (await response.json()) as ApiEnvelope<SimulationStatusResponse>;
  if (!body.data) {
    throw new Error("status payload missing data");
  }
  return body.data;
}
