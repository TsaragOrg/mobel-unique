// SPEC-0015 PLAN-0040 default dependency factory for the public
// simulation route handlers.
//
// Route.ts files call `createDefaultSimulationPublicEmailHandlerDeps`
// to get the launch-window stub configuration; later phases will add
// factories for the storage-backed simulation handlers.

import type { SimulationEnvironment } from "./simulation-access-token";
import type { SimulationPublicEmailHandlerDeps } from "./simulation-public-route-handlers";

export function createDefaultSimulationPublicEmailHandlerDeps(): SimulationPublicEmailHandlerDeps {
  return {
    accessTokenSecret: requiredEnv("SIMULATION_ACCESS_TOKEN_SECRET"),
    environment: readSimulationEnvironment(process.env.NEXT_PUBLIC_APP_ENV)
  };
}

export function readSimulationEnvironment(
  value: string | undefined
): SimulationEnvironment {
  if (value === "dev" || value === "prod") {
    return value;
  }
  return "local";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
