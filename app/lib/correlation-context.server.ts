/**
 * Correlation Context
 *
 * Manages correlation IDs for request tracking across the application.
 * Correlation IDs help trace requests through multiple services and operations.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Get or create a correlation ID
 *
 * If a correlation ID is provided, use it. Otherwise, generate a new one.
 * This allows correlation IDs to be passed through the call chain.
 */
export function getCorrelationId(existingId?: string): string {
  return existingId ?? uuidv4();
}

/**
 * Correlation context for operations
 */
export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  postId?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Create a correlation context
 */
export function createCorrelationContext(
  existingId?: string,
  additionalContext?: Record<string, unknown>
): CorrelationContext {
  return {
    correlationId: getCorrelationId(existingId),
    ...additionalContext,
  };
}

/**
 * Extract correlation ID from headers or context
 */
export function extractCorrelationId(
  headers: Headers | Record<string, string | null>
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get("X-Correlation-Id") ?? undefined;
  }
  return headers["X-Correlation-Id"] ?? headers["x-correlation-id"] ?? undefined;
}
