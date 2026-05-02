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
  validateSimulationAccessToken,
  type SimulationEnvironment
} from "./simulation-access-token";
import {
  validateBackWallSubmittedDimensions,
  validateCornerSubmittedDimensions
} from "./simulation-dimensions";
import type {
  BackWallSuppliedDimensions,
  CornerSuppliedDimensions,
  CreateEmailVerificationResponse,
  RoomGeometryMode,
  SimulationJobStatus,
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

export interface SimulationDimensionsStore {
  submit(input: {
    jobId: string;
    suppliedDimensions: BackWallSuppliedDimensions | CornerSuppliedDimensions;
    queueName: string;
  }): Promise<{ msgId: number }>;
}

export interface SimulationRegenerationStore {
  request(input: {
    jobId: string;
    queueName: string;
  }): Promise<{ msgId: number }>;
}

export interface SimulationPublicDimensionsHandlerDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  dimensionsStore: SimulationDimensionsStore;
  queueName: string;
  now?: () => Date;
}

export interface SimulationPublicRegenerationHandlerDeps {
  accessTokenSecret: string;
  jobReader: SimulationJobReader;
  regenerationStore: SimulationRegenerationStore;
  queueName: string;
  now?: () => Date;
}

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
    suppliedDimensions: dimensionsResult.dimensions,
    queueName: input.deps.queueName
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
    jobId: job.jobId,
    queueName: input.deps.queueName
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
  if (!input.jobId || !UUID_REGEX.test(input.jobId)) {
    return { response: notFoundResponse() };
  }

  const validation = validateSimulationAccessToken({
    token: input.token,
    secret: input.deps.accessTokenSecret,
    now: input.deps.now
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

  return {
    findJob: () =>
      input.deps.jobReader.findOwnedJob({
        jobId: input.jobId,
        accessTokenHash
      })
  };
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
