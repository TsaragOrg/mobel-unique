import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
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

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  expect(result.status).toBe(0);
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

describe("spec guard plan checks", () => {
  it("ignores README files in active and done plan directories", () => {
    const cwd = writeSpecRepo(`# SPEC-0001 Example Spec

Spec: SPEC-0001
Status: accepted

## Goal

This spec exists to test plan directory README handling.
`);

    mkdirSync(join(cwd, "docs/plans/active"), { recursive: true });
    mkdirSync(join(cwd, "docs/plans/done"), { recursive: true });
    writeFileSync(join(cwd, "docs/plans/active/README.md"), "# Active Plans\n");
    writeFileSync(join(cwd, "docs/plans/done/README.md"), "# Done Plans\n");

    const result = runGuard(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Specification guard passed");
  });

  it("allows moving a completed plan from active to done", () => {
    const cwd = writeSpecRepo(`# SPEC-0001 Example Spec

Spec: SPEC-0001
Status: accepted

## Goal

This spec exists to test completed plan movement.
`);

    mkdirSync(join(cwd, "docs/plans/active"), { recursive: true });
    mkdirSync(join(cwd, "docs/plans/done"), { recursive: true });
    writeFileSync(join(cwd, "docs/plans/active/README.md"), "# Active Plans\n");
    writeFileSync(join(cwd, "docs/plans/done/README.md"), "# Done Plans\n");

    const activePlanPath = join(cwd, "docs/plans/active/PLAN-0001-test.md");
    const donePlanPath = join(cwd, "docs/plans/done/PLAN-0001-test.md");

    writeFileSync(
      activePlanPath,
      `# Test Plan

Plan: PLAN-0001
Spec: SPEC-0001
Status: active
`,
    );

    runGit(cwd, ["init"]);
    runGit(cwd, ["config", "user.email", "test@example.com"]);
    runGit(cwd, ["config", "user.name", "Spec Guard Test"]);
    runGit(cwd, ["add", "."]);
    runGit(cwd, ["commit", "-m", "Initial spec repo"]);

    unlinkSync(activePlanPath);
    writeFileSync(
      donePlanPath,
      `# Test Plan

Plan: PLAN-0001
Spec: SPEC-0001
Status: done
`,
    );

    const result = runGuard(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Specification guard passed");
  });
});
