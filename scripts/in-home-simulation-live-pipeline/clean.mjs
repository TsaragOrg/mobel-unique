#!/usr/bin/env node
// SPEC-0007 PLAN-0010 Stage 1 cleaning step — live OpenAI image-edit.
//
// Usage:
//   pnpm sim:live:clean -- --photo /path/to/room.jpg [--out tmp/sim-live/...] [--model gpt-image-2]
//
// Output: writes cleaned room PNG to <run-dir>/room_cleaned.png and
// prints the absolute path. Open in Finder to compare to the input.

import {
  base64ToBytes,
  callOpenAIImagesEdit,
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

const PROMPT =
  "You are editing a residential room photograph with two strict rules. Rule 1 — REMOVE all movable items from the photo: sofas, chairs, tables, ottomans, shelving, lamps, beds, mattresses, rugs, plants, screens, decorations, and any other moveable items. Rule 2 — DO NOT ADD anything that is not already visible in the input. This is critical: if the input has no radiator, the output must have no radiator; if the input has no door on a wall, do not add a door; if the input has no window on a wall, do not add a window; do not invent furniture, fixtures, decoration, text, or any architectural element. Keep everything that already exists in the photo exactly as-is: the same walls, floor, ceiling, openings, fixtures, lighting, color cast, perspective, and focal length. Return only the edited photograph, with no captions, watermarks, or annotations.";

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-image-2";
const size = args.size ?? "auto";
const runDir = args.out ?? defaultRunDir("clean");
const maxEdge = args["max-edge"]
  ? Number.parseInt(args["max-edge"], 10)
  : maxEdgeFromEnv(720);

const compressed = await compressToMaxEdge(photo.bytes, maxEdge);
if (compressed.resized) {
  info(
    `clean: compressed ${photo.bytes.length}B -> ${compressed.bytes.length}B (${compressed.width}x${compressed.height}, max-edge=${maxEdge})`
  );
}

info(`clean: model=${model} size=${size} photo=${photo.absolute}`);

const formData = new FormData();
formData.set("model", model);
formData.set("prompt", PROMPT);
formData.set("size", size);
formData.set(
  "image",
  new Blob([compressed.bytes], { type: compressed.mimeType }),
  photo.name
);

let response;
try {
  response = await callOpenAIImagesEdit({ apiKey, formData });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const b64 = response?.data?.[0]?.b64_json;
if (!b64 || b64.length === 0) {
  fail(
    `cleaning response had no image data: ${JSON.stringify(response).slice(0, 200)}`
  );
}

const cleanedBytes = base64ToBytes(b64);
const cleanedPath = await writeArtifact(runDir, "room_cleaned.png", Buffer.from(cleanedBytes));
info(`clean: saved ${cleanedPath} (${cleanedBytes.length} bytes)`);
console.log(cleanedPath);
