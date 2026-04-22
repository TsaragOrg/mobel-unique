import { describe, expect, it } from "vitest";
import { parseAppEnvironment } from "./index";

describe("parseAppEnvironment", () => {
  it("accepts supported deployed environments", () => {
    expect(parseAppEnvironment("dev")).toBe("dev");
    expect(parseAppEnvironment("prod")).toBe("prod");
  });

  it("falls back to local for unknown values", () => {
    expect(parseAppEnvironment(undefined)).toBe("local");
    expect(parseAppEnvironment("staging")).toBe("local");
  });
});

