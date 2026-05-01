#!/usr/bin/env node
// SPEC-0007 PLAN-0010 Stage 1 validation step — live OpenAI vision.
//
// Usage:
//   pnpm sim:live:validate -- --photo /path/to/room.jpg [--out tmp/sim-live/...]
//
// Output: prints {ok, confidence, failure_reason} JSON to stdout and
// writes a copy to <run-dir>/validation.json for later inspection.

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
  "You are validating a customer-uploaded room photograph for an indoor furniture visualization service. Reply with strict JSON of shape {\"ok\": boolean, \"confidence\": number, \"failure_reason\": string}.";

const USER_PROMPT =
  "Validate the attached residential room photo. Return strict JSON. The photo is usable when the room is interior, has either a visible main wall or a visible room corner, and adequate lighting. Set ok=false with a short failure_reason otherwise.";

const args = parseArgs(process.argv.slice(2));
const photo = await readPhoto(args.photo);
const apiKey = requireEnv("OPENAI_API_KEY");
const model = args.model ?? "gpt-5";
const runDir = args.out ?? defaultRunDir("validate");
const maxEdge = args["max-edge"]
  ? Number.parseInt(args["max-edge"], 10)
  : maxEdgeFromEnv(720);

const compressed = await compressToMaxEdge(photo.bytes, maxEdge);
if (compressed.resized) {
  info(
    `validate: compressed ${photo.bytes.length}B -> ${compressed.bytes.length}B (${compressed.width}x${compressed.height}, max-edge=${maxEdge})`
  );
}

info(`validate: model=${model} photo=${photo.absolute}`);

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
  fail(`vision response was not JSON: ${content.slice(0, 200)}`);
}

const path = await writeArtifact(
  runDir,
  "validation.json",
  JSON.stringify(parsed, null, 2)
);
info(`validate: saved ${path}`);
console.log(JSON.stringify(parsed, null, 2));
