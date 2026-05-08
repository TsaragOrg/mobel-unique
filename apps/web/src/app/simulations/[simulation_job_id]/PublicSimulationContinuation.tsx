"use client";

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
import type { SimulationStatusResponse } from "../../../lib/simulation-public-api";

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

const FALLBACK_CONTEXT: SimulationJobContext = {
  slug: "",
  sofaName: "Simulation",
  fabricName: "",
  visualPositionLabel: ""
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

  const [context] = useState<SimulationJobContext>(
    () => loadJobContext(props.jobId) ?? FALLBACK_CONTEXT
  );
  const [previousResultUrl, setPreviousResultUrl] = useState<string | null>(null);
  const [realtimeConnection, setRealtimeConnection] =
    useState<SimulationProgressConnectionState>("connecting");

  const { snapshot, refresh } = useSimulationStatusPoll(props.jobId, {
    errorBackoffMs: STATUS_ERROR_BACKOFF_MS,
    fetchStatus: () => fetchStatus(props.jobId),
    intervalMs:
      realtimeConnection === "connected"
        ? REALTIME_CONNECTED_RECONCILE_POLL_MS
        : realtimeConnection === "unavailable"
        ? REALTIME_UNAVAILABLE_POLL_MS
        : REALTIME_CONNECTING_POLL_MS
  });

  useEffect(() => {
    return subscribeProgress({
      jobId: props.jobId,
      onConnectionState: setRealtimeConnection,
      onError: (error) => {
        console.error("[simulations] progress realtime failed:", error);
      },
      onProgress: () => refresh()
    });
    // Realtime is the primary progress channel. The poller is retained as a
    // slow reconciliation read so a missed Realtime event cannot strand the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.jobId, subscribeProgress]);

  useEffect(() => {
    if (snapshot?.status === "succeeded" && snapshot.latest_output_url) {
      setPreviousResultUrl(snapshot.latest_output_url);
    }
  }, [snapshot?.status, snapshot?.latest_output_url]);

  useEffect(() => {
    if (snapshot && POLL_TERMINAL_STATUSES.has(snapshot.status)) {
      // Once a job reaches a terminal state, the cached display
      // context is no longer needed; clear it so a different job
      // under the same browser does not inherit stale labels.
      if (snapshot.status === "expired") {
        clearJobContext(props.jobId);
      }
    }
  }, [snapshot?.status, props.jobId]);

  const screen = useMemo(() => {
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
      context,
      previousResultUrl,
      onRefresh: refresh
    });
  }, [snapshot, context, previousResultUrl, refresh, props.jobId]);

  return <PublicShell currentPath="detail">{screen}</PublicShell>;
}

interface RenderScreenArgs {
  jobId: string;
  snapshot: SimulationStatusResponse;
  context: SimulationJobContext;
  previousResultUrl: string | null;
  onRefresh: () => void;
}

function renderScreenForStatus(args: RenderScreenArgs) {
  const { snapshot, context, jobId, previousResultUrl, onRefresh } = args;
  const backToSofaHref = context.slug ? `/sofas/${context.slug}` : "/catalog";
  const restartHref = context.slug
    ? `/sofas/${context.slug}/simulate`
    : undefined;
  const stripContext = {
    sofaName: context.sofaName,
    fabricName: context.fabricName,
    visualPositionLabel: context.visualPositionLabel
  };

  switch (snapshot.status) {
    case "queued":
    case "room_prep_processing":
      return <Screen2RoomPrep {...stripContext} />;

    case "awaiting_dimensions":
      if (!snapshot.dimension_guide_overlay_url) {
        return <Screen2RoomPrep {...stripContext} />;
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
          jobId={jobId}
          onRegenerationStarted={onRefresh}
          onResultImageError={onRefresh}
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
