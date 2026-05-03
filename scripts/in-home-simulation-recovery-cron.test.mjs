import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260503001000_in_home_simulation_recovery_cron.sql";

describe("PLAN-0056 in-home simulation recovery cron migration", () => {
  it("schedules the recovery cron job every minute", async () => {
    const source = await readFile(migrationPath, "utf8");

    expect(source).toContain("create extension if not exists pg_cron");
    expect(source).toContain("'in-home-simulation-recovery-runner'");
    expect(source).toContain("'* * * * *'");
  });

  it("calls the existing recover_expired_in_home_simulation_claims RPC", async () => {
    const source = await readFile(migrationPath, "utf8");

    expect(source).toContain(
      "public.recover_expired_in_home_simulation_claims("
    );
  });

  it("idempotently unschedules an existing job before re-creating it", async () => {
    const source = await readFile(migrationPath, "utf8");

    expect(source).toMatch(
      /if exists[\s\S]*?cron\.job[\s\S]*?cron\.unschedule\('in-home-simulation-recovery-runner'\)/
    );
  });
});
