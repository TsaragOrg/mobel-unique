export type ImageWorkerConfig = {
  appEnv: string;
  heartbeatMs: number;
};

export function getImageWorkerConfig(env: NodeJS.ProcessEnv = process.env): ImageWorkerConfig {
  return {
    appEnv: env.APP_ENV ?? "local",
    heartbeatMs: Number(env.IMAGE_WORKER_HEARTBEAT_MS ?? 60000)
  };
}

