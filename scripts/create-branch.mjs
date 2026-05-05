import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const BRANCH_TYPES = ["chore", "docs", "feature", "fix", "hotfix", "refactor", "spec", "test"];
export const OWNER_AREAS = ["api", "image-worker", "repo", "shared", "supabase", "web", "workflow"];
const MAX_BRANCH_LENGTH = 120;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildBranchName(input) {
  const type = slugify(input.type);
  const area = slugify(input.area);
  const spec = normalizeId(input.spec);
  const plan = normalizeId(input.plan);
  const work = slugify(input.work);
  const metadata = [spec?.toLowerCase(), plan?.toLowerCase(), work].filter(Boolean).join("-");

  return `${type}/${area}/${metadata}`;
}

export function validateBranchRequest(input) {
  const type = slugify(input.type);
  const area = slugify(input.area);
  const spec = normalizeId(input.spec);
  const plan = normalizeId(input.plan);
  const work = normalizeText(input.work);
  const errors = [];

  if (!BRANCH_TYPES.includes(type)) {
    errors.push(`type must be one of: ${BRANCH_TYPES.join(", ")}`);
  }

  if (!OWNER_AREAS.includes(area)) {
    errors.push(`area must be one of: ${OWNER_AREAS.join(", ")}`);
  }

  if (!work) {
    errors.push("work is required");
  } else if (!slugify(work)) {
    errors.push("work must include at least one letter or number");
  }

  if (spec && !/^SPEC-\d{4}$/.test(spec)) {
    errors.push("spec must match SPEC-0000 format");
  }

  if (plan && !/^PLAN-\d{4}$/.test(plan)) {
    errors.push("plan must match PLAN-0000 format");
  }

  if (errors.length === 0 && buildBranchName(input).length > MAX_BRANCH_LENGTH) {
    errors.push(`branch name must be ${MAX_BRANCH_LENGTH} characters or less`);
  }

  return errors;
}

export function parseBranchArgs(argv) {
  const options = {
    allowDirty: false,
    base: "dev",
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    const [flag, inlineValue] = arg.startsWith("--") ? arg.split("=", 2) : [arg, undefined];

    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }

    if (flag === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (flag === "--allow-dirty") {
      options.allowDirty = true;
      continue;
    }

    if (!flag.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) {
      index += 1;
    }

    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }

    switch (flag) {
      case "--type":
        options.type = value;
        break;
      case "--area":
        options.area = value;
        break;
      case "--work":
        options.work = value;
        break;
      case "--spec":
        options.spec = value;
        break;
      case "--plan":
        options.plan = value;
        break;
      case "--base":
        options.base = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  return options;
}

function usage() {
  return `Create a workflow-compliant Git branch.

Usage:
  pnpm branch:create -- --type feature --area web --work "Admin catalogue upload" --spec SPEC-0002 --plan PLAN-0002

Required:
  --type   ${BRANCH_TYPES.join(" | ")}
  --area   ${OWNER_AREAS.join(" | ")}
  --work   short description of the intended work

Optional:
  --spec SPEC-0000
  --plan PLAN-0000
  --base dev          base branch, defaults to dev
  --dry-run           validate and print the branch name without creating it
  --allow-dirty       allow branch creation with uncommitted changes
`;
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `git ${args.join(" ")} failed`;
    throw new Error(message);
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function hasDirtyWorktree() {
  return git(["status", "--porcelain"]).length > 0;
}

function refExists(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return result.status === 0;
}

function createGitBranch(options) {
  const branchName = buildBranchName(options);

  if (!options.allowDirty && hasDirtyWorktree()) {
    throw new Error("working tree has uncommitted changes. Commit, stash, or rerun with --allow-dirty.");
  }

  if (!refExists(options.base)) {
    throw new Error(`base branch or ref does not exist: ${options.base}`);
  }

  if (refExists(`refs/heads/${branchName}`) || refExists(`refs/remotes/origin/${branchName}`)) {
    throw new Error(`branch already exists: ${branchName}`);
  }

  git(["switch", options.base], { stdio: "inherit" });
  git(["switch", "-c", branchName], { stdio: "inherit" });

  return branchName;
}

function main() {
  try {
    const options = parseBranchArgs(process.argv.slice(2));

    if (options.help) {
      console.log(usage());
      return;
    }

    const errors = validateBranchRequest(options);
    if (errors.length > 0) {
      console.error("Branch request is invalid:");
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }

    const branchName = buildBranchName(options);

    if (options.dryRun) {
      console.log(`Branch name: ${branchName}`);
      console.log(`Base branch: ${options.base}`);
      console.log("Dry run: no branch created");
      return;
    }

    createGitBranch(options);
    console.log(`Created branch: ${branchName}`);
    console.log(`Base branch: ${options.base}`);
    console.log("Next: create or update the matching spec, plan, tests, and roadmap before opening a PR.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
