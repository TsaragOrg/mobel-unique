import { describe, expect, it } from "vitest";
import { getImageWorkerConfig } from "./config";

describe("image worker config", () => {
  it("uses local defaults", () => {
    expect(getImageWorkerConfig({})).toEqual({
      appEnv: "local",
      heartbeatMs: 60000
    });
  });

  it("reads configured environment values", () => {
    expect(
      getImageWorkerConfig({
        APP_ENV: "dev",
        IMAGE_WORKER_HEARTBEAT_MS: "1000"
      })
    ).toEqual({
      appEnv: "dev",
      heartbeatMs: 1000
    });
  });
});

