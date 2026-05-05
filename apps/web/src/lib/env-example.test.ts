import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("web environment example", () => {
  it("documents the public Supabase env names", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
  });

  it("never prefixes the service-role key with NEXT_PUBLIC_", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(envExample).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE");
    expect(envExample).not.toContain("NEXT_PUBLIC_SERVICE_ROLE");
  });

  it("documents the SPEC-0015 PLAN-0040 public simulation server-side env names", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExample).toContain("SIMULATION_ACCESS_TOKEN_SECRET=");
    expect(envExample).toContain("SIMULATION_RATE_LIMIT_SUBJECT_SALT=");
    expect(envExample).toContain("SIMULATION_RATE_LIMIT_IP_PER_DAY=");
    expect(envExample).toContain("SIMULATION_RATE_LIMIT_EMAIL_PER_DAY=");
    expect(envExample).toContain("SIMULATION_QUEUE_NAME=");
    expect(envExample).toContain("SIMULATION_CORNER_TAG_SLUG=");
    expect(envExample).toContain("SIMULATION_RETENTION_HOURS=");
  });
});
