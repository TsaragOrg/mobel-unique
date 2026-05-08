// SPEC-0015 PLAN-0040 public simulation route-handler logic.
//
// The Next.js route.ts files under `apps/web/src/app/api/public/`
// stay thin: they parse the request, delegate to one of these
// handler functions, and return the produced Response. All
// dependencies (token secret, environment, store, now, id
// generators) flow in through `deps` so the handlers stay
// deterministic and unit-testable.

import { randomUUID } from "node:crypto";

import {
  deriveSimulationSessionTokenHash,
  issueSimulationAccessToken,
  parseSimulationAccessTokenFromHeaders,
  validateSimulationAccessToken,
  type SimulationEnvironment
} from "./simulation-access-token";
import {
  validateBackWallSubmittedDimensions,
  validateCornerSubmittedDimensions
} from "./simulation-dimensions";
import {
  hashSimulationIdempotencyKey,
  type SimulationIdempotencyStore
} from "./simulation-idempotency";
import {
  checkSimulationRateLimits,
  type SimulationRateLimitStore
} from "./simulation-rate-limit";
import type {
  BackWallSuppliedDimensions,
  CornerSuppliedDimensions,
  CreateEmailVerificationResponse,
  RoomGeometryMode,
  SimulationJobStatus,
  SimulationRealtimeTokenResponse,
  SimulationPublicErrorBody,
  SimulationPublicErrorCode,
  SimulationStatusResponse,
  VerifyEmailVerificationResponse
} from "./simulation-public-api";

export const VERIFICATION_REQUEST_TTL_SECONDS = 60 * 60;
export const SIMULATION_SIGNED_URL_DEFAULT_TTL_SECONDS = 120;
const VERIFICATION_REQUEST_ID_PREFIX = "stub-";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGENERATION_LIMIT = 3;

export interface SimulationPublicEmailHandlerDeps {
  accessTokenSecret: string;
  environment: SimulationEnvironment;
  now?: () => Date;
  generateVerificationRequestId?: () => string;
}

export interface SimulationJobView {
  jobId: string;
  status: SimulationJobStatus;
  roomGeometryMode: RoomGeometryMode;
  createdAt: Date;
  retentionDeadline: Date;
  storagePrefix: string;
  dimensionGuideOverlayPath: string | null;
  generatedOutputCount: number;
  latestGeneratedOutputIndex: number | null;
  lastErrorMessage: string | null;
  lastRegenerationErrorMessage: string | null;
}

export interface SimulationJobReader {
  findOwnedJob(input: {
    jobId: string;
    accessTokenHash: string;
  }): Promise<SimulationJobView | null>;
}

export interface SimulationStorageSigner {
  signObjectUrl(input: {
    storagePath: string;
    ttlSeconds: number;
  }): Promise<string>;
}

export interface SimulationPublicStatusHandlerDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  storageSigner: SimulationStorageSigner;
  signedUrlTtlSeconds?: number;
  now?: () => Date;
}

export interface SimulationProgressAccessView {
  jobId: string;
  simulationSessionId: string;
  retentionDeadline: Date;
}

export interface SimulationProgressAccessReader {
  findOwnedProgressAccess(input: {
    jobId: string;
    accessTokenHash: string;
  }): Promise<SimulationProgressAccessView | null>;
}

export interface SimulationRealtimeTokenIssuer {
  issueProgressToken(input: {
    jobId: string;
    simulationSessionId: string;
    retentionDeadline: Date;
  }): Promise<{ token: string; expiresAt: Date }>;
}

export interface SimulationPublicRealtimeTokenHandlerDeps {
  accessTokenSecret: string;
  progressAccessReader: SimulationProgressAccessReader;
  realtimeTokenIssuer: SimulationRealtimeTokenIssuer;
  now?: () => Date;
}

export interface SimulationDimensionsStore {
  submit(input: {
    jobId: string;
    suppliedDimensions: BackWallSuppliedDimensions | CornerSuppliedDimensions;
  }): Promise<{ checkpointId: string }>;
}

export interface SimulationRegenerationStore {
  request(input: {
    jobId: string;
  }): Promise<{ checkpointId: string }>;
}

export interface SimulationPublicDimensionsHandlerDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  dimensionsStore: SimulationDimensionsStore;
  now?: () => Date;
}

export interface SimulationPublicRegenerationHandlerDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  regenerationStore: SimulationRegenerationStore;
  now?: () => Date;
}

export interface SimulationPublicRoomPhotoPreviewHandlerDeps {
  roomPhotoNormalizer?: SimulationRoomPhotoNormalizer;
}

export interface SimulationCatalogStore {
  resolveRoomGeometryMode(input: {
    sofaSlug: string;
    cornerTagSlug: string;
  }): Promise<RoomGeometryMode | null>;
}

export interface SimulationStorageUploader {
  uploadRoomPhoto(input: {
    storagePath: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void>;
  deleteUploadedRoomPhoto(input: { storagePath: string }): Promise<void>;
}

export interface SimulationPreparedRoomPhoto {
  fileBytes: Uint8Array;
  fileContentType: string;
  fileExtension: string;
}

export interface SimulationRoomPhotoNormalizer {
  normalize(
    input: SimulationPreparedRoomPhoto
  ): Promise<SimulationPreparedRoomPhoto>;
}

export interface SimulationCreateJobStore {
  create(input: {
    verificationRequestId: string;
    sofaSlug: string;
    fabricId: string;
    visualPositionId: string;
    customerRoomOriginalPath: string;
    roomGeometryMode: RoomGeometryMode;
    jobIdOverride: string;
    retentionHours: number;
  }): Promise<
    | {
        ok: true;
        jobId: string;
        status: SimulationJobStatus;
        createdAt: Date;
        retentionDeadline: Date;
        storagePrefix: string;
      }
    | { ok: false; reason: "triple_not_publishable" }
  >;
}

export interface SimulationPublicCreateHandlerDeps {
  accessTokenSecret: string;
  rateLimitSalt: string;
  rateLimitIpPerDay: number;
  rateLimitEmailPerDay: number;
  cornerTagSlug: string;
  retentionHours: number;
  rateLimitStore: SimulationRateLimitStore;
  idempotencyStore: SimulationIdempotencyStore;
  catalogStore: SimulationCatalogStore;
  storageUploader: SimulationStorageUploader;
  roomPhotoNormalizer?: SimulationRoomPhotoNormalizer;
  createJobStore: SimulationCreateJobStore;
  jobReader: SimulationJobReader;
  generateJobId?: () => string;
  now?: () => Date;
}

export const SIMULATION_CREATE_MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const SIMULATION_ALLOWED_PHOTO_CONTENT_TYPES: Readonly<
  Record<string, string>
> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/heic-sequence": "heic",
  "image/heif-sequence": "heif",
  "image/x-heic": "heic",
  "image/x-heif": "heif"
};

const SIMULATION_CANONICAL_PHOTO_CONTENT_TYPES: Readonly<
  Record<string, string>
> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif"
};

const SIMULATION_GENERIC_PHOTO_CONTENT_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream"
]);

const SIMULATION_HEIC_FILE_EXTENSIONS = new Set(["heic", "heif"]);
const SIMULATION_HEIF_BRANDS = new Set(["mif1", "msf1"]);
const SIMULATION_HEIC_BRAND_ALLOWLIST = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "mif1",
  "msf1",
  "hevc",
  "hevx",
  "hevm",
  "hevs"
]);

export async function handleCreateEmailVerificationRequest(input: {
  body: unknown;
  deps: SimulationPublicEmailHandlerDeps;
}): Promise<Response> {
  const parsed = parseCreateEmailVerificationBody(input.body);
  if (!parsed.ok) {
    return errorResponse("VALIDATION_FAILED", parsed.message, 400);
  }

  const now = (input.deps.now ?? defaultNow)();
  const generateId =
    input.deps.generateVerificationRequestId ??
    defaultGenerateVerificationRequestId;
  const verificationRequestId = generateId();
  const expiresAt = new Date(
    now.getTime() + VERIFICATION_REQUEST_TTL_SECONDS * 1000
  );
  const body: CreateEmailVerificationResponse = {
    verification_request_id: verificationRequestId,
    expires_at: expiresAt.toISOString()
  };
  return jsonResponse({ data: body }, 200);
}

