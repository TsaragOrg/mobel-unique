import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBranchName, parseBranchArgs, validateBranchRequest } from "./create-branch.mjs";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "create-branch.mjs");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }

  return result.stdout.trim();
}

describe("AI branch workflow", () => {
  it("builds a branch name from workflow metadata", () => {
    expect(
      buildBranchName({
        area: "web",
        plan: "PLAN-0002",
        spec: "SPEC-0002",
        type: "feature",
        work: "Admin catalogue upload"
      })
    ).toBe("feature/web/spec-0002-plan-0002-admin-catalogue-upload");
  });

  it("supports spec drafting branches without an accepted spec id", () => {
    expect(
      buildBranchName({
        area: "workflow",
        type: "spec",
        work: "branch naming rules"
      })
    ).toBe("spec/workflow/branch-naming-rules");
  });

  it("rejects invalid branch metadata", () => {
    expect(
      validateBranchRequest({
        area: "frontend",
        spec: "2",
        type: "task",
        work: ""
      })
    ).toEqual([
      "type must be one of: chore, docs, feature, fix, hotfix, refactor, spec, test",
      "area must be one of: api, image-worker, repo, shared, supabase, web, workflow",
      "work is required",
      "spec must match SPEC-0000 format"
    ]);
  });

  it("rejects overly long generated names", () => {
    expect(
      validateBranchRequest({
        area: "web",
        type: "feature",
        work: "a ".repeat(80)
      })
    ).toContain("branch name must be 120 characters or less");
  });

  it("parses the pnpm argument separator", () => {
    expect(
      parseBranchArgs([
        "--",
        "--dry-run",
        "--type",
        "feature",
        "--area",
        "web",
        "--work",
        "Admin catalogue upload"
      ])
    ).toEqual({
      allowDirty: false,
      area: "web",
      base: "dev",
      dryRun: true,
      type: "feature",
      work: "Admin catalogue upload"
    });
  });

  it("creates a branch from dev in a git repository", () => {
    const cwd = mkdtempSync(join(tmpdir(), "mobel-branch-test-"));

    run("git", ["init", "-b", "dev"], cwd);
    run("git", ["config", "user.email", "test@example.com"], cwd);
    run("git", ["config", "user.name", "Test User"], cwd);
    writeFileSync(join(cwd, "README.md"), "# Test\n");
    run("git", ["add", "README.md"], cwd);
    run("git", ["commit", "-m", "Initial commit"], cwd);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--type",
        "feature",
        "--area",
        "web",
        "--work",
        "Admin catalogue upload",
        "--spec",
        "SPEC-0002",
        "--plan",
        "PLAN-0002"
      ],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Created branch: feature/web/spec-0002-plan-0002-admin-catalogue-upload"
    );
    expect(run("git", ["branch", "--show-current"], cwd)).toBe(
      "feature/web/spec-0002-plan-0002-admin-catalogue-upload"
    );
  });
});
