#!/usr/bin/env node
// SPEC-0007 Stage 2 vision-based measurement of generated sofa output.
//
// Used by the self-correcting feedback loop in `place-feedback.mjs`. Takes the
// PNG produced by `place.mjs` and asks GPT-5 vision to estimate three numbers:
//   - sofa_width_pct  (sofa visible width / back-wall visible width × 100)
//   - sofa_height_pct (sofa visible height / room visible height × 100)
//   - position        (left | center | right — which third of the back wall
//                      the sofa center sits in)
//
// The script writes measurement.json into the run dir and prints the same JSON
// to stdout so the orchestrator can capture it.
//
// Usage:
//   pnpm sim:live:measure -- --photo /path/to/output.png [--out tmp/sim-live/...]

import {
  bytesToBase64,
  callOpenAIChat,
  compressToMaxEdge,
  defaultRunDir,
  fail,
  info,
  maxEdgeFromEnv,
  parseArgs,
  readPhoto,
  requireEnv,
  writeArtifact
} from "./lib.mjs";

const SYSTEM_PROMPT =
  "You are measuring a sofa placement against the back wall of a residential room. Reply with strict JSON of shape {\"sofa_width_pct\": number, \"sofa_height_pct\": number, \"position\": \"left\"|\"center\"|\"right\"}.";

const USER_PROMPT = [
  "You are looking at a photograph of a residential room with a sofa placed against the back wall.",
  "",
  "TASK: estimate three measurements as numeric percentages (0-100).",
  "",
  "1. sofa_width_pct — how much of the back wall the sofa occupies horizontally.",
  "   - Identify the leftmost X-pixel of the back wall (where it meets the LEFT side wall).",
  "   - Identify the rightmost X-pixel of the back wall (where it meets the RIGHT side wall).",
  "   - Identify the leftmost X-pixel of the visible sofa silhouette (left arm, cushion, or anything that belongs to the sofa).",
  "   - Identify the rightmost X-pixel of the visible sofa silhouette.",
  "   - Compute (sofa_pixel_width / back_wall_pixel_width) × 100.",
  "",
  "2. sofa_height_pct — how much of the room height the sofa occupies vertically.",
  "   - Identify the floor-line Y-pixel near the back wall.",
  "   - Identify the ceiling-line Y-pixel of the back wall.",
  "   - Identify the bottom-of-sofa Y-pixel (legs touching the floor).",
  "   - Identify the top-of-sofa Y-pixel (top of the backrest or pillows).",
  "   - Compute (sofa_pixel_height / room_pixel_height) × 100.",
  "",
  "3. position — where the sofa center sits horizontally on the back wall.",
  "   - Compute the sofa horizontal center pixel (midpoint of leftmost and rightmost sofa pixels).",
  "   - Divide the back wall into three equal horizontal thirds (left third / middle third / right third).",
  "   - If the sofa center is in the LEFT third → \"left\". MIDDLE third → \"center\". RIGHT third → \"right\".",
  "",
  "RULES:",
  "- Be precise. Do not round to nearest 10. Use the actual pixel ratios.",
  "- The sofa includes its arms, backrest, cushions, pillows, legs, and any visible part of its silhouette.",
  "- Doors, windows, AC units, sockets are part of the back wall, not part of the sofa — exclude them from the sofa measurement.",
  "- If a part of the sofa is occluded by another piece of furniture, estimate the silhouette as if the sofa were fully visible.",
  "",
  "Return STRICT JSON only. No prose, no markdown, no extra keys."
].join("\n");

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-5";
const runDir = args.out ?? defaultRunDir("measure");
const maxEdge = args["max-edge"]
  ? Number.parseInt(args["max-edge"], 10)
  : maxEdgeFromEnv(720);

const compressed = await compressToMaxEdge(photo.bytes, maxEdge);
if (compressed.resized) {
  info(
    `measure: compressed ${photo.bytes.length}B -> ${compressed.bytes.length}B (${compressed.width}x${compressed.height}, max-edge=${maxEdge})`
  );
}

info(`measure: model=${model} photo=${photo.absolute}`);

const body = {
  model,
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: USER_PROMPT },
        {
          type: "image_url",
          image_url: {
            url: `data:${compressed.mimeType};base64,${bytesToBase64(compressed.bytes)}`
          }
        }
      ]
    }
  ],
  response_format: { type: "json_object" }
};

let raw;
try {
  raw = await callOpenAIChat({ apiKey, body });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const content = raw.choices?.[0]?.message?.content ?? "";
let parsed;
try {
  parsed = JSON.parse(content);
} catch {
  fail(`measure response was not JSON: ${content.slice(0, 200)}`);
}

const widthOk = typeof parsed.sofa_width_pct === "number" &&
  parsed.sofa_width_pct >= 0 && parsed.sofa_width_pct <= 100;
const heightOk = typeof parsed.sofa_height_pct === "number" &&
  parsed.sofa_height_pct >= 0 && parsed.sofa_height_pct <= 100;
const positionOk = parsed.position === "left" ||
  parsed.position === "center" || parsed.position === "right";

if (!widthOk || !heightOk || !positionOk) {
  fail(`measure returned malformed JSON: ${JSON.stringify(parsed)}`);
}

const path = await writeArtifact(
  runDir,
  "measurement.json",
  JSON.stringify(parsed, null, 2)
);
info(`measure: saved ${path}`);
console.log(JSON.stringify(parsed));