export async function handleVerifyEmailVerificationRequest(input: {
  verificationRequestId: string;
  body: unknown;
  deps: SimulationPublicEmailHandlerDeps;
}): Promise<Response> {
  if (
    !input.verificationRequestId ||
    !input.verificationRequestId.startsWith(VERIFICATION_REQUEST_ID_PREFIX)
  ) {
    return errorResponse(
      "VALIDATION_FAILED",
      "Invalid verification request id",
      400
    );
  }

  if (!isObject(input.body) || typeof input.body.code !== "string") {
    return errorResponse("VALIDATION_FAILED", "code is required", 400);
  }

  const issued = issueSimulationAccessToken({
    verificationRequestId: input.verificationRequestId,
    secret: input.deps.accessTokenSecret,
    environment: input.deps.environment,
    now: input.deps.now
  });

  const body: VerifyEmailVerificationResponse = {
    simulation_access_token: issued.token,
    expires_at: issued.expiresAt.toISOString()
  };
  return jsonResponse({ data: body }, 200, {
    "Set-Cookie": issued.cookieHeader
  });
}

export async function handleGetSimulationStatusRequest(input: {
  jobId: string;
  token: string | null;
  deps: SimulationPublicStatusHandlerDeps;
}): Promise<Response> {
  if (!input.jobId || !UUID_REGEX.test(input.jobId)) {
    return notFoundResponse();
  }

  const validation = validateSimulationAccessToken({
    token: input.token,
    secret: input.deps.accessTokenSecret,
    now: input.deps.now
  });

  if (!validation.valid) {
    if (validation.reason === "missing") {
      return errorResponse(
        "AUTH_REQUIRED",
        "Authentication is required.",
        401
      );
    }
    return errorResponse("AUTH_INVALID", "Authentication is invalid.", 401);
  }

  const accessTokenHash = deriveSimulationSessionTokenHash(
    validation.verificationRequestId
  );

  const job = await input.deps.jobReader.findOwnedJob({
    jobId: input.jobId,
    accessTokenHash
  });

  if (!job) {
    return notFoundResponse();
  }

  const ttl =
    input.deps.signedUrlTtlSeconds ?? SIMULATION_SIGNED_URL_DEFAULT_TTL_SECONDS;
  const responseBody = await buildSimulationStatusBody({
    job,
    storageSigner: input.deps.storageSigner,
    ttlSeconds: ttl
  });

  return jsonResponse({ data: responseBody }, 200);
}

export async function handleGetSimulationRealtimeTokenRequest(input: {
  jobId: string;
  token: string | null;
  deps: SimulationPublicRealtimeTokenHandlerDeps;
}): Promise<Response> {
  const auth = authorizeSimulationAccess({
    jobId: input.jobId,
    token: input.token,
    accessTokenSecret: input.deps.accessTokenSecret,
    now: input.deps.now
  });
  if ("response" in auth) {
    return auth.response;
  }

  const access = await input.deps.progressAccessReader.findOwnedProgressAccess({
    jobId: input.jobId,
    accessTokenHash: auth.accessTokenHash
  });
  if (!access) {
    return notFoundResponse();
  }

  const issued = await input.deps.realtimeTokenIssuer.issueProgressToken({
    jobId: access.jobId,
    simulationSessionId: access.simulationSessionId,
    retentionDeadline: access.retentionDeadline
  });
  const body: SimulationRealtimeTokenResponse = {
    realtime_token: issued.token,
    expires_at: issued.expiresAt.toISOString()
  };
  return jsonResponse({ data: body }, 200);
}

export async function handleSubmitDimensionsRequest(input: {
  jobId: string;
  token: string | null;
  body: unknown;
  deps: SimulationPublicDimensionsHandlerDeps;
}): Promise<Response> {
  const auth = authorizeAndResolveJob({
    jobId: input.jobId,
    token: input.token,
    deps: input.deps
  });
  if ("response" in auth) {
    return auth.response;
  }
  const job = await auth.findJob();
  if (!job) {
    return notFoundResponse();
  }

  const dimensionsResult =
    job.roomGeometryMode === "back_wall"
      ? validateBackWallSubmittedDimensions(input.body)
      : validateCornerSubmittedDimensions(input.body);
  if (!dimensionsResult.ok) {
    return errorResponse("VALIDATION_FAILED", dimensionsResult.message, 400);
  }

  if (job.status !== "awaiting_dimensions") {
    return errorResponse(
      "JOB_STATE_CONFLICT",
      `Simulation is in status ${job.status} and cannot accept dimensions.`,
      409
    );
  }

  await input.deps.dimensionsStore.submit({
    jobId: job.jobId,
    suppliedDimensions: dimensionsResult.dimensions
  });

  return jsonResponse(
    {
      data: {
        simulation_job_id: job.jobId,
        status: "placement_queued" as SimulationJobStatus
      }
    },
    200
  );
}

