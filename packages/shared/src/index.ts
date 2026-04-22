export type AppEnvironment = "dev" | "prod" | "local";

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "dev" || value === "prod") {
    return value;
  }

  return "local";
}

