import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "spec-guard.mjs",
);

function writeSpecRepo(specBody) {
  const cwd = mkdtempSync(join(tmpdir(), "mobel-spec-guard-test-"));
  mkdirSync(join(cwd, "docs/specs/accepted"), { recursive: true });

  writeFileSync(
    join(cwd, "docs/specs/manifest.json"),
    JSON.stringify(
      {
        version: 1,
        specs: [
          {
            id: "SPEC-0001",
            title: "Example Spec",
            status: "accepted",
            path: "docs/specs/accepted/SPEC-0001-example.md",
            areas: ["workflow"],
          },
        ],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(cwd, "docs/specs/accepted/SPEC-0001-example.md"),
    specBody,
  );

  return cwd;
}

function runGuard(cwd) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("spec guard language checks", () => {
  it("allows English spec content", () => {
    const cwd = writeSpecRepo(`# SPEC-0001 Example Spec

Spec: SPEC-0001
Status: accepted

## Goal

MÖBEL UNIQUE uses this spec to describe an English-only repository workflow.
`);

    const result = runGuard(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Specification guard passed");
  });

  it("rejects non-English spec content", () => {
    const cwd = writeSpecRepo(`# SPEC-0001 Example Spec

Spec: SPEC-0001
Status: accepted

## Goal

L'outil doit permettre aux clients de choisir un tissu.
`);

    const result = runGuard(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Specification guard failed");
    expect(result.stderr).toContain(
      "docs/specs/accepted/SPEC-0001-example.md:8 appears to contain non-English spec text",
    );
  });
});

describe("spec guard accepted spec readiness checks", () => {
  it("rejects accepted specs with pre-acceptance blocker language", () => {
    const cwd = writeSpecRepo(`# SPEC-0001 Example Spec

Spec: SPEC-0001
Status: accepted

## Grey Areas To Resolve Before Acceptance

The following areas need explicit product decisions before this spec can be accepted:

- Exact result-screen implementation.
`);

    const result = runGuard(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Specification guard failed");
    expect(result.stderr).toContain(
      "docs/specs/accepted/SPEC-0001-example.md:6 is accepted but contains pre-acceptance blocker language",
    );
    expect(result.stderr).toContain(
      "docs/specs/accepted/SPEC-0001-example.md:8 is accepted but contains pre-acceptance blocker language",
    );
  });
});
