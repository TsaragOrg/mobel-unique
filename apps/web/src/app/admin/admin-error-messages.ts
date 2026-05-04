const GENERIC_ADMIN_ERROR_MESSAGE = "Something went wrong. Please try again.";

const TECHNICAL_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_REQUIRED: "This account cannot open the admin area.",
  ASSET_PREVIEW_UNAVAILABLE:
    "The preview image is not available right now. Please try again.",
  AUTH_INVALID: "Your admin session expired. Please sign in again.",
  AUTH_REQUIRED: "Please sign in again to continue.",
  CATALOG_UNAVAILABLE: "Catalog service is unavailable.",
  FABRIC_ARCHIVED: "This fabric is archived and cannot be used.",
  FABRIC_CONFLICT: "Another fabric already uses these public details.",
  FABRIC_NOT_FOUND: "Fabric was not found.",
  FABRIC_RENDER_CANDIDATE_NOT_FOUND: "Image option was not found.",
  FABRIC_RENDER_JOB_CONFLICT:
    "An equivalent image generation job is already active.",
  FABRIC_RENDER_JOB_FAILED: "The image generation failed.",
  FABRIC_RENDER_JOB_NOT_FOUND: "Image generation job was not found.",
  FABRIC_RENDER_WORKER_INVOKE_FAILED:
    "Image generation could not start. Please try again.",
  IMAGE_DECODE_FAILED:
    "The image could not be read. Please choose another image.",
  IMAGE_PREPARATION_UNAVAILABLE:
    "Image preparation is not available in this browser.",
  INVALID_JSON: "Request body must be valid JSON.",
  INVALID_REQUEST: "Some entered data is missing or invalid.",
  MANUAL_RENDER_NOT_FOUND: "Manual render was not found.",
  MANUAL_RENDER_REQUIRED: "Choose an image before uploading a manual render.",
  REFINE_PROMPT_REQUIRED:
    "Write what should be improved before starting refinement.",
  RENDER_CELL_NOT_FOUND: "Render cell was not found.",
  SOFA_CONFLICT: "This sofa cannot be changed in its current state.",
  SOFA_FABRIC_NOT_FOUND: "This fabric line was not found.",
  SOFA_FABRIC_ORDER_CONFLICT:
    "Another fabric already uses this public order.",
  SOFA_NOT_FOUND: "Sofa was not found.",
  SOFA_RENDER_EXPORT_NOT_FOUND: "Render export was not found.",
  STORAGE_ASSET_NOT_FOUND: "Stored image was not found.",
  TAG_CONFLICT: "A tag with this label or slug already exists.",
  TAG_IN_USE: "This tag is already assigned to a sofa, so it cannot be deleted.",
  TAG_NOT_FOUND: "Tag was not found.",
  UNSUPPORTED_FIELD: "Some entered data cannot be saved here.",
  UNSUPPORTED_MEDIA_TYPE: "Request body must be JSON.",
  UPLOAD_FAILED: "The image upload failed. Please try again.",
  UPLOAD_NOT_FOUND: "Upload was not found or has expired.",
  VALIDATION_FAILED: "Some entered data is missing or invalid.",
  VISUAL_MATRIX_COLUMN_CONFLICT:
    "Another view column already uses these details.",
  VISUAL_MATRIX_COLUMN_NOT_FOUND: "View column was not found.",
};

const ADMIN_PUBLICATION_BLOCKER_LABELS: Record<string, string> = {
  INCOMPLETE_PUBLIC_RENDER_COVERAGE: "Missing public renders",
  MISSING_ACTIVE_VISUAL_POSITION: "Missing active view",
  MISSING_FABRIC_AI_REFERENCE: "Fabric reference image missing",
  MISSING_FROZEN_PUBLIC_SLUG: "Public link is not ready",
  MISSING_OR_INVALID_SHOPIFY_ORDER_URL: "Shopify link needs fixing",
  MISSING_PUBLIC_FABRIC: "No public fabric yet",
  MISSING_PUBLIC_NAME: "Public name missing",
  MISSING_PUBLIC_SWATCH_ASSET: "Fabric swatch missing",
  MISSING_SOURCE_PHOTO: "Source photo missing",
  SOURCE_PHOTO_MISSING: "Source photo missing",
};

const RENDER_CELL_BLOCKER_LABELS: Record<string, string> = {
  MISSING_FABRIC_AI_REFERENCE: "Fabric reference image missing",
  MISSING_SOURCE_PHOTO: "Source photo missing",
  SOURCE_PHOTO_MISSING: "Source photo missing",
};

export function formatAdminApiErrorMessage(payload: unknown) {
  const error = readObject(readObject(payload)?.error);
  const message = readString(error?.message);

  if (message) {
    return formatAdminErrorMessage(message);
  }

  return formatAdminErrorMessage(readString(error?.code));
}

export function formatAdminErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = rawMessage.trim();

  if (!message) {
    return GENERIC_ADMIN_ERROR_MESSAGE;
  }

  if (ADMIN_ERROR_MESSAGES[message]) {
    return ADMIN_ERROR_MESSAGES[message];
  }

  if (TECHNICAL_ERROR_CODE_PATTERN.test(message)) {
    return GENERIC_ADMIN_ERROR_MESSAGE;
  }

  return message;
}

export function formatAdminPublicationBlockerLabel(code: string) {
  return ADMIN_PUBLICATION_BLOCKER_LABELS[code] ?? "Publication needs attention";
}

export function formatRenderCellBlockerLabel(code: string) {
  return RENDER_CELL_BLOCKER_LABELS[code] ?? "Missing input";
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}
