"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "../supabase-browser";
import type {
  SimulationPublicProgressPayload,
  SimulationRealtimeTokenResponse
} from "../simulation-public-api";

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

export interface SubscribeToSimulationProgressArgs {
  jobId: string;
  fetchToken?: (jobId: string) => Promise<SimulationRealtimeTokenResponse>;
  getClient?: () => SupabaseClient;
  onConnectionState?: (state: SimulationProgressConnectionState) => void;
  onError: (error: unknown) => void;
  onProgress: (payload: SimulationPublicProgressPayload) => void;
}

export type SimulationProgressUnsubscribe = () => void;
export type SimulationProgressConnectionState =
  | "connecting"
  | "connected"
  | "unavailable";

export function subscribeToSimulationProgress(
  args: SubscribeToSimulationProgressArgs
): SimulationProgressUnsubscribe {
  const fetchToken = args.fetchToken ?? defaultFetchRealtimeToken;
  const getClient = args.getClient ?? getBrowserSupabaseClient;
  let closed = false;
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;

  args.onConnectionState?.("connecting");

  void fetchToken(args.jobId)
    .then((token) => {
      if (closed) return;
      const client = getClient();
      client.realtime.setAuth(token.realtime_token);
      channel = client
        .channel(`simulation-progress:${args.jobId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `simulation_job_id=eq.${args.jobId}`,
            schema: "public",
            table: "simulation_public_progress"
          },
          (payload) => {
            const next = payload.new as SimulationPublicProgressPayload | null;
            if (next) {
              args.onProgress(next);
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            args.onConnectionState?.("connected");
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            args.onConnectionState?.("unavailable");
            args.onError(new Error(`simulation progress realtime ${status}`));
          }
        });
    })
    .catch((error) => {
      if (!closed) {
        args.onConnectionState?.("unavailable");
        args.onError(error);
      }
    });

  return () => {
    closed = true;
    if (channel) {
      void getClient().removeChannel(channel);
      channel = null;
    }
  };
}

export async function defaultFetchRealtimeToken(
  jobId: string
): Promise<SimulationRealtimeTokenResponse> {
  const response = await fetch(
    `/api/public/simulations/${encodeURIComponent(jobId)}/realtime-token`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error(`realtime token request failed (${response.status})`);
  }
  const body = (await response.json()) as ApiEnvelope<SimulationRealtimeTokenResponse>;
  if (!body.data) {
    throw new Error("realtime token payload missing data");
  }
  return body.data;
}
