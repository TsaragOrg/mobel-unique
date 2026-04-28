#!/usr/bin/env node

import zlib from "node:zlib";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUEUE_NAME =
  process.env.FABRIC_RENDER_QUEUE_NAME ?? "local_fabric_render_jobs";

if (!SERVICE_ROLE_KEY) {
  console.error(
    "FAIL seed fabric render Gemini smoke: SUPABASE_SERVICE_ROLE_KEY is not set."
  );
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "content-type": "application/json"
};

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(kind) {
  const width = 512;
  const height = 512;
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;

    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;

      if (kind === "fabric") {
        const stripe = Math.floor((x + y) / 24) % 2;
        raw[offset] = stripe ? 154 : 226;
        raw[offset + 1] = stripe ? 43 : 194;
        raw[offset + 2] = stripe ? 58 : 170;
        continue;
      }

      const sofaBody = x > 80 && x < 430 && y > 230 && y < 370;
      const sofaArm =
        (x > 60 && x < 135 && y > 245 && y < 370) ||
        (x > 377 && x < 452 && y > 245 && y < 370);
      const sofaBack = x > 110 && x < 410 && y > 205 && y < 285;
      const sofaLeg =
        ((x > 125 && x < 145) || (x > 365 && x < 385)) &&
        y > 365 &&
        y < 430;

      if (sofaBody || sofaArm || sofaBack) {
        raw[offset] = 90;
        raw[offset + 1] = 112;
        raw[offset + 2] = 132;
      } else if (sofaLeg) {
        raw[offset] = 55;
        raw[offset + 1] = 45;
        raw[offset + 2] = 38;
      } else {
        raw[offset] = 245;
        raw[offset + 1] = 242;
        raw[offset + 2] = 236;
      }
    }
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function storageObjectUrl(bucketId, objectPath) {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(
    bucketId
  )}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

async function checkedFetch(url, init) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${await response.text()}`);
  }

  return response;
}

async function readStorageAsset(assetId) {
  const response = await checkedFetch(
    `${SUPABASE_URL}/rest/v1/storage_assets?id=eq.${assetId}&select=id,bucket_id,object_path`,
    {
      headers: restHeaders
    }
  );
  const [asset] = await response.json();

  if (!asset) {
    throw new Error(`Missing storage asset ${assetId}.`);
  }

  return asset;
}

async function uploadInputAsset(asset, bytes) {
  await checkedFetch(storageObjectUrl(asset.bucket_id, asset.object_path), {
    body: bytes,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "image/png",
      "x-upsert": "true"
    },
    method: "POST"
  });

  await checkedFetch(`${SUPABASE_URL}/rest/v1/storage_assets?id=eq.${asset.id}`, {
    body: JSON.stringify({
      byte_size: bytes.length,
      content_type: "image/png",
      height_px: 512,
      width_px: 512
    }),
    headers: restHeaders,
    method: "PATCH"
  });
}

async function main() {
  const seedResponse = await checkedFetch(
    `${SUPABASE_URL}/rest/v1/rpc/fabric_render_worker_seed_mock_job`,
    {
      body: JSON.stringify({ queue_name: QUEUE_NAME }),
      headers: restHeaders,
      method: "POST"
    }
  );
  const seed = await seedResponse.json();
  const jobId = seed.job_id;

  const jobResponse = await checkedFetch(
    `${SUPABASE_URL}/rest/v1/fabric_render_jobs?id=eq.${jobId}&select=id,target_sofa_asset_id,fabric_ai_reference_asset_id`,
    {
      headers: restHeaders
    }
  );
  const [job] = await jobResponse.json();

  if (!job) {
    throw new Error(`Expected one seeded job for ${jobId}.`);
  }

  const targetAsset = await readStorageAsset(job.target_sofa_asset_id);
  const fabricAsset = await readStorageAsset(job.fabric_ai_reference_asset_id);

  await uploadInputAsset(targetAsset, makePng("target"));
  await uploadInputAsset(fabricAsset, makePng("fabric"));

  await checkedFetch(`${SUPABASE_URL}/rest/v1/fabric_render_jobs?id=eq.${jobId}`, {
    body: JSON.stringify({
      prompt_note: "Local smoke test. Keep the sofa shape simple and clear.",
      prompt_version: "v007",
      provider_model: "gemini-3-pro-image-preview",
      provider_name: "gemini"
    }),
    headers: restHeaders,
    method: "PATCH"
  });

  console.log(`SEEDED_GEMINI_JOB=${jobId}`);
}

main().catch((error) => {
  console.error(
    `FAIL seed fabric render Gemini smoke: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
});
