import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260509000600_remove_in_home_simulation_worker_crons.sql";

describe("PLAN-0068 in-home simulation worker cron removal migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("unschedules the legacy in-home worker and recovery cron jobs", () => {
    expect(sql).toContain(
      "cron.unschedule('in-home-simulation-worker-runner')",
    );
    expect(sql).toContain(
      "cron.unschedule('in-home-simulation-recovery-runner')",
    );
  });

  it("does not create a replacement in-home worker cron schedule", () => {
    expect(sql).not.toContain("cron.schedule(");
    expect(sql).not.toContain("vault.secrets");
    expect(sql).not.toContain("in_home_simulation_worker_function_url");
    expect(sql).not.toContain("in_home_simulation_worker_invoke_secret");
  });
});
