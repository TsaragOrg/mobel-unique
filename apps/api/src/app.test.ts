import { inject } from "light-my-request";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("API health endpoint", () => {
  it("returns service readiness details", async () => {
    const response = await inject(createApp({ appEnv: "test" }), {
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      environment: "test",
      service: "api",
      status: "ok"
    });
  });
});