export async function handleRequestRegenerationRequest(input: {
  jobId: string;
  token: string | null;
  deps: SimulationPublicRegenerationHandlerDeps;
}): Promise<Response> {
  const auth = authorizeAndResolveJob({
    jobId: input.jobId,
    token: input.token,
    deps: input.deps
  });
  if ("response" in auth) {
    return auth.response;
  }
  const job = await auth.findJob();
  if (!job) {
    return notFoundResponse();
  }

  if (job.status !== "succeeded") {
    return errorResponse(
      "JOB_STATE_CONFLICT",
      `Simulation is in status ${job.status} and cannot regenerate.`,
      409
    );
  }
  if (job.generatedOutputCount >= REGENERATION_LIMIT) {
    return errorResponse(
      "REGENERATION_LIMIT_REACHED",
      "Simulation already has the maximum of three generated results.",
      409
    );
  }

  await input.deps.regenerationStore.request({
    jobId: job.jobId
  });

  return jsonResponse(
    {
      data: {
        simulation_job_id: job.jobId,
        status: "placement_queued" as SimulationJobStatus
      }
    },
    200
  );
}

export async function handleCreateSimulationRequest(input: {
  formData: FormData;
  headers: Headers;
  clientIp: string;
  deps: SimulationPublicCreateHandlerDeps;
}): Promise<Response> {
  const token = parseSimulationAccessTokenFromHeaders(input.headers);
  const validation = validateSimulationAccessToken({
    token,
    secret: input.deps.accessTokenSecret,
    now: input.deps.now
  });
  if (!validation.valid) {
    if (validation.reason === "missing") {
      return errorResponse(
        "AUTH_REQUIRED",
        "Authentication is required.",
        401
      );
    }
    return errorResponse("AUTH_INVALID", "Authentication is invalid.", 401);
  }

  const idempotencyKey =
    input.headers.get("idempotency-key") ?? input.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return errorResponse(
      "VALIDATION_FAILED",
      "Idempotency-Key header is required.",
      400
    );
  }

  const parsed = await parseCreateSimulationFormData(input.formData);
  if (!parsed.ok) {
    return errorResponse("VALIDATION_FAILED", parsed.message, 400);
  }

  const rateCheck = await checkSimulationRateLimits({
    ip: input.clientIp,
    email: validation.verificationRequestId,
    ipCap: input.deps.rateLimitIpPerDay,
    emailCap: input.deps.rateLimitEmailPerDay,
    salt: input.deps.rateLimitSalt,
    store: input.deps.rateLimitStore,
    now: input.deps.now
  });
  if (!rateCheck.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      `Daily simulation cap reached for ${rateCheck.tripped}.`,
      429
    );
  }

  const keyHash = hashSimulationIdempotencyKey(idempotencyKey);
  const acquireResult = await input.deps.idempotencyStore.acquire(keyHash);

  if (!acquireResult.acquired) {
    if (!acquireResult.simulationJobId) {
      return errorResponse(
        "IDEMPOTENCY_IN_PROGRESS",
        "A simulation creation is already in progress for this key.",
        409
      );
    }
    const accessTokenHash = deriveSimulationSessionTokenHash(
      validation.verificationRequestId
    );
    const existing = await input.deps.jobReader.findOwnedJob({
      jobId: acquireResult.simulationJobId,
      accessTokenHash
    });
    if (!existing) {
      return errorResponse(
        "IDEMPOTENCY_IN_PROGRESS",
        "Idempotency key collides with another visitor.",
        409
      );
    }
    return jsonResponse(
      {
        data: {
          simulation_job_id: existing.jobId,
          status: existing.status,
          created_at: existing.createdAt.toISOString(),
          retention_deadline: existing.retentionDeadline.toISOString()
        }
      },
      200
    );
  }

  const mode = await input.deps.catalogStore.resolveRoomGeometryMode({
    sofaSlug: parsed.body.sofaSlug,
    cornerTagSlug: input.deps.cornerTagSlug
  });
  if (!mode) {
    return errorResponse(
      "VALIDATION_FAILED",
      "Selected sofa is not available.",
      400
    );
  }

  const jobId = (input.deps.generateJobId ?? randomUUID)();
  let roomPhoto: SimulationPreparedRoomPhoto;
  try {
    roomPhoto = await (
      input.deps.roomPhotoNormalizer ?? defaultSimulationRoomPhotoNormalizer
    ).normalize({
      fileBytes: parsed.body.fileBytes,
      fileContentType: parsed.body.fileContentType,
      fileExtension: parsed.body.fileExtension
    });
  } catch (error) {
    console.error("[simulations] room photo normalization failed:", error);
    return errorResponse(
      "VALIDATION_FAILED",
      "Could not convert HEIC/HEIF room_photo to JPEG.",
      400
    );
  }

  const storagePath = `simulations/${jobId}/inputs/room.${roomPhoto.fileExtension}`;

  try {
    await input.deps.storageUploader.uploadRoomPhoto({
      storagePath,
      bytes: roomPhoto.fileBytes,
      contentType: roomPhoto.fileContentType
    });
  } catch (error) {
    console.error("[simulations] uploadRoomPhoto failed:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Could not upload the room photo.",
      500
    );
  }

  let createResult;
  try {
    createResult = await input.deps.createJobStore.create({
      verificationRequestId: validation.verificationRequestId,
      sofaSlug: parsed.body.sofaSlug,
      fabricId: parsed.body.fabricId,
      visualPositionId: parsed.body.visualPositionId,
      customerRoomOriginalPath: storagePath,
      roomGeometryMode: mode,
      jobIdOverride: jobId,
      retentionHours: input.deps.retentionHours
    });
  } catch (error) {
    console.error("[simulations] createJobStore.create failed:", error);
    await safeDeleteUploadedPhoto(input.deps.storageUploader, storagePath);
    return errorResponse(
      "INTERNAL_ERROR",
      "Could not create the simulation.",
      500
    );
  }

  if (!createResult.ok) {
    await safeDeleteUploadedPhoto(input.deps.storageUploader, storagePath);
    return errorResponse(
      "VALIDATION_FAILED",
      "Selected sofa configuration is not available.",
      400
    );
  }

  try {
    await input.deps.idempotencyStore.finalize(keyHash, createResult.jobId);
  } catch {
    // Non-fatal: subsequent duplicate retries will see acquired=false with
    // null simulation_job_id and surface IDEMPOTENCY_IN_PROGRESS until the
    // row is finalized by a later request or cleaned up by retention.
  }

  return jsonResponse(
    {
      data: {
        simulation_job_id: createResult.jobId,
        status: createResult.status,
        created_at: createResult.createdAt.toISOString(),
        retention_deadline: createResult.retentionDeadline.toISOString()
      }
    },
    201
  );
}

