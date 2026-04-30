#!/usr/bin/env node
// SPEC-0007 live-pipeline orchestrator.
//
// Runs the full Stage 1 sequence (validate -> clean -> scene ->
// corners -> lines) against OpenAI in one Node process so a developer
// can review every artifact in a single timestamped folder.
//
// Usage:
//   pnpm sim:live:run -- --photo /path/to/room.jpg [--skip-clean]
//                       [--mode back_wall|corner]
//
// If --mode is omitted, the scene step (GPT-5 vision) decides between
// back_wall and corner. Pass --mode to force a specific mode and skip
// the classifier call.
//
// To also run Stage 2 placement after Stage 1, pass --sofa PATH plus
// dimensions appropriate for the chosen mode:
//   back_wall: --wall-width, --wall-height, --room-depth,
//              --sofa-width, --sofa-height
//   corner:    --wall-left, --wall-right, --wall-height, --room-depth,
//              --sofa-left, --sofa-right, --sofa-height

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  defaultRunDir,
  ensureDir,
  fail,
  info,
  parseArgs
} from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function runStep(scriptName, scriptArgs, options = {}) {
  const script = resolve(here, scriptName);
  info(`---\nrun: ${scriptName} ${scriptArgs.join(" ")}\n---`);
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    stdio: "inherit",
    env: process.env
  });
  if (options.allowStatus && options.allowStatus.includes(result.status)) {
    return result.status;
  }
  if (result.status !== 0) {
    fail(`${scriptName} exited with code ${result.status}`);
  }
  return 0;
}

const args = parseArgs(process.argv.slice(2));
if (!args.photo) fail("missing --photo PATH", 2);
const runDir = args.out ?? defaultRunDir("run");
await ensureDir(runDir);
info(`live pipeline run: ${runDir}`);

runStep("validate.mjs", ["--photo", args.photo, "--out", runDir]);

if (args["skip-clean"]) {
  info("clean: skipped");
} else {
  runStep("clean.mjs", ["--photo", args.photo, "--out", runDir]);
}

const cleanedPath = args["skip-clean"]
  ? args.photo
  : resolve(runDir, "room_cleaned.png");

let mode = args.mode;
if (!mode) {
  const status = runStep(
    "scene.mjs",
    ["--photo", cleanedPath, "--out", runDir],
    { allowStatus: [3] }
  );
  const sceneRaw = await readFile(resolve(runDir, "scene.json"), "utf8");
  const scene = JSON.parse(sceneRaw);
  if (status === 3 || scene.mode === "reshoot") {
    info(
      `---\npipeline stopped: scene asked for reshoot — reason: ${scene.reason ?? "(none)"}`
    );
    info(`artifacts so far: ${runDir}`);
    process.exit(3);
  }
  mode = scene.mode;
  info(`scene: classified as ${mode} (confidence=${scene.confidence})`);
}

if (mode !== "back_wall" && mode !== "corner") {
  fail(`unknown mode "${mode}". Pass --mode back_wall or --mode corner.`);
}

runStep("corners.mjs", [
  "--photo", cleanedPath,
  "--mode", mode,
  "--out", runDir
]);
runStep("lines.mjs", [
  "--photo", resolve(runDir, "room_corners.png"),
  "--out", runDir
]);

if (args.sofa) {
  const placeArgs = [
    "--room", cleanedPath,
    "--sofa", args.sofa,
    "--out", runDir
  ];
  if (mode === "corner") {
    placeArgs.push("--mode", "corner");
    for (const flag of [
      "wall-left", "wall-right", "wall-height", "room-depth",
      "sofa-left", "sofa-right", "sofa-height"
    ]) {
      if (args[flag]) {
        placeArgs.push(`--${flag}`, args[flag]);
      }
    }
  } else {
    for (const flag of [
      "wall-width", "wall-height", "room-depth",
      "sofa-width", "sofa-height", "position"
    ]) {
      if (args[flag]) {
        placeArgs.push(`--${flag}`, args[flag]);
      }
    }
  }
  runStep("place.mjs", placeArgs);
}

info(`---\nrun complete. Artifacts in: ${runDir}`);
