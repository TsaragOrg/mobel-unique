import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/quality.yml", "utf8");

describe("Supabase DEV deploy workflow", () => {
  it("applies missing out-of-order migrations without seed data", () => {
    const dbPushLine = workflow
      .split("\n")
      .find((line) => line.includes("supabase db push"));

    expect(dbPushLine).toContain("--include-all");
    expect(dbPushLine).not.toContain("--include-seed");
  });
});
