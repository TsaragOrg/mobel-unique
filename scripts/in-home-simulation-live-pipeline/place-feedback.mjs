#!/usr/bin/env node
// SPEC-0007 Stage 2 self-correcting feedback loop.
//
// Wraps `place.mjs` in a generate → measure → compare → corrective-retry loop
// so the rendered sofa actually lands close to the customer's measured size,
// not the LLM's "average sofa" prior.
//
// Pipeline per attempt:
//   1. Run place.mjs (with optional IN_HOME_SIMULATION_FEEDBACK env from the
//      previous attempt's miss) → output.png in attempt-N/.
//   2. Run measure.mjs on output.png → measurement.json.
//   3. Compare measured (sofa_width_pct, sofa_height_pct, position) to target.
//      - If width and height are within tolerance and position matches, accept.
//      - Else: build a corrective feedback string and retry.
//   4. Stop after MAX_ATTEMPTS. Copy the closest attempt to <runDir>/output.png.
//
// Usage:
//   pnpm sim:live:place-feedback -- \
//     --room       /path/to/room_cleaned.png \
//     --sofa       /path/to/sofa.png \
//     --wall-width 4.2 --wall-height 2.9 --room-depth 3.5 \
//     --sofa-width 3.3 --sofa-height 1.4 \
//     [--position center|left|right] [--unit m] [--out tmp/sim-live/...]

import { spawnSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRunDir, ensureDir, fail, info, parseArgs } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const MAX_ATTEMPTS = 3;
const TOLERANCE_PCT = 5;

function runChild(scriptName, scriptArgs, env = {}) {
  const script = resolve(here, scriptName);
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    fail(`${scriptName} exited with code ${result.status}`);
  }
}

function runChildCaptureStdout(scriptName, scriptArgs, env = {}) {
  const script = resolve(here, scriptName);
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    stdio: ["inherit", "pipe", "inherit"],
    env: { ...process.env, ...env },
    encoding: "utf-8"
  });
  if (result.status !== 0) {
    fail(`${scriptName} exited with code ${result.status}`);
  }
  return result.stdout ?? "";
}

const args = parseArgs(process.argv.slice(2));
if (!args.room) fail("missing --room PATH", 2);
if (!args.sofa) fail("missing --sofa PATH", 2);

const ww = parseFloat(args["wall-width"]);
const wh = parseFloat(args["wall-height"]);
const sw = parseFloat(args["sofa-width"]);
const sh = parseFloat(args["sofa-height"]);
if (!Number.isFinite(ww) || !Number.isFinite(wh) || !Number.isFinite(sw) || !Number.isFinite(sh)) {
  fail(
    "place-feedback: --wall-width, --wall-height, --sofa-width, --sofa-height are all required",
    2
  );
}
const targetWidthPct = (sw / ww) * 100;
const targetHeightPct = (sh / wh) * 100;
const positionRaw = (args.position ?? "center").toLowerCase();
const targetPosition = positionRaw === "left" || positionRaw === "right"
  ? positionRaw
  : "center";

const runDir = args.out ?? defaultRunDir("place-feedback");
await ensureDir(runDir);

info(`place-feedback: target sofa = ${sw}m × ${sh}m`);
info(
  `place-feedback: target ratios = ${targetWidthPct.toFixed(1)}% width × ${targetHeightPct.toFixed(1)}% height, position=${targetPosition}`
);
info(`place-feedback: tolerance ±${TOLERANCE_PCT}%, max ${MAX_ATTEMPTS} attempts`);

const passthroughKeys = ["unit", "room-depth", "wall-depth", "guide", "model", "size"];

function buildPlaceArgs(attemptDir) {
  const out = [
    "--room", args.room,
    "--sofa", args.sofa,
    "--wall-width", String(ww),
    "--wall-height", String(wh),
    "--sofa-width", String(sw),
    "--sofa-height", String(sh),
    "--position", targetPosition,
    "--out", attemptDir
  ];
  for (const key of passthroughKeys) {
    if (args[key] !== undefined && args[key] !== true) {
      out.push(`--${key}`, String(args[key]));
    }
  }
  return out;
}

function parseMeasurement(stdoutText) {
  const trimmed = stdoutText.trim();
  if (trimmed.length === 0) {
    fail("measure stdout was empty");
  }
  const lastLine = trimmed.split("\n").map((l) => l.trim()).filter(Boolean).pop();
  try {
    return JSON.parse(lastLine);
  } catch (error) {
    fail(`measure stdout last line was not JSON: ${lastLine}`);
  }
}