export async function handleConvertSimulationRoomPhotoPreviewRequest(input: {
  formData: FormData;
  deps?: SimulationPublicRoomPhotoPreviewHandlerDeps;
}): Promise<Response> {
  const parsedPhoto = await parseSimulationRoomPhotoBlob(
    input.formData.get("room_photo")
  );
  if (!parsedPhoto.ok) {
    return errorResponse("VALIDATION_FAILED", parsedPhoto.message, 400);
  }

  let roomPhoto: SimulationPreparedRoomPhoto;
  try {
    roomPhoto = await (
      input.deps?.roomPhotoNormalizer ?? defaultSimulationRoomPhotoNormalizer
    ).normalize(parsedPhoto.body);
  } catch (error) {
    console.error(
      "[simulations] room photo preview normalization failed:",
      error
    );
    return errorResponse(
      "VALIDATION_FAILED",
      "Could not convert HEIC/HEIF room_photo to JPEG.",
      400
    );
  }

  if (roomPhoto.fileContentType !== "image/jpeg") {
    return errorResponse(
      "VALIDATION_FAILED",
      "room_photo preview conversion requires HEIC/HEIF input.",
      400
    );
  }

  const responseBuffer = new ArrayBuffer(roomPhoto.fileBytes.byteLength);
  new Uint8Array(responseBuffer).set(roomPhoto.fileBytes);

  return new Response(responseBuffer, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/jpeg"
    },
    status: 200
  });
}

