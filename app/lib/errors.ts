/**
 * Centralized Error Handling System
 *
 * This module provides a comprehensive error handling system with:
 * - Custom error classes for different error types
 * - Structured error responses
 * - Error logging
 * - Type-safe error handling
 */

/**
 * Base error class for all application errors
 */
const MEDIA_NOT_READY_MESSAGE =
  "Media is still processing. Please retry in a moment.";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: Error.captureStackTrace exists in V8 but not in all JS engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.context && { context: this.context }),
    };
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", true, context);
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(
    message = "Authentication required",
    context?: Record<string, unknown>
  ) {
    super(message, 401, "AUTHENTICATION_ERROR", true, context);
  }
}

/**
 * Profile/pubkey mismatch errors (401)
 * Used when the active connection identity does not match the signer identity.
 */
export class ProfileMismatchError extends AppError {
  constructor(
    message = "Different signer profile detected  -  re-authentication required",
    context?: Record<string, unknown>
  ) {
    super(message, 401, "PROFILE_MISMATCH", true, context);
  }
}

/**
 * Remote signer timeout/unavailable (408).
 * Used when a NIP-46 remote signer doesn't respond in time (often because the signer app is closed/backgrounded).
 *
 * Probe error taxonomy: REMOTE_SIGNER_TIMEOUT / this error means "signer offline or timeout".
 * It must NOT by itself trigger the reconnect dialog. The reconnect dialog is opened only via
 * emitOpenRemoteSignerReconnectDialogEvent() (e.g. explicit user action, primary failover failed,
 * or future unauthorized/malformed bunker paths).
 */
export class RemoteSignerTimeoutError extends AppError {
  constructor(
    message = "Remote signer did not respond. Open your signer app and try again.",
    context?: Record<string, unknown>
  ) {
    super(message, 408, "REMOTE_SIGNER_TIMEOUT", true, context);
  }
}

/**
 * NIP-07 extension account mismatch (401)
 * Used when the extension's current account differs from the logged-in user (user switched account in extension).
 */
export class Nip07AccountMismatchError extends AppError {
  constructor(
    message = "Extension account does not match. Switch back to the correct account in your extension or re-login.",
    context?: Record<string, unknown>
  ) {
    super(message, 401, "NIP07_ACCOUNT_MISMATCH", true, context);
  }
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(
    message = "Insufficient permissions",
    context?: Record<string, unknown>
  ) {
    super(message, 403, "AUTHORIZATION_ERROR", true, context);
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    context?: Record<string, unknown>
  ) {
    super(message, 404, "NOT_FOUND_ERROR", true, context);
  }
}

/**
 * Lookup resolved to an event kind we do not support in the inspector (e.g. non–kind-1 for note-style input).
 */
export class LookupUnsupportedKindError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 422, "LOOKUP_UNSUPPORTED_KIND", true, context);
  }
}

/**
 * Conflict errors (409)
 */
export class ConflictError extends AppError {
  constructor(
    message = "Resource conflict",
    context?: Record<string, unknown>
  ) {
    super(message, 409, "CONFLICT_ERROR", true, context);
  }
}

/**
 * Media readiness errors (409)
 */
export class MediaNotReadyError extends AppError {
  constructor(
    message = MEDIA_NOT_READY_MESSAGE,
    context?: Record<string, unknown>
  ) {
    super(message, 409, "MEDIA_NOT_READY", true, context);
  }
}

/**
 * Rate limit errors (429)
 */
export class RateLimitError extends AppError {
  constructor(
    message = "Rate limit exceeded",
    context?: Record<string, unknown>
  ) {
    super(message, 429, "RATE_LIMIT_ERROR", true, context);
  }
}

/**
 * External service errors (502, 503, 504)
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    statusCode = 502,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, "EXTERNAL_SERVICE_ERROR", true, context);
  }
}

/**
 * Database errors (500)
 */
export class DatabaseError extends AppError {
  constructor(
    message = "Database operation failed",
    context?: Record<string, unknown>
  ) {
    super(message, 500, "DATABASE_ERROR", true, context);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      "code" in error)
  );
}

/**
 * Type guard to check if error is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Normalize any error to an AppError
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (isError(error)) {
    const message = error.message.trim();

    // Check for common Prisma errors
    if (message.includes("Unique constraint")) {
      return new ConflictError(
        "A record with this information already exists",
        { originalError: error.message }
      );
    }

    if (message.includes("Record to update not found")) {
      return new NotFoundError(
        "The record you're trying to update doesn't exist",
        {
          originalError: error.message,
        }
      );
    }

    // Check for authentication errors
    if (
      message.toLowerCase().includes("authentication required") ||
      message.toLowerCase().includes("authentication error") ||
      message.toLowerCase().includes("not authenticated")
    ) {
      return new AuthenticationError(message, {
        originalError: error.message,
      });
    }

    // Check for authorization/subscription errors
    if (
      message.toLowerCase().includes("subscription required") ||
      message.toLowerCase().includes("subscription error")
    ) {
      return new AuthorizationError(message, {
        originalError: error.message,
      });
    }

    // Check for feature access errors
    if (
      message.toLowerCase().includes("feature access denied") ||
      message.toLowerCase().includes("feature not available")
    ) {
      return new AuthorizationError(message, {
        originalError: error.message,
      });
    }

    // Check for database errors
    if (
      message.toLowerCase().includes("database error") ||
      message.toLowerCase().includes("database connection failed") ||
      message.toLowerCase().includes("database operation failed")
    ) {
      return new DatabaseError(message, {
        originalError: error.message,
      });
    }

    // Generic error - use default message if empty
    const errorMessage =
      message && message !== "" ? message : "An unexpected error occurred";
    return new AppError(errorMessage, 500, "INTERNAL_ERROR", false, {
      originalError: error.message,
    });
  }

  // Unknown error type
  return new AppError(
    "An unexpected error occurred",
    500,
    "UNKNOWN_ERROR",
    false,
    { originalError: String(error) }
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  // Always return the actual message in test/development mode
  const isTestOrDev =
    process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";

  if (isTestOrDev) {
    return error.message;
  }

  // Don't expose internal errors to users in production
  if (!error.isOperational && process.env.NODE_ENV === "production") {
    return "An unexpected error occurred. Please try again later.";
  }

  return error.message;
}

/**
 * Extract a display-safe error message from Remix actionData (e.g. from handleActionError).
 * Action error shape is { success: false, error: { message, code, statusCode, ... } }.
 * Returns a string for UI display, or undefined if no error.
 */
export function getActionErrorMessage(data: unknown): string | undefined {
  if (data == null || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;
  if (!("error" in obj)) return undefined;
  const err = obj["error"];
  if (typeof err === "string") return err;
  if (err != null && typeof err === "object" && "message" in err) {
    const errorObj = err as { message?: unknown; code?: unknown };
    const code = typeof errorObj.code === "string" ? errorObj.code : "";
    if (code.toUpperCase() === "MEDIA_NOT_READY") {
      return MEDIA_NOT_READY_MESSAGE;
    }
    const msg = errorObj.message;
    if (typeof msg === "string") {
      if (msg.toLowerCase().includes("media_not_ready")) {
        return MEDIA_NOT_READY_MESSAGE;
      }
      return msg;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Error codes enum for type safety
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  MEDIA_NOT_READY: "MEDIA_NOT_READY",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  NIP07_ACCOUNT_MISMATCH: "NIP07_ACCOUNT_MISMATCH",
};

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
