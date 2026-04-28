import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("web environment example", () => {
  it("does not expose server-only Supabase credentials to browser-facing env", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    expect(envExample).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(envExample).not.toContain("SERVICE_ROLE");
  });
});
