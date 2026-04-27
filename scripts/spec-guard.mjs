import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const baseRef = process.argv[2] ?? process.env.SPEC_GUARD_BASE_REF;
const errors = [];
const SPEC_LANGUAGE_DIRECTORY = "docs/specs";
const MAX_LANGUAGE_ERRORS_PER_FILE = 8;
const FRENCH_ACCENT_PATTERN = /[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/;
const FRENCH_CONTRACTION_PATTERN =
  /\b(?:[cdjlmnqt]|qu)['’][a-zàâæçéèêëîïôœùûüÿ]/i;
const ACCEPTED_SPEC_PRE_ACCEPTANCE_BLOCKER_PATTERNS = [
  /\bbefore (?:this )?(?:spec|draft|document) can be accepted\b/i,
  /\bbefore acceptance\b/i,
  /\bto resolve before acceptance\b/i,
  /\bmust be (?:resolved|completed|finished|decided|defined) before (?:this )?(?:spec|draft|document)?\s*(?:can be )?accepted\b/i,
];
const FRENCH_MARKER_WORDS = new Set([
  "accueil",
  "achat",
  "acheteur",
  "administrateur",
  "aider",
  "ajout",
  "ajoute",
  "ajouter",
  "alors",
  "approuve",
  "apres",
  "arrive",
  "arriver",
  "aucun",
  "aussi",
  "autre",
  "avant",
  "avec",
  "besoin",
  "bouton",
  "canape",
  "categorie",
  "ce",
  "cela",
  "celle",
  "celui",
  "ces",
  "cet",
  "cette",
  "chez",
  "choisir",
  "choisit",
  "clique",
  "colle",
  "coller",
  "commande",
  "commander",
  "compte",
  "connecte",
  "consiste",
  "consulter",
  "copier",
  "cree",
  "creer",
  "dans",
  "definir",
  "demande",
  "depuis",
  "developpement",
  "doit",
  "doivent",
  "donnee",
  "donnees",
  "elle",
  "elles",
  "encore",
  "ensemble",
  "entre",
  "etre",
  "externe",
  "faire",
  "fiche",
  "fiches",
  "flux",
  "fournisseur",
  "gestion",
  "generer",
  "genere",
  "hors",
  "interieur",
  "lance",
  "lien",
  "liens",
  "modifier",
  "niveau",
  "outil",
  "outils",
  "paiement",
  "panier",
  "perimetre",
  "peut",
  "peuvent",
  "prix",
  "publie",
  "publier",
  "quand",
  "que",
  "qui",
  "rendu",
  "rendus",
  "remplacer",
  "reste",
  "retourner",
  "saisi",
  "saisie",
  "salon",
  "selectionne",
  "simuler",
  "sous",
  "tissu",
  "tissus",
  "tunnel",
  "uploade",
  "utilisateur",
  "utilisation",
  "valide",
  "valider",
  "vend",
  "vente",
  "vers",
  "voir",
]);

function git(args, options = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", options.allowErrorOutput ? "pipe" : "ignore"],
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
    ...lines(git(["ls-files", "--others", "--exclude-standard"])),
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

function listFilesRecursive(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFilesRecursive(path) : [path];
    })
    .sort();
}

function normalizeLanguageToken(token) {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function languageScanLine(line) {
  return line.replace(/https?:\/\/\S+/g, " ").replace(/`[^`]*`/g, " ");
}

function detectNonEnglishSpecLine(line) {
  const scanLine = languageScanLine(line);
  const hasFrenchAccent = FRENCH_ACCENT_PATTERN.test(scanLine);
  const hasFrenchContraction = FRENCH_CONTRACTION_PATTERN.test(scanLine);
  const markerWords = uniq(
    [...scanLine.matchAll(/\p{L}+/gu)]
      .map((match) => normalizeLanguageToken(match[0]))
      .filter((word) => FRENCH_MARKER_WORDS.has(word)),
  );

  if (!hasFrenchAccent && !hasFrenchContraction && markerWords.length < 2) {
    return "";
  }

  const reasons = [];
  if (hasFrenchAccent) {
    reasons.push("French accented text");
  }
  if (hasFrenchContraction) {
    reasons.push("French contraction");
  }
  if (markerWords.length > 0) {
    reasons.push(`French marker words: ${markerWords.slice(0, 4).join(", ")}`);
  }

  return reasons.join("; ");
}

function validateSpecLanguage() {
  const specFiles = listFilesRecursive(SPEC_LANGUAGE_DIRECTORY).filter((path) =>
    /\.(json|md)$/.test(path),
  );

  for (const path of specFiles) {
    const markdown = readMarkdown(path);
    const languageErrors = [];

    markdown.split("\n").forEach((line, index) => {
      const reason = detectNonEnglishSpecLine(line);
      if (reason) {
        languageErrors.push(
          `${path}:${index + 1} appears to contain non-English spec text (${reason})`,
        );
      }
    });

    errors.push(...languageErrors.slice(0, MAX_LANGUAGE_ERRORS_PER_FILE));

    if (languageErrors.length > MAX_LANGUAGE_ERRORS_PER_FILE) {
      errors.push(
        `${path} has ${languageErrors.length - MAX_LANGUAGE_ERRORS_PER_FILE} additional non-English spec language issue(s)`,
      );
    }
  }
}

function extractField(markdown, field) {
  const match = markdown.match(new RegExp(`^${field}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
}

function isTestFile(path) {
  return (
    /(^|\/)(__tests__|tests)\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
  );
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
      errors.push(
        `${manifestPath} contains invalid spec id: ${spec.id ?? "<missing>"}`,
      );
      continue;
    }

    if (byId.has(spec.id)) {
      errors.push(`${manifestPath} contains duplicate spec id: ${spec.id}`);
    }

    if (!spec.path || !existsSync(spec.path)) {
      errors.push(
        `${manifestPath} references missing spec file for ${spec.id}: ${spec.path}`,
      );
    }

    if (
      spec.status === "accepted" &&
      !String(spec.path).startsWith("docs/specs/accepted/")
    ) {
      errors.push(
        `${spec.id} is accepted but is not under docs/specs/accepted`,
      );
    }

    byId.set(spec.id, spec);
  }

  return byId;
}

