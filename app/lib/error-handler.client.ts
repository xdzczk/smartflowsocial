/**
 * Client-side Error Handling Utilities
 *
 * Provides standardized error handling for client-side code
 */

import { toast } from "react-hot-toast";

import type { ErrorResponse } from "./error-handler.server";
import {
  safeConsoleError,
  safeConsoleInfo,
  safeConsoleWarn,
} from "./safe-console.client";
import { captureException } from "./sentry.client";
export type ClientErrorLevel = "error" | "warning" | "info";

export interface ClientErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Client-side error logger
 * Logs errors to console with structured format
 */
// ============================================================================
// Helper Functions
// ============================================================================

function getErrorDetails(error: Error | string): {
  message: string;
  stack: string | undefined;
} {
  return {
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function buildLogEntry(
  errorMessage: string,
  errorStack: string | undefined,
  level: ClientErrorLevel,
  context: ClientErrorContext | undefined
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level,
    message: errorMessage,
    ...(errorStack && { stack: errorStack }),
    ...(context && { context }),
    environment:
      typeof window !== "undefined" ? String(window.location.href) : "unknown",
  };
}

function logToConsole(
  errorMessage: string,
  errorStack: string | undefined,
  level: ClientErrorLevel,
  context: ClientErrorContext | undefined
): void {
  const emoji = level === "error" ? "❌" : level === "warning" ? "⚠️" : "ℹ️";
  const prefix = `${emoji} [CLIENT ${level.toUpperCase()}]`;
  const contextString = context ? String(context) : "";
  if (level === "error") {
    safeConsoleError(prefix, errorMessage, contextString);
  } else if (level === "warning") {
    safeConsoleWarn(prefix, errorMessage, contextString);
  } else {
    safeConsoleInfo(prefix, errorMessage, contextString);
  }
  if (errorStack && level === "error") {
    safeConsoleError("Stack:", errorStack);
  }
}

function buildSentryTags(
  level: ClientErrorLevel,
  context: ClientErrorContext | undefined
): Record<string, string> {
  const tags: Record<string, string> = { level };
  if (context?.component) {
    tags["component"] = String(context["component"]);
  }
  if (context?.action) {
    tags["action"] = String(context["action"]);
  }
  return tags;
}

function sendToSentry(
  error: Error,
  level: ClientErrorLevel,
  context: ClientErrorContext | undefined
): void {
  const tags = buildSentryTags(level, context);
  captureException(error, {
    tags,
    extra: context,
    user: context?.userId ? { id: context.userId } : undefined,
    level:
      level === "error" ? "error" : level === "warning" ? "warning" : "info",
  });
}

export function logClientError(
  error: Error | string,
  context?: ClientErrorContext,
  level: ClientErrorLevel = "error"
): void {
  const { message: errorMessage, stack: errorStack } = getErrorDetails(error);

  if (process.env.NODE_ENV === "production") {
    const logEntry = buildLogEntry(errorMessage, errorStack, level, context);
    safeConsoleError(JSON.stringify(logEntry));
  } else {
    logToConsole(errorMessage, errorStack, level, context);
  }

  if (error instanceof Error) {
    sendToSentry(error, level, context);
  }
}

/**
 * Handle API error responses
 * Extracts error message from standardized error response format
 */
export function handleApiError(
  response: Response | { error?: ErrorResponse["error"]; success?: boolean }
): string {
  // Handle Response object
  if (response instanceof Response) {
    // Try to parse JSON error response
    return response.statusText || `HTTP ${String(response.status)} Error`;
  }

  // Handle error response object
  if (response.error) {
    return response.error.message || "An error occurred";
  }

  return "An unexpected error occurred";
}

/**
 * Display error to user via toast notification
 */
export function showErrorToast(
  error: ErrorResponse["error"] | Error | string,
  options?: {
    duration?: number;
    position?:
      | "top-left"
      | "top-center"
      | "top-right"
      | "bottom-left"
      | "bottom-center"
      | "bottom-right";
  }
): void {
  let message: string;

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = error.message || "An error occurred";
  }

  toast.error(message, {
    duration: options?.duration ?? 5000,
    position: options?.position ?? "top-right",
  });
}

/**
 * Type guard to safely convert unknown to Error
 */

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Handle error in async operations with logging and user notification
 */
export function handleAsyncError(
  error: unknown,
  context?: ClientErrorContext,
  showToast = true
): void {
  const errorObj = toError(error);

  // Log the error
  logClientError(errorObj, context, "error");

  // Show toast to user
  if (showToast) {
    showErrorToast(errorObj.message);
  }
}

/**
 * Handle error in async operations with custom message
 */
export function handleAsyncErrorWithMessage(
  error: unknown,
  userMessage: string,
  context?: ClientErrorContext,
  showToast = true
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Log the error with original message
  logClientError(errorObj, context, "error");

  // Show custom message to user
  if (showToast) {
    showErrorToast(userMessage);
  }
}

/**
 * Safe error handler that doesn't throw
 * Useful for non-critical operations
 */
export function handleErrorSafely(
  error: unknown,
  context?: ClientErrorContext,
  fallback?: () => void
): void {
  try {
    handleAsyncError(error, context, false);
    if (fallback) {
      fallback();
    }
  } catch (handlingError) {
    // Even error handling can fail, so we catch it
    safeConsoleError("Error in error handler:", handlingError);
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "An unexpected error occurred";
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to fetch") ||
      error.name === "NetworkError" ||
      error.name === "TypeError"
    );
  }
  return false;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("timeout") ||
      error.message.includes("Timeout") ||
      error.name === "TimeoutError"
    );
  }
  return false;
}
