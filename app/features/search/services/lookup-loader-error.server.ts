import {
  ExternalServiceError,
  isAppError,
  LookupUnsupportedKindError,
  normalizeError,
  NotFoundError,
  ValidationError,
} from "~/lib/errors";

export type LookupLoaderErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UNSUPPORTED"
  | "EXTERNAL_ERROR"
  | "UNKNOWN";

export interface LookupLoaderErrorPayload {
  code: LookupLoaderErrorCode;
  message: string;
  context?: Record<string, unknown>;
}

export function serializeLookupLoaderError(
  error: unknown
): LookupLoaderErrorPayload {
  const err = isAppError(error) ? error : normalizeError(error);
  if (err instanceof ValidationError) {
    return {
      code: "INVALID_INPUT",
      message: err.message,
      context: err.context,
    };
  }
  if (err instanceof NotFoundError) {
    return {
      code: "NOT_FOUND",
      message: err.message,
      context: err.context,
    };
  }
  if (err instanceof LookupUnsupportedKindError) {
    return {
      code: "UNSUPPORTED",
      message: err.message,
      context: err.context,
    };
  }
  if (err instanceof ExternalServiceError) {
    return {
      code: "EXTERNAL_ERROR",
      message: err.message,
      context: err.context,
    };
  }
  return {
    code: "UNKNOWN",
    message: err.message,
    context: err.context,
  };
}