async function safeDeleteUploadedPhoto(
  uploader: SimulationStorageUploader,
  storagePath: string
): Promise<void> {
  try {
    await uploader.deleteUploadedRoomPhoto({ storagePath });
  } catch {
    // Orphan cleanup will pick it up later.
  }
}

export const defaultSimulationRoomPhotoNormalizer: SimulationRoomPhotoNormalizer = {
  async normalize(input) {
    if (!SIMULATION_HEIC_FILE_EXTENSIONS.has(input.fileExtension)) {
      return input;
    }

    const heicConvertModule = await import("heic-convert");
    const jpegBuffer = await heicConvertModule.default({
      buffer: Buffer.from(input.fileBytes),
      format: "JPEG",
      quality: 0.9
    });

    return {
      fileBytes: new Uint8Array(jpegBuffer),
      fileContentType: "image/jpeg",
      fileExtension: "jpg"
    };
  }
};

async function parseCreateSimulationFormData(
  formData: FormData
): Promise<
  | {
      ok: true;
      body: {
        sofaSlug: string;
        fabricId: string;
        visualPositionId: string;
        fileBytes: Uint8Array;
        fileContentType: string;
        fileExtension: string;
      };
    }
  | { ok: false; message: string }
> {
  const sofaSlug = formData.get("sofa_slug");
  const fabricId = formData.get("fabric_id");
  const visualPositionId = formData.get("visual_position_id");
  const file = formData.get("room_photo");

  if (typeof sofaSlug !== "string" || sofaSlug.trim().length === 0) {
    return { ok: false, message: "sofa_slug is required" };
  }
  if (typeof fabricId !== "string" || !UUID_REGEX.test(fabricId)) {
    return { ok: false, message: "fabric_id must be a UUID" };
  }
  if (
    typeof visualPositionId !== "string" ||
    !UUID_REGEX.test(visualPositionId)
  ) {
    return { ok: false, message: "visual_position_id must be a UUID" };
  }
  const parsedPhoto = await parseSimulationRoomPhotoBlob(file);
  if (!parsedPhoto.ok) return parsedPhoto;

  return {
    ok: true,
    body: {
      sofaSlug: sofaSlug.trim(),
      fabricId,
      visualPositionId,
      fileBytes: parsedPhoto.body.fileBytes,
      fileContentType: parsedPhoto.body.fileContentType,
      fileExtension: parsedPhoto.body.fileExtension
    }
  };
}

async function parseSimulationRoomPhotoBlob(value: unknown): Promise<
  | {
      ok: true;
      body: SimulationPreparedRoomPhoto;
    }
  | { ok: false; message: string }
> {
  if (!isBlobLike(value)) {
    return { ok: false, message: "room_photo file is required" };
  }
  const blob = value;
  if (blob.size === 0) {
    return { ok: false, message: "room_photo is empty" };
  }
  if (blob.size > SIMULATION_CREATE_MAX_PHOTO_BYTES) {
    return {
      ok: false,
      message: `room_photo exceeds ${SIMULATION_CREATE_MAX_PHOTO_BYTES} bytes`
    };
  }
  const bytes = new Uint8Array(await readBlobBytes(blob));
  const rawContentType = normalizeSimulationPhotoContentType(blob.type);
  const photoType = resolveSimulationPhotoType({
    contentType: rawContentType,
    filename: getBlobFilename(blob),
    bytes
  });
  if (!photoType) {
    return {
      ok: false,
      message: `room_photo content-type ${rawContentType || "<unknown>"} is not supported`
    };
  }
  return {
    ok: true,
    body: {
      fileBytes: bytes,
      fileContentType: photoType.contentType,
      fileExtension: photoType.extension
    }
  };
}