function buildFeedback(measurement) {
  const widthDelta = measurement.sofa_width_pct - targetWidthPct;
  const heightDelta = measurement.sofa_height_pct - targetHeightPct;
  const positionMatch = measurement.position === targetPosition;

  const lines = [
    "PREVIOUS ATTEMPT FEEDBACK — apply these corrections BEFORE you generate again. This is not optional context, it is a measured failure of your previous output.",
    `- Target sofa width: ${targetWidthPct.toFixed(1)}% of the back wall (= ${sw} m).`,
    `- Target sofa height: ${targetHeightPct.toFixed(1)}% of the room height (= ${sh} m).`,
    `- Target position: ${targetPosition}.`,
    `- You produced: ${measurement.sofa_width_pct.toFixed(1)}% width × ${measurement.sofa_height_pct.toFixed(1)}% height @ ${measurement.position}.`
  ];

  if (widthDelta < -TOLERANCE_PCT) {
    lines.push(
      `- WIDTH FIX: your sofa was ${Math.abs(widthDelta).toFixed(1)} percentage points TOO NARROW. ENLARGE the sofa width. The full ${sw} m must span ${targetWidthPct.toFixed(1)}% of the back wall, not ${measurement.sofa_width_pct.toFixed(1)}%.`
    );
  } else if (widthDelta > TOLERANCE_PCT) {
    lines.push(
      `- WIDTH FIX: your sofa was ${widthDelta.toFixed(1)} percentage points TOO WIDE. SHRINK the sofa width.`
    );
  }

  if (heightDelta < -TOLERANCE_PCT) {
    lines.push(
      `- HEIGHT FIX: your sofa was ${Math.abs(heightDelta).toFixed(1)} percentage points TOO SHORT. INCREASE the sofa height. The backrest must reach ${targetHeightPct.toFixed(1)}% of the ceiling height, not ${measurement.sofa_height_pct.toFixed(1)}%.`
    );
  } else if (heightDelta > TOLERANCE_PCT) {
    lines.push(
      `- HEIGHT FIX: your sofa was ${heightDelta.toFixed(1)} percentage points TOO TALL. LOWER the backrest.`
    );
  }

  if (!positionMatch) {
    lines.push(
      `- POSITION FIX: your sofa was placed in the ${measurement.position} third of the back wall, but the target is the ${targetPosition} third. Move the sofa to the ${targetPosition}.`
    );
  }

  lines.push(
    "- ANTI-REGRESSION REMINDER: the customer physically measured this sofa. ${sw} m × ${sh} m is the literal truth. Do NOT shrink toward 'what an average sofa looks like'. Do NOT shorten the backrest because it 'looks too tall'. Do NOT shift the sofa to avoid a door, window, AC, or any architectural feature."
      .replaceAll("${sw}", String(sw))
      .replaceAll("${sh}", String(sh))
  );

  return lines.join("\n");
}

const attempts = [];
let acceptedAttempt = null;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  info(`---\nplace-feedback: attempt ${attempt}/${MAX_ATTEMPTS}`);
  const attemptDir = resolve(runDir, `attempt-${attempt}`);
  await ensureDir(attemptDir);

  const env = attempts.length > 0 && attempts[attempts.length - 1].feedback
    ? { IN_HOME_SIMULATION_FEEDBACK: attempts[attempts.length - 1].feedback }
    : {};

  runChild("place.mjs", buildPlaceArgs(attemptDir), env);

  const outputPath = resolve(attemptDir, "output.png");

  const measureOut = runChildCaptureStdout("measure.mjs", [
    "--photo", outputPath,
    "--out", attemptDir
  ]);
  const measurement = parseMeasurement(measureOut);

  const widthDelta = measurement.sofa_width_pct - targetWidthPct;
  const heightDelta = measurement.sofa_height_pct - targetHeightPct;
  const positionMatch = measurement.position === targetPosition;
  const totalDelta =
    Math.abs(widthDelta) + Math.abs(heightDelta) + (positionMatch ? 0 : 30);

  info(
    `place-feedback: attempt ${attempt} measured = ${measurement.sofa_width_pct.toFixed(1)}% × ${measurement.sofa_height_pct.toFixed(1)}% @ ${measurement.position}`
  );
  info(
    `place-feedback: deltas = width ${widthDelta.toFixed(1)}%, height ${heightDelta.toFixed(1)}%, position ${positionMatch ? "OK" : "MISMATCH"}, totalDelta=${totalDelta.toFixed(1)}`
  );

  const accepted =
    Math.abs(widthDelta) <= TOLERANCE_PCT &&
    Math.abs(heightDelta) <= TOLERANCE_PCT &&
    positionMatch;

  attempts.push({
    attempt,
    outputPath,
    measurement,
    totalDelta,
    accepted,
    feedback: accepted ? null : buildFeedback(measurement)
  });

  if (accepted) {
    info(`place-feedback: attempt ${attempt} accepted`);
    acceptedAttempt = attempt;
    break;
  }

  if (attempt === MAX_ATTEMPTS) {
    info(
      `place-feedback: all ${MAX_ATTEMPTS} attempts off-target — returning closest`
    );
    break;
  }
}

const ranked = [...attempts].sort((a, b) => a.totalDelta - b.totalDelta);
const best = acceptedAttempt
  ? attempts.find((a) => a.attempt === acceptedAttempt)
  : ranked[0];

const finalPath = resolve(runDir, "output.png");
await copyFile(best.outputPath, finalPath);
info(
  `---\nplace-feedback: best attempt = ${best.attempt} (delta=${best.totalDelta.toFixed(1)}), copied to ${finalPath}`
);
console.log(finalPath);
