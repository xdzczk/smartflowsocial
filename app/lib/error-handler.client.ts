/**
 * Client-side Error Handling Utilities
 * 
 * Provides standardized error handling for client-side code
 */

import { toast } from "react-hot-toast";
import type { ErrorResponse } from "./error-handler.server";
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
export function logClientError(
  error: Error | string,
  context?: ClientErrorContext,
  level: ClientErrorLevel = "error",
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: errorMessage,
    ...(errorStack && { stack: errorStack }),
    ...(context && { context }),
    environment: typeof window !== "undefined" ? window.location.href : "unknown",
  };

  if (process.env.NODE_ENV === "production") {
    // In production, log as JSON for log aggregation
    console.error(JSON.stringify(logEntry));
  } else {
    // In development, use readable format
    const emoji = level === "error" ? "❌" : level === "warning" ? "⚠️" : "ℹ️";
    console[level === "error" ? "error" : level === "warning" ? "warn" : "info"](
      `${emoji} [CLIENT ${level.toUpperCase()}]`,
      errorMessage,
      context || "",
    );
    if (errorStack && level === "error") {
      console.error("Stack:", errorStack);
    }
  }

  // Send to Sentry if configured
  if (error instanceof Error) {
    captureException(error, {
      tags: {
        level,
        component: context?.component,
        action: context?.action,
      },
      extra: context,
      user: context?.userId ? { id: context.userId } : undefined,
      level: level === "error" ? "error" : level === "warning" ? "warning" : "info",
    });
  }
}

/**
 * Handle API error responses
 * Extracts error message from standardized error response format
 */
export function handleApiError(
  response: Response | { error?: ErrorResponse["error"]; success?: boolean },
): string {
  // Handle Response object
  if (response instanceof Response) {
    // Try to parse JSON error response
    return response.statusText || `HTTP ${response.status} Error`;
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
    position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  },
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
 * Handle error in async operations with logging and user notification
 */
export function handleAsyncError(
  error: unknown,
  context?: ClientErrorContext,
  showToast = true,
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

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
  showToast = true,
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
  fallback?: () => void,
): void {
  try {
    handleAsyncError(error, context, false);
    if (fallback) {
      fallback();
    }
  } catch (handlingError) {
    // Even error handling can fail, so we catch it
    console.error("Error in error handler:", handlingError);
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