function resolveSimulationPhotoType(input: {
  contentType: string;
  filename: string | null;
  bytes: Uint8Array;
}): { contentType: string; extension: string } | null {
  const extensionFromContentType =
    SIMULATION_ALLOWED_PHOTO_CONTENT_TYPES[input.contentType];
  if (extensionFromContentType) {
    return {
      contentType: canonicalSimulationPhotoContentType(extensionFromContentType),
      extension: extensionFromContentType
    };
  }

  const heicBrand = detectSimulationHeicBrand(input.bytes);
  const extensionFromFilename = parseSimulationPhotoFilenameExtension(
    input.filename
  );
  if (
    heicBrand &&
    extensionFromFilename &&
    SIMULATION_HEIC_FILE_EXTENSIONS.has(extensionFromFilename) &&
    SIMULATION_GENERIC_PHOTO_CONTENT_TYPES.has(input.contentType)
  ) {
    return {
      contentType: canonicalSimulationPhotoContentType(extensionFromFilename),
      extension: extensionFromFilename
    };
  }

  if (
    heicBrand &&
    SIMULATION_GENERIC_PHOTO_CONTENT_TYPES.has(input.contentType)
  ) {
    const extension = SIMULATION_HEIF_BRANDS.has(heicBrand) ? "heif" : "heic";
    return {
      contentType: canonicalSimulationPhotoContentType(extension),
      extension
    };
  }

  return null;
}

function canonicalSimulationPhotoContentType(extension: string): string {
  return (
    SIMULATION_CANONICAL_PHOTO_CONTENT_TYPES[extension] ??
    "application/octet-stream"
  );
}

function normalizeSimulationPhotoContentType(contentType: string): string {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function getBlobFilename(blob: Blob): string | null {
  const filename = (blob as { name?: unknown }).name;
  return typeof filename === "string" ? filename : null;
}

function parseSimulationPhotoFilenameExtension(
  filename: string | null
): string | null {
  if (!filename) return null;
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== filename.toLowerCase() ? extension : null;
}

function detectSimulationHeicBrand(bytes: Uint8Array): string | null {
  if (readFourByteAscii(bytes, 4) !== "ftyp") return null;
  const boxSize = readUint32(bytes, 0);
  const scanEnd =
    boxSize >= 16 && boxSize <= bytes.length
      ? boxSize
      : Math.min(bytes.length, 64);
  for (let offset = 8; offset + 4 <= scanEnd; offset += 4) {
    if (offset === 12) continue;
    const brand = readFourByteAscii(bytes, offset);
    if (brand && SIMULATION_HEIC_BRAND_ALLOWLIST.has(brand)) {
      return brand;
    }
  }
  return null;
}

function readFourByteAscii(bytes: Uint8Array, offset: number): string | null {
  if (bytes.length < offset + 4) return null;
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0
  ).toLowerCase();
}

function readUint32(bytes: Uint8Array, offset: number): number {
  if (bytes.length < offset + 4) return 0;
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { size?: unknown }).size === "number" &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

async function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof (blob as { arrayBuffer?: unknown }).arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  if (typeof FileReader !== "undefined") {
    return readBlobBytesWithFileReader(blob);
  }
  return new Response(blob).arrayBuffer();
}

function readBlobBytesWithFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("Could not read room_photo bytes"));
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read room_photo bytes"));
    };
    reader.readAsArrayBuffer(blob);
  });
}

interface AuthorizedJobResolver {
  findJob: () => Promise<SimulationJobView | null>;
}

interface AuthorizeAndResolveDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  now?: () => Date;
}

function authorizeAndResolveJob(input: {
  jobId: string;
  token: string | null;
  deps: AuthorizeAndResolveDeps;
}):
  | { response: Response }
  | AuthorizedJobResolver {
  const auth = authorizeSimulationAccess({
    jobId: input.jobId,
    token: input.token,
    accessTokenSecret: input.deps.accessTokenSecret,
    now: input.deps.now
  });
  if ("response" in auth) {
    return auth;
  }

  return {
    findJob: () =>
      input.deps.jobReader.findOwnedJob({
        jobId: input.jobId,
        accessTokenHash: auth.accessTokenHash
      })
  };
}

