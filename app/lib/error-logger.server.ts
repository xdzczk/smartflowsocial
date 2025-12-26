/**
 * Error Logging Service
 * 
 * Centralized error logging with different log levels and structured output
 */

import type { AppError } from "./errors";
import { recordErrorMetric } from "./error-metrics.server";
import { sanitizeObject, sanitizeError } from "./secrets-sanitizer.server";
import { captureException } from "./sentry.server";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  includeStack?: boolean;
  [key: string]: unknown;
}

/**
 * Structured error log entry
 */
interface ErrorLogEntry {
  timestamp: string;
  level: LogLevel;
  error: {
    name: string;
    message: string;
    code: string;
    statusCode: number;
    isOperational: boolean;
    stack?: string;
    context?: Record<string, unknown>;
  };
  request?: {
    method?: string;
    path?: string;
    userAgent?: string;
    ip?: string;
  };
  user?: {
    id?: string;
  };
  environment: string;
}

/**
 * Log an error with structured output
 * Automatically sanitizes sensitive data (NWC strings, secrets, etc.)
 */
export function logError(
  error: AppError | Error,
  context: LogContext = {},
): void {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    error: {
      name: error.name,
      message: error.message,
      code: isAppError(error) ? error.code : "UNKNOWN_ERROR",
      statusCode: isAppError(error) ? error.statusCode : 500,
      isOperational: isAppError(error) ? error.isOperational : false,
      ...(context.includeStack && error.stack && { stack: error.stack }),
      ...(isAppError(error) && error.context && { context: error.context }),
    },
    ...(context.method && {
      request: {
        method: context.method,
        path: context.path,
        userAgent: context.userAgent,
        ip: context.ip,
      },
    }),
    ...(context.userId && {
      user: {
        id: context.userId,
      },
    }),
    environment: process.env.NODE_ENV || "development",
  };

  // Sanitize log entry to prevent secrets from appearing in logs
  const sanitizedError = sanitizeError(error);
  const sanitizedLogEntry = sanitizeObject({
    ...logEntry,
    error: {
      ...logEntry.error,
      message: sanitizedError.message,
      stack: sanitizedError.stack,
    },
  });

  // In production, you might want to send to an external service
  // For now, we'll use structured console logging
  if (process.env.NODE_ENV === "production") {
    // In production, log as JSON for log aggregation services
    console.error(JSON.stringify(sanitizedLogEntry));
  } else {
    // In development, use more readable format
    console.error("\n❌ Error:", {
      message: sanitizedError.message,
      code: logEntry.error.code,
      statusCode: logEntry.error.statusCode,
      path: logEntry.request?.path,
      method: logEntry.request?.method,
      userId: logEntry.user?.id,
      ...(context.includeStack && sanitizedError.stack && { stack: sanitizedError.stack }),
    });
  }

  // Record error in metrics
  if (isAppError(error)) {
    recordErrorMetric(error);
  }

  // Send to Sentry if configured
  captureException(sanitizedError, {
    tags: {
      code: isAppError(error) ? error.code : "UNKNOWN_ERROR",
      statusCode: String(logEntry.error.statusCode),
      isOperational: String(logEntry.error.isOperational),
    },
    extra: {
      ...sanitizedLogEntry,
      // Include sanitized context
      context: sanitizedLogEntry.request || sanitizedLogEntry.user || {},
    },
    user: context.userId ? { id: context.userId } : undefined,
    level: logEntry.error.isOperational ? "warning" : "error",
  });
}

/**
 * Log a warning
 */
export function logWarning(
  message: string,
  context: LogContext = {},
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "warn" as LogLevel,
    message,
    ...context,
    environment: process.env.NODE_ENV || "development",
  };

  if (process.env.NODE_ENV === "production") {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.warn("⚠️  Warning:", message, context);
  }
}

/**
 * Log info
 */
export function logInfo(
  message: string,
  context: LogContext = {},
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "info" as LogLevel,
    message,
    ...context,
    environment: process.env.NODE_ENV || "development",
  };

  if (process.env.NODE_ENV === "production") {
    console.info(JSON.stringify(logEntry));
  } else {
    console.info("ℹ️  Info:", message, context);
  }
}

/**
 * Type guard for AppError
 */
function isAppError(error: AppError | Error): error is AppError {
  return "code" in error && "statusCode" in error;
}

