import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260503002000_in_home_simulation_requeue_recovered_jobs.sql";

describe("PLAN-0057 requeue-recovered-jobs migration", () => {
  it("creates enqueue_in_home_simulation_placement_message", async () => {
    const source = await readFile(migrationPath, "utf8");
    expect(source).toContain(
      "create or replace function public.enqueue_in_home_simulation_placement_message"
    );
    expect(source).toContain(
      "'type', 'in_home_simulation_placement'"
    );
    expect(source).toContain("pgmq.send(");
  });

  it("creates requeue_recovered_in_home_simulation_jobs that composes recovery + enqueue", async () => {
    const source = await readFile(migrationPath, "utf8");
    expect(source).toContain(
      "create or replace function public.requeue_recovered_in_home_simulation_jobs"
    );
    expect(source).toMatch(
      /select \*\s+from public\.recover_expired_in_home_simulation_claims/
    );
    expect(source).toContain(
      "public.enqueue_in_home_simulation_room_prep_message"
    );
    expect(source).toContain(
      "public.enqueue_in_home_simulation_placement_message"
    );
  });

  it("returns the same row shape as the underlying recovery RPC", async () => {
    const source = await readFile(migrationPath, "utf8");
    expect(source).toMatch(
      /returns table \(\s*job_id uuid,\s*previous_status public\.simulation_job_status,\s*new_status public\.simulation_job_status,\s*reason text\s*\)/
    );
  });

  it("re-schedules the recovery cron to call the wrapper", async () => {
    const source = await readFile(migrationPath, "utf8");
    expect(source).toContain(
      "perform cron.unschedule('in-home-simulation-recovery-runner')"
    );
    expect(source).toContain(
      "cron.schedule"
    );
    expect(source).toContain(
      "public.requeue_recovered_in_home_simulation_jobs(100"
    );
    expect(source).toMatch(/'\* \* \* \* \*'/);
  });

  it("grants execute to service_role on both new functions", async () => {
    const source = await readFile(migrationPath, "utf8");
    expect(source).toContain(
      "grant execute on function public.enqueue_in_home_simulation_placement_message(uuid, text)"
    );
    expect(source).toContain(
      "grant execute on function public.requeue_recovered_in_home_simulation_jobs(integer, text)"
    );
  });
});
