import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const baseRef = process.argv[2] ?? process.env.SPEC_GUARD_BASE_REF;
const errors = [];

function git(args, options = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", options.allowErrorOutput ? "pipe" : "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasHead() {
  return Boolean(git(["rev-parse", "--verify", "HEAD"]));
}

function changedFiles() {
  if (baseRef) {
    const threeDot = git(["diff", "--name-only", `${baseRef}...HEAD`]);
    if (threeDot) {
      return uniq(lines(threeDot));
    }

    return uniq(lines(git(["diff", "--name-only", baseRef, "HEAD"])));
  }

  return uniq([
    ...lines(git(["diff", "--name-only", "--cached"])),
    ...lines(git(["diff", "--name-only"])),
    ...lines(git(["ls-files", "--others", "--exclude-standard"]))
  ]);
}

function existsInRef(ref, path) {
  return Boolean(git(["cat-file", "-e", `${ref}:${path}`]));
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path} is not valid JSON: ${error.message}`);
    return null;
  }
}

function readMarkdown(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    errors.push(`${path} cannot be read`);
    return "";
  }
}

function listMarkdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(directory, name));
}

function extractField(markdown, field) {
  const match = markdown.match(new RegExp(`^${field}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
}

function isTestFile(path) {
  return /(^|\/)(__tests__|tests)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

function isSourceFile(path) {
  if (isTestFile(path)) {
    return false;
  }

  if (!/\.(cjs|cts|js|jsx|mjs|mts|sql|ts|tsx)$/.test(path)) {
    return false;
  }

  return (
    path.startsWith("apps/") ||
    path.startsWith("workers/") ||
    path.startsWith("packages/") ||
    path.startsWith("supabase/migrations/")
  );
}

function isGovernanceImplementationFile(path) {
  return (
    path === "package.json" ||
    path === "pnpm-workspace.yaml" ||
    path === "tsconfig.base.json" ||
    path.startsWith("scripts/") ||
    path.startsWith(".github/")
  );
}

function affectedRoadmaps(paths) {
  const roadmaps = new Set();

  for (const path of paths) {
    if (path.startsWith("apps/web/")) {
      roadmaps.add("docs/roadmap/web.md");
    } else if (path.startsWith("apps/api/")) {
      roadmaps.add("docs/roadmap/api.md");
    } else if (path.startsWith("workers/image/")) {
      roadmaps.add("docs/roadmap/image-worker.md");
    } else if (path.startsWith("packages/shared/")) {
      roadmaps.add("docs/roadmap/shared.md");
    } else if (path.startsWith("supabase/")) {
      roadmaps.add("docs/roadmap/supabase.md");
    } else if (isGovernanceImplementationFile(path)) {
      roadmaps.add("docs/roadmap/workflow.md");
    }
  }

  return [...roadmaps].sort();
}

function validateManifest() {
  const manifestPath = "docs/specs/manifest.json";
  const manifest = readJson(manifestPath);
  if (!manifest) {
    return new Map();
  }

  const specs = Array.isArray(manifest.specs) ? manifest.specs : [];
  const byId = new Map();

  for (const spec of specs) {
    if (!/^SPEC-\d{4}$/.test(spec.id ?? "")) {
      errors.push(`${manifestPath} contains invalid spec id: ${spec.id ?? "<missing>"}`);
      continue;
    }

    if (byId.has(spec.id)) {
      errors.push(`${manifestPath} contains duplicate spec id: ${spec.id}`);
    }

    if (!spec.path || !existsSync(spec.path)) {
      errors.push(`${manifestPath} references missing spec file for ${spec.id}: ${spec.path}`);
    }

    if (spec.status === "accepted" && !String(spec.path).startsWith("docs/specs/accepted/")) {
      errors.push(`${spec.id} is accepted but is not under docs/specs/accepted`);
    }

    byId.set(spec.id, spec);
  }

  return byId;
}

function validatePlans(knownSpecs) {
  const planFiles = [
    ...listMarkdownFiles("docs/plans/active"),
    ...listMarkdownFiles("docs/plans/done")
  ].filter((path) => !path.endsWith("/README.md"));

  for (const path of planFiles) {
    const markdown = readMarkdown(path);
    const plan = extractField(markdown, "Plan");
    const spec = extractField(markdown, "Spec");
    const status = extractField(markdown, "Status");

    if (!/^PLAN-\d{4}$/.test(plan ?? "")) {
      errors.push(`${path} is missing a valid Plan field`);
    }

    if (!knownSpecs.has(spec ?? "")) {
      errors.push(`${path} references unknown spec: ${spec ?? "<missing>"}`);
    }

    if (path.startsWith("docs/plans/active/") && status !== "active") {
      errors.push(`${path} must have Status: active`);
    }

    if (path.startsWith("docs/plans/done/") && status !== "done") {
      errors.push(`${path} must have Status: done`);
    }
  }
}

function validateRoadmaps(knownSpecs) {
  for (const path of listMarkdownFiles("docs/roadmap")) {
    const markdown = readMarkdown(path);
    const referencedSpecs = markdown.match(/SPEC-\d{4}/g) ?? [];

    for (const spec of referencedSpecs) {
      if (!knownSpecs.has(spec)) {
        errors.push(`${path} references unknown spec: ${spec}`);
      }
    }
  }
}

function validateChangedFiles(paths, knownSpecs) {
  if (paths.length === 0) {
    return;
  }

  const sourceChanges = paths.filter((path) => isSourceFile(path));
  const implementationChanges = paths.filter(
    (path) => isSourceFile(path) || isGovernanceImplementationFile(path)
  );
  const testChanges = paths.filter((path) => isTestFile(path));
  const planChanges = paths.filter(
    (path) =>
      (path.startsWith("docs/plans/active/") || path.startsWith("docs/plans/done/")) &&
      path.endsWith(".md") &&
      !path.endsWith("/README.md")
  );

  if (implementationChanges.length > 0 && planChanges.length === 0) {
    errors.push("Implementation changes require an active or completed plan change under docs/plans");
  }

  if (sourceChanges.length > 0 && testChanges.length === 0) {
    errors.push("Source changes require test changes. If this is truly not needed, explain it in the plan and update the guard intentionally.");
  }

  for (const roadmap of affectedRoadmaps(implementationChanges)) {
    if (!paths.includes(roadmap)) {
      errors.push(`Changes affect ${roadmap}, but that roadmap was not updated`);
    }
  }

  for (const planPath of planChanges) {
    const markdown = readMarkdown(planPath);
    const spec = extractField(markdown, "Spec");
    if (!knownSpecs.has(spec ?? "")) {
      errors.push(`${planPath} must reference a registered spec id`);
    }
  }

  const acceptedSpecChanges = paths.filter(
    (path) => path.startsWith("docs/specs/accepted/") && path.endsWith(".md")
  );
  const changeRequestChanges = paths.filter(
    (path) =>
      path.startsWith("docs/specs/change-requests/") &&
      path.endsWith(".md") &&
      !path.endsWith("/README.md")
  );

  const comparisonRef = baseRef || (hasHead() ? "HEAD" : "");
  if (comparisonRef) {
    const modifiedAcceptedSpecs = acceptedSpecChanges.filter((path) =>
      existsInRef(comparisonRef, path)
    );

    if (modifiedAcceptedSpecs.length > 0 && changeRequestChanges.length === 0) {
      errors.push(
        `Accepted specs are frozen. Add a change request under docs/specs/change-requests before modifying: ${modifiedAcceptedSpecs.join(", ")}`
      );
    }
  }
}

const knownSpecs = validateManifest();
validatePlans(knownSpecs);
validateRoadmaps(knownSpecs);
validateChangedFiles(changedFiles(), knownSpecs);

if (errors.length > 0) {
  console.error("Specification guard failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Specification guard passed");