function validatePlans(knownSpecs) {
  const planFiles = [
    ...listMarkdownFiles("docs/plans/active"),
    ...listMarkdownFiles("docs/plans/done"),
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

function validateAcceptedSpecReadinessLanguage() {
  const acceptedSpecFiles = listMarkdownFiles("docs/specs/accepted").filter(
    (path) => !path.endsWith("/README.md"),
  );

  for (const path of acceptedSpecFiles) {
    const markdown = readMarkdown(path);

    markdown.split("\n").forEach((line, index) => {
      if (
        ACCEPTED_SPEC_PRE_ACCEPTANCE_BLOCKER_PATTERNS.some((pattern) =>
          pattern.test(line),
        )
      ) {
        errors.push(
          `${path}:${index + 1} is accepted but contains pre-acceptance blocker language`,
        );
      }
    });
  }
}

function validateChangedFiles(paths, knownSpecs) {
  if (paths.length === 0) {
    return;
  }

  const sourceChanges = paths.filter((path) => isSourceFile(path));
  const implementationChanges = paths.filter(
    (path) => isSourceFile(path) || isGovernanceImplementationFile(path),
  );
  const testChanges = paths.filter((path) => isTestFile(path));
  const planChanges = paths.filter(
    (path) =>
      (path.startsWith("docs/plans/active/") ||
        path.startsWith("docs/plans/done/")) &&
      path.endsWith(".md") &&
      !path.endsWith("/README.md"),
  );

  if (implementationChanges.length > 0 && planChanges.length === 0) {
    errors.push(
      "Implementation changes require an active or completed plan change under docs/plans",
    );
  }

  if (sourceChanges.length > 0 && testChanges.length === 0) {
    errors.push(
      "Source changes require test changes. If this is truly not needed, explain it in the plan and update the guard intentionally.",
    );
  }

  for (const roadmap of affectedRoadmaps(implementationChanges)) {
    if (!paths.includes(roadmap)) {
      errors.push(
        `Changes affect ${roadmap}, but that roadmap was not updated`,
      );
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
    (path) => path.startsWith("docs/specs/accepted/") && path.endsWith(".md"),
  );
  const changeRequestChanges = paths.filter(
    (path) =>
      path.startsWith("docs/specs/change-requests/") &&
      path.endsWith(".md") &&
      !path.endsWith("/README.md"),
  );

  const comparisonRef = baseRef || (hasHead() ? "HEAD" : "");
  if (comparisonRef) {
    const modifiedAcceptedSpecs = acceptedSpecChanges.filter((path) =>
      existsInRef(comparisonRef, path),
    );

    if (modifiedAcceptedSpecs.length > 0 && changeRequestChanges.length === 0) {
      errors.push(
        `Accepted specs are frozen. Add a change request under docs/specs/change-requests before modifying: ${modifiedAcceptedSpecs.join(", ")}`,
      );
    }
  }
}

const knownSpecs = validateManifest();
validateSpecLanguage();
validateAcceptedSpecReadinessLanguage();
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
