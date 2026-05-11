import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "supabase/functions/in-home-simulation-purge/index.ts",
  "utf8"
).replace(/\r\n/g, "\n");

describe("in-home simulation purge function identity cleanup", () => {
  it("protects deployed purge invocations with a dedicated secret header", () => {
    expect(source).toContain("validatePurgeInvocation");
    expect(source).toContain("IN_HOME_SIMULATION_PURGE_INVOKE_SECRET");
    expect(source).toContain("x-in-home-simulation-purge-secret");
    expect(source).toContain("isLocalPurgeEnvironment");
  });

  it("purges public simulation email handoffs through the service-role RPC", () => {
    expect(source).toContain("purgeEmailHandoffs");
    expect(source).toContain("purge_public_simulation_email_handoffs");
    expect(source).toContain("PUBLIC_SIMULATION_EMAIL_HANDOFF_PURGE_BATCH_SIZE");
    expect(source).toContain("email_handoffs_purged");
  });

  it("delegates database-side checkpoint and progress redaction to the purge RPC", () => {
    expect(source).toContain("mark_in_home_simulation_job_purged");
    expect(source).toContain(
      "artifact, checkpoint, dispatch, and progress state",
    );
  });

  it("deletes only Auth users marked as transient public simulation users", () => {
    expect(source).toContain("/auth/v1/admin/users/");
    expect(source).toContain("deleteAuthUser");
    expect(source).toContain("isPublicSimulationTransientUser");
    expect(source).toContain("public_simulation_transient");
    expect(source).toContain("in_home_simulation_email_otp");
    expect(source).toContain("skipped_non_transient");
    expect(source).toContain("hasAdminClaim");
    expect(source).toContain("skipped_protected_admin");
    expect(source).toContain("mobel_unique");
  });
});
