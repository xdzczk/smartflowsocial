/**
 * Progressive Timeout Utilities
 *
 * Provides adaptive timeout strategies that reduce timeout duration
 * on retries to fail faster and provide better user experience.
 */

/**
 * Calculate progressive timeout based on retry count
 *
 * @param retryCount - Current retry attempt (0 = first attempt)
 * @param baseTimeout - Base timeout in milliseconds (used for first attempt)
 * @returns Timeout in milliseconds
 *
 * @example
 * // First attempt: 120s
 * getProgressiveTimeout(0, 120000) // 120000
 *
 * // Second attempt: 60s
 * getProgressiveTimeout(1, 120000) // 60000
 *
 * // Third attempt: 30s
 * getProgressiveTimeout(2, 120000) // 30000
 */
export function getProgressiveTimeout(
  retryCount: number,
  baseTimeout: number
): number {
  if (retryCount === 0) {
    return baseTimeout;
  }

  // Progressive reduction: 50% for each retry
  // Attempt 1: 100% (baseTimeout)
  // Attempt 2: 50% (baseTimeout / 2)
  // Attempt 3: 25% (baseTimeout / 4)
  // Minimum: 10 seconds
  const timeout = baseTimeout / Math.pow(2, retryCount);
  return Math.max(timeout, 10_000); // Minimum 10 seconds
}

/**
 * Get maximum retry attempts for a given operation
 */
export function getMaxRetries(operation: "connection" | "sign"): number {
  return operation === "connection" ? 3 : 2;
}
