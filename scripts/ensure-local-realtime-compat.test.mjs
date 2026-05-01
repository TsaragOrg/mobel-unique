import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptSource = readFileSync(
  "scripts/ensure-local-realtime-compat.mjs",
  "utf8",
);
const localSupabaseGuide = readFileSync(
  "docs/local-supabase-worker-development.md",
  "utf8",
);

describe("local Realtime compatibility workflow", () => {
  it("keeps the local Realtime compatibility patch wired into resets", () => {
    expect(packageJson.scripts["supabase:realtime:local-compat"]).toBe(
      "node scripts/ensure-local-realtime-compat.mjs",
    );
    expect(packageJson.scripts["supabase:reset"]).toContain(
      "pnpm supabase:realtime:local-compat",
    );
    expect(packageJson.scripts["supabase:reset:db-only"]).toContain(
      "pnpm supabase:realtime:local-compat",
    );
  });

  it("patches only local Supabase Realtime subscription metadata", () => {
    expect(scriptSource).toContain(
      "refusing to patch a non-local database",
    );
    expect(scriptSource).toContain("realtime.subscription");
    expect(scriptSource).toContain(
      "subscription_subscription_id_entity_filters_key",
    );
    expect(scriptSource).toContain("supabase_admin:postgres@127.0.0.1:54322");
  });

  it("documents how to repair local Realtime when subscriptions are silent", () => {
    expect(localSupabaseGuide).toContain(
      "pnpm supabase:realtime:local-compat",
    );
    expect(localSupabaseGuide).toContain("ERROR 42P10");
  });
});
