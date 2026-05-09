import {
  ADMIN_COPY,
  ADMIN_ERROR_MESSAGES,
  formatAdminErrorCodeMessage,
  formatAdminPublicationBlockerLabel as formatPublicationBlockerCopyLabel,
  formatRenderCellBlockerLabel as formatRenderCellBlockerCopyLabel,
  isTechnicalAdminErrorCode,
} from "./admin-copy";

export function formatAdminApiErrorMessage(payload: unknown) {
  const error = readObject(readObject(payload)?.error);
  const code = readString(error?.code);
  const message = readString(error?.message);

  if (code) {
    return formatAdminErrorMessage(code);
  }

  if (message) {
    return formatAdminErrorMessage(message);
  }

  return formatAdminErrorMessage("");
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
    return ADMIN_COPY.errors.generic;
  }

  if (message in ADMIN_ERROR_MESSAGES) {
    return formatAdminErrorCodeMessage(message);
  }

  if (isTechnicalAdminErrorCode(message)) {
    return ADMIN_COPY.errors.generic;
  }

  return message;
}

export function formatAdminPublicationBlockerLabel(code: string) {
  return formatPublicationBlockerCopyLabel(code);
}

export function formatRenderCellBlockerLabel(code: string) {
  return formatRenderCellBlockerCopyLabel(code);
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}
