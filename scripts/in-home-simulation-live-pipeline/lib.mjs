// SPEC-0007 local live-pipeline harness shared helpers.
//
// The harness lets a developer run the in-home simulation Stage 1 and
// Stage 2 sub-steps directly against OpenAI from Node, bypassing the
// Supabase Edge Function so the local CPU/time limits do not bite.
// Every script saves its artifact under `tmp/sim-live/<run>/<step>` so
// the output can be opened in Finder for visual review.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

export function fail(message, exitCode = 1) {
  console.error(`FAIL: ${message}`);
  process.exit(exitCode);
}

export function info(message) {
  console.log(message);
}

export function repoRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..");
}

export function defaultRunDir(slug) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return resolve(repoRoot(), "tmp", "sim-live", `${stamp}-${slug}`);
}

export async function ensureDir(path) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
  return path;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.length === 0) {
    fail(
      `${name} is required. Add it to supabase/.env.local and re-run via the pnpm sim:live:* alias.`,
      2
    );
  }
  return value;
}

export async function readPhoto(photoArgPath) {
  if (!photoArgPath) {
    fail("missing --photo PATH", 2);
  }
  const absolute = resolve(photoArgPath);
  if (!existsSync(absolute)) {
    fail(`photo file not found: ${absolute}`, 2);
  }
  const bytes = await readFile(absolute);
  return { absolute, bytes, name: basename(absolute), ext: extname(absolute).toLowerCase() };
}

export function detectMimeType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  return "image/png";
}

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--") continue;
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

export async function callOpenAIChat({ apiKey, body }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai chat HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return response.json();
}

export async function callOpenAIImagesEdit({ apiKey, formData }) {
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai images.edits HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return response.json();
}

export async function writeArtifact(dir, name, bytesOrText) {
  await ensureDir(dir);
  const path = resolve(dir, name);
  await writeFile(path, bytesOrText);
  return path;
}

// Cap the longest edge of a JPEG/PNG buffer at maxEdge pixels so we
// pay for fewer input tokens at OpenAI. If the source is already
// within the cap, the original bytes are returned unchanged.
export async function compressToMaxEdge(bytes, maxEdge, quality = 85) {
  const { decode } = await import("imagescript");
  let decoded;
  try {
    decoded = await decode(bytes);
  } catch (error) {
    fail(
      `could not decode photo for compression: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const longest = Math.max(decoded.width, decoded.height);
  if (longest <= maxEdge) {
    return {
      bytes,
      width: decoded.width,
      height: decoded.height,
      mimeType: detectMimeType(bytes),
      resized: false
    };
  }
  const scale = maxEdge / longest;
  const newWidth = Math.max(1, Math.round(decoded.width * scale));
  const newHeight = Math.max(1, Math.round(decoded.height * scale));
  const resizedImage = decoded.clone().resize(newWidth, newHeight);
  const jpegBytes = await resizedImage.encodeJPEG(quality);
  return {
    bytes: jpegBytes,
    width: newWidth,
    height: newHeight,
    mimeType: "image/jpeg",
    resized: true
  };
}

export function maxEdgeFromEnv(fallback = 720) {
  const raw = process.env.IN_HOME_SIMULATION_MAX_EDGE_PX;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