function authorizeSimulationAccess(input: {
  jobId: string;
  token: string | null;
  accessTokenSecret: string;
  now?: () => Date;
}): { response: Response } | { accessTokenHash: string } {
  if (!input.jobId || !UUID_REGEX.test(input.jobId)) {
    return { response: notFoundResponse() };
  }

  const validation = validateSimulationAccessToken({
    token: input.token,
    secret: input.accessTokenSecret,
    now: input.now
  });
  if (!validation.valid) {
    if (validation.reason === "missing") {
      return {
        response: errorResponse(
          "AUTH_REQUIRED",
          "Authentication is required.",
          401
        )
      };
    }
    return {
      response: errorResponse(
        "AUTH_INVALID",
        "Authentication is invalid.",
        401
      )
    };
  }

  const accessTokenHash = deriveSimulationSessionTokenHash(
    validation.verificationRequestId
  );

  return { accessTokenHash };
}

export function defaultVerificationRequestIdGenerator(): string {
  return `${VERIFICATION_REQUEST_ID_PREFIX}${randomUUID()}`;
}

async function buildSimulationStatusBody(input: {
  job: SimulationJobView;
  storageSigner: SimulationStorageSigner;
  ttlSeconds: number;
}): Promise<SimulationStatusResponse> {
  const { job, storageSigner, ttlSeconds } = input;

  const response: SimulationStatusResponse = {
    simulation_job_id: job.jobId,
    status: job.status,
    room_geometry_mode: job.roomGeometryMode,
    created_at: job.createdAt.toISOString(),
    retention_deadline: job.retentionDeadline.toISOString(),
    generated_output_count: job.generatedOutputCount,
    regeneration_available:
      job.status === "succeeded" &&
      job.generatedOutputCount < REGENERATION_LIMIT
  };

  if (job.status === "awaiting_dimensions") {
    response.required_dimensions =
      job.roomGeometryMode === "back_wall"
        ? ["wall_width", "wall_height", "room_depth"]
        : ["left_wall_width", "right_wall_width", "room_height", "room_depth"];

    if (job.dimensionGuideOverlayPath) {
      response.dimension_guide_overlay_url = await storageSigner.signObjectUrl({
        storagePath: job.dimensionGuideOverlayPath,
        ttlSeconds
      });
    }
  }

  const showResult =
    job.status === "succeeded" ||
    job.status === "placement_queued" ||
    job.status === "placement_processing";

  if (
    showResult &&
    job.latestGeneratedOutputIndex !== null &&
    job.generatedOutputCount > 0
  ) {
    const outputPath = `${job.storagePrefix}/outputs/output-${job.latestGeneratedOutputIndex}.png`;
    response.latest_output_url = await storageSigner.signObjectUrl({
      storagePath: outputPath,
      ttlSeconds
    });
  }

  if (job.status === "failed" || job.status === "canceled") {
    response.last_error = job.lastErrorMessage ?? null;
  } else if (job.status === "succeeded" && job.lastRegenerationErrorMessage) {
    response.last_error = job.lastRegenerationErrorMessage;
  }

  return response;
}

function defaultGenerateVerificationRequestId(): string {
  return defaultVerificationRequestIdGenerator();
}

function defaultNow(): Date {
  return new Date();
}

function parseCreateEmailVerificationBody(
  input: unknown
):
  | { ok: true; email: string; consentMarketing: boolean | undefined }
  | { ok: false; message: string } {
  if (!isObject(input)) {
    return { ok: false, message: "Body must be a JSON object" };
  }
  const email = input.email;
  const consent = input.consent_email_use;
  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return { ok: false, message: "email must be a valid email address" };
  }
  if (consent !== true) {
    return { ok: false, message: "consent_email_use must be true" };
  }
  const consentMarketing =
    typeof input.consent_marketing === "boolean"
      ? input.consent_marketing
      : undefined;
  return { ok: true, email, consentMarketing };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  code: SimulationPublicErrorCode,
  message: string,
  status: number
): Response {
  const body: SimulationPublicErrorBody = {
    error: { code, message }
  };
  return jsonResponse(body, status);
}

function notFoundResponse(): Response {
  return errorResponse(
    "JOB_NOT_FOUND",
    "Simulation not found or no longer accessible.",
    404
  );
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...headers
    },
    status
  });
}
