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
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
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
  constructor(
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 400, "VALIDATION_ERROR", true, context);
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(
    message = "Authentication required",
    context?: Record<string, unknown>,
  ) {
    super(message, 401, "AUTHENTICATION_ERROR", true, context);
  }
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(
    message = "Insufficient permissions",
    context?: Record<string, unknown>,
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
    context?: Record<string, unknown>,
  ) {
    super(message, 404, "NOT_FOUND_ERROR", true, context);
  }
}

/**
 * Conflict errors (409)
 */
export class ConflictError extends AppError {
  constructor(
    message = "Resource conflict",
    context?: Record<string, unknown>,
  ) {
    super(message, 409, "CONFLICT_ERROR", true, context);
  }
}

/**
 * Rate limit errors (429)
 */
export class RateLimitError extends AppError {
  constructor(
    message = "Rate limit exceeded",
    context?: Record<string, unknown>,
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
    context?: Record<string, unknown>,
  ) {
    super(
      message,
      statusCode,
      "EXTERNAL_SERVICE_ERROR",
      true,
      context,
    );
  }
}

/**
 * Database errors (500)
 */
export class DatabaseError extends AppError {
  constructor(
    message = "Database operation failed",
    context?: Record<string, unknown>,
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
    // Check for common Prisma errors
    if (error.message.includes("Unique constraint")) {
      return new ConflictError(
        "A record with this information already exists",
        { originalError: error.message },
      );
    }

    if (error.message.includes("Record to update not found")) {
      return new NotFoundError("The record you're trying to update doesn't exist", {
        originalError: error.message,
      });
    }

    // Generic error
    return new AppError(
      error.message || "An unexpected error occurred",
      500,
      "INTERNAL_ERROR",
      false,
      { originalError: error.message },
    );
  }

  // Unknown error type
  return new AppError(
    "An unexpected error occurred",
    500,
    "UNKNOWN_ERROR",
    false,
    { originalError: String(error) },
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  // Don't expose internal errors to users in production
  if (!error.isOperational && process.env.NODE_ENV === "production") {
    return "An unexpected error occurred. Please try again later.";
  }

  return error.message;
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
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];








