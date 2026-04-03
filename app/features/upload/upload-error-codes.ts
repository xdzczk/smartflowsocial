/**
 * Normalized upload failure reasons for composer UI, rails, and logging.
 */

export const UploadErrorCodes = {
  SIGNER_NOT_READY: "SIGNER_NOT_READY",
  SIGNER_TIMEOUT: "SIGNER_TIMEOUT",
  SIGNER_REJECTED: "SIGNER_REJECTED",
  SIGNER_AUTH_FAILED: "SIGNER_AUTH_FAILED",
  UPLOAD_PROVIDER_UNAVAILABLE: "UPLOAD_PROVIDER_UNAVAILABLE",
  UPLOAD_NETWORK_ERROR: "UPLOAD_NETWORK_ERROR",
  UPLOAD_FILE_TOO_LARGE: "UPLOAD_FILE_TOO_LARGE",
  UPLOAD_UNSUPPORTED_TYPE: "UPLOAD_UNSUPPORTED_TYPE",
  UPLOAD_RESPONSE_INVALID: "UPLOAD_RESPONSE_INVALID",
  UPLOAD_FINALIZE_FAILED: "UPLOAD_FINALIZE_FAILED",
  UNKNOWN_UPLOAD_ERROR: "UNKNOWN_UPLOAD_ERROR",
} as const;

export type UploadErrorCode =
  (typeof UploadErrorCodes)[keyof typeof UploadErrorCodes];

const DEFAULT_MESSAGES: Record<UploadErrorCode, string> = {
  [UploadErrorCodes.SIGNER_NOT_READY]:
    "Signer not connected. Reconnect signer to upload media.",
  [UploadErrorCodes.SIGNER_TIMEOUT]:
    "Remote signer timed out while authorizing upload.",
  [UploadErrorCodes.SIGNER_REJECTED]:
    "Upload authorization was rejected by your signer.",
  [UploadErrorCodes.SIGNER_AUTH_FAILED]:
    "Could not authorize upload with current signer.",
  [UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE]:
    "Media server unavailable. Try again in a moment.",
  [UploadErrorCodes.UPLOAD_NETWORK_ERROR]:
    "Upload failed due to a network error.",
  [UploadErrorCodes.UPLOAD_FILE_TOO_LARGE]:
    "This file is too large for the current upload limit.",
  [UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE]:
    "This file type is not supported.",
  [UploadErrorCodes.UPLOAD_RESPONSE_INVALID]:
    "The upload response was invalid. Please retry.",
  [UploadErrorCodes.UPLOAD_FINALIZE_FAILED]:
    "Upload could not be finalized. Please retry.",
  [UploadErrorCodes.UNKNOWN_UPLOAD_ERROR]:
    "Upload failed. Retry or remove this file.",
};

export function defaultMessageForUploadError(code: UploadErrorCode): string {
  return DEFAULT_MESSAGES[code];
}

export function uploadErrorMessage(
  code: UploadErrorCode,
  detail?: string | null
): string {
  const base = defaultMessageForUploadError(code);
  if (detail?.trim() && detail !== base) return `${base} ${detail}`;
  return base;
}

export function inferUploadErrorCodeFromMessage(
  message: string,
  options?: { httpStatus?: number }
): UploadErrorCode {
  const m = message.toLowerCase();
  const st = options?.httpStatus;

  if (st === 413) return UploadErrorCodes.UPLOAD_FILE_TOO_LARGE;
  if (st === 415) return UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE;
  if (st === 502 || st === 503 || st === 504)
    return UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE;

  if (
    m.includes("connection check timeout") ||
    m.includes("timed out") ||
    (m.includes("timeout") && m.includes("signer")) ||
    m.includes("reconnect is taking too long")
  ) {
    return UploadErrorCodes.SIGNER_TIMEOUT;
  }
  if (
    m.includes("remote signer is not currently connected") ||
    m.includes("no active signer") ||
    (m.includes("signer not") && m.includes("available")) ||
    m.includes("nostr signer not") ||
    m.includes("connect a nostr signer") ||
    m.includes("connect a signer")
  ) {
    return UploadErrorCodes.SIGNER_NOT_READY;
  }
  if (m.includes("reject") || m.includes("denied") || m.includes("cancelled")) {
    return UploadErrorCodes.SIGNER_REJECTED;
  }
  if (
    m.includes("unauthorized") ||
    m.includes("authorize") ||
    m.includes("auth failed") ||
    m.includes("401")
  ) {
    return UploadErrorCodes.SIGNER_AUTH_FAILED;
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  ) {
    return UploadErrorCodes.UPLOAD_NETWORK_ERROR;
  }
  if (
    m.includes("invalid_mirror_tags") ||
    m.includes("invalid format") ||
    m.includes("expected array of tags")
  ) {
    return UploadErrorCodes.UPLOAD_RESPONSE_INVALID;
  }
  if (
    m.includes("plan") ||
    m.includes("not enabled") ||
    m.includes("token_request_failed") ||
    (m.includes("custom blossom provider") && m.includes("no custom url"))
  ) {
    return UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE;
  }
  if (
    m.includes("too large") ||
    (m.includes("exceeds") && m.includes("mb")) ||
    m.includes("file too big")
  ) {
    return UploadErrorCodes.UPLOAD_FILE_TOO_LARGE;
  }
  if (m.includes("unsupported") || m.includes("not supported")) {
    return UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE;
  }
  if (m.includes("finalize") || m.includes("commit")) {
    return UploadErrorCodes.UPLOAD_FINALIZE_FAILED;
  }

  return UploadErrorCodes.UNKNOWN_UPLOAD_ERROR;
}

export function mapUnknownToUploadError(
  error: unknown,
  ctx?: { httpStatus?: number }
): { code: UploadErrorCode; message: string } {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : UploadErrorCodes.UNKNOWN_UPLOAD_ERROR;
  const code = inferUploadErrorCodeFromMessage(message, ctx);
  const display =
    code === UploadErrorCodes.UNKNOWN_UPLOAD_ERROR && message
      ? message
      : defaultMessageForUploadError(code);
  return { code, message: display };
}

/** Attach `code` to a failed upload result when missing. */
export function enrichFailedUploadResult<
  T extends { success: boolean; error?: string; code?: UploadErrorCode },
>(result: T, httpStatus?: number): T {
  if (result.success || result.code) return result;
  const inferred = inferUploadErrorCodeFromMessage(result.error ?? "", {
    httpStatus,
  });
  return {
    ...result,
    code: inferred,
    error: result.error ?? defaultMessageForUploadError(inferred),
  };
}
