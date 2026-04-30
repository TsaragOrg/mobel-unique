#!/usr/bin/env node
// SPEC-0007 Stage 1 scene classifier — GPT-5 vision JSON.
//
// Decides whether the cleaned (or raw) room photo is a flat back-wall view
// (CASE A) or an inner-corner view (CASE B). The decision is needed before
// the corners step so that the gpt-image-2 prompt can ask for EXACTLY 4 or
// EXACTLY 6 dots. gpt-image-2 alone is not reliable at this classification
// (it leans toward 6 dots even when the room is a flat back wall), so the
// pipeline uses a dedicated GPT-5 vision JSON call here.
//
// Usage:
//   pnpm sim:live:scene -- --photo /path/to/room_cleaned.png [--out tmp/sim-live/...]
//
// Output: prints {mode, confidence, reason} JSON to stdout and writes
// scene.json into the run dir for later inspection.

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
  "You are classifying a residential room photograph for a furniture placement service. Reply with strict JSON of shape {\"mode\": \"back_wall\"|\"corner\"|\"reshoot\", \"confidence\": number, \"reason\": string}.";

const USER_PROMPT = [
  "Decide ONE of three cases for this room photograph. The decision is based on the CENTRAL 30% of the image width — the vertical strip from 35% to 65% of the frame width. Mentally draw two vertical lines at X=35% and X=65% and only look at what is between them.",
  "",
  "CASE B — corner: anywhere INSIDE the central 30% strip there is a vertical architectural seam where TWO walls meet at an inner corner — a vertical line that runs from floor to ceiling where the room's two walls join. The seam does NOT have to be at the exact center; if it is anywhere between X=35% and X=65%, choose corner. The two walls do NOT need to be equally wide on screen — one can dominate the frame and the other can be smaller. If you can see such a seam in the central 30% strip, choose corner.",
  "",
  "CASE A — back_wall: the central 30% strip is fully a flat wall surface, with NO vertical wall-meeting seam inside it. The photographer aimed straight at one main wall, and that wall fills the central strip. A side-wall sliver visible only OUTSIDE the central strip (to the left of X=35% or to the right of X=65%) does NOT make it a corner case — those edge corners are normal for a frontal photo. As long as the central 30% strip is flat wall with no inner corner seam in it, choose back_wall.",
  "",
  "CASE C — reshoot: the photo cannot be used for furniture placement. Examples: too dark to see walls, camera heavily tilted, walls blocked by objects so you cannot see where they end, the back wall is cut off by the frame so its corners are not visible, you cannot distinguish floor from wall, the photographer aimed at the floor or ceiling instead of a wall. Anything where you cannot confidently choose A or B → choose reshoot.",
  "",
  "DECISION ORDER — apply in this exact order:",
  "1. Is there a vertical wall-meeting seam anywhere inside the central 30% strip (X between 35% and 65%)? → corner.",
  "2. Is the central 30% strip a flat wall surface with no inner seam in it? → back_wall.",
  "3. Cannot tell, blocked, or photo unusable → reshoot.",
  "",
  "Tie-breakers:",
  "- A side-wall sliver visible only at the LEFT or RIGHT edge of the frame (outside the central 30% strip) is NOT a corner case.",
  "- If a seam is exactly on the edge of the central strip (around X=35% or X=65%) and you are unsure, prefer corner.",
  "- If you still cannot decide → reshoot.",
  "",
  "Return strict JSON with mode (back_wall|corner|reshoot), confidence (0-1), and a short reason that names whether a seam is visible inside the central 30% strip and approximately at what X position."
].join("\n");

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-5";
const runDir = args.out ?? defaultRunDir("scene");
const maxEdge = args["max-edge"]
  ? Number.parseInt(args["max-edge"], 10)
  : maxEdgeFromEnv(720);

const compressed = await compressToMaxEdge(photo.bytes, maxEdge);
if (compressed.resized) {
  info(
    `scene: compressed ${photo.bytes.length}B -> ${compressed.bytes.length}B (${compressed.width}x${compressed.height}, max-edge=${maxEdge})`
  );
}

info(`scene: model=${model} photo=${photo.absolute}`);

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
  fail(`scene response was not JSON: ${content.slice(0, 200)}`);
}

if (
  parsed.mode !== "back_wall" &&
  parsed.mode !== "corner" &&
  parsed.mode !== "reshoot"
) {
  fail(`scene returned invalid mode: ${parsed.mode}`);
}

const path = await writeArtifact(
  runDir,
  "scene.json",
  JSON.stringify(parsed, null, 2)
);
info(`scene: saved ${path}`);
console.log(JSON.stringify(parsed, null, 2));

if (parsed.mode === "reshoot") {
  info(
    `scene: classifier asked the customer to reshoot — reason: ${parsed.reason ?? "(none)"}`
  );
  // Exit code 3 = reshoot. run.mjs detects this and stops the pipeline
  // without invoking corners/lines/place. Production worker mirrors this
  // by failing the job non-retryable with a "reshoot_required" code.
  process.exit(3);
}
