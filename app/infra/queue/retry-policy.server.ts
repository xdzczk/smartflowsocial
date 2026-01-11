/**
 * Retry Policy Configuration
 *
 * Defines retry policies for different job types with exponential backoff and jitter.
 */

import { isRetryableErrorEnhanced } from "~/lib/error-classification.server";

import type { QueueType } from "./queue-types";

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;

  /**
   * Base delay in milliseconds for exponential backoff
   */
  baseDelayMs: number;

  /**
   * Maximum delay in milliseconds (cap for exponential backoff)
   */
  maxDelayMs: number;

  /**
   * Multiplier for exponential backoff (e.g., 2 for doubling each attempt)
   */
  multiplier: number;

  /**
   * Whether to add jitter to prevent thundering herd
   */
  useJitter: boolean;

  /**
   * Jitter percentage (0-1), e.g., 0.1 = ±10% random variation
   */
  jitterFactor: number;
}

/**
 * Default retry policy
 */
const _DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  multiplier: 2,
  useJitter: true,
  jitterFactor: 0.1, // ±10%
};

/**
 * Retry policies per queue type
 */
const RETRY_POLICIES: Record<QueueType, RetryPolicy> = {
  "scheduled-posts": {
    maxAttempts: 5, // More attempts for scheduled posts
    baseDelayMs: 2000, // 2 seconds
    maxDelayMs: 60000, // 1 minute
    multiplier: 2,
    useJitter: true,
    jitterFactor: 0.15, // ±15%
  },
  "scheduled-longform-posts": {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    multiplier: 2,
    useJitter: true,
    jitterFactor: 0.15,
  },
  "post-checker": {
    maxAttempts: 2, // Fewer attempts for checker jobs
    baseDelayMs: 5000, // 5 seconds
    maxDelayMs: 30000,
    multiplier: 2,
    useJitter: true,
    jitterFactor: 0.1,
  },
};

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy
): number {
  // Calculate exponential delay: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = Math.min(
    policy.baseDelayMs * Math.pow(policy.multiplier, attempt),
    policy.maxDelayMs
  );

  // Add jitter if enabled
  if (policy.useJitter) {
    const jitterRange = exponentialDelay * policy.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // ±jitterRange
    return Math.max(0, Math.floor(exponentialDelay + jitter));
  }

  return Math.floor(exponentialDelay);
}

/**
 * Get retry policy for a queue type
 */
export function getRetryPolicy(queueType: QueueType): RetryPolicy {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Safety fallback for unknown queue types
  return RETRY_POLICIES[queueType] ?? _DEFAULT_RETRY_POLICY;
}

/**
 * Check if a job should be retried based on attempt count
 */
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt < policy.maxAttempts;
}

/**
 * Get retry delay for a specific attempt
 */
export function getRetryDelay(queueType: QueueType, attempt: number): number {
  const policy = getRetryPolicy(queueType);
  return calculateRetryDelay(attempt, policy);
}

/**
 * Check if error is retryable
 * Some errors should not be retried (e.g., validation errors)
 *
 * @deprecated Use isRetryableErrorEnhanced from error-classification.server.ts instead
 * This function is kept for backward compatibility
 */
export function isRetryableError(error: Error): boolean {
  // Use enhanced classification if available
  try {
    return isRetryableErrorEnhanced(error);
  } catch {
    // Fallback to simple pattern matching if classification fails
    const errorMessage = error.message.toLowerCase();

    // Non-retryable errors
    const nonRetryablePatterns = [
      "not found",
      "unauthorized",
      "forbidden",
      "validation",
      "invalid",
      "already posted",
      "already published",
    ];

    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }

    // Retryable errors (network, temporary failures)
    const retryablePatterns = [
      "timeout",
      "network",
      "connection",
      "econnrefused",
      "etimedout",
      "eai_again",
      "temporary",
      "503",
      "502",
      "504",
    ];

    for (const pattern of retryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return true;
      }
    }

    // Default: retryable (conservative approach)
    return true;
  }
}

/**
 * Get BullMQ retry configuration from policy
 */
export function getBullMQRetryConfig(queueType: QueueType): {
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
} {
  const policy = getRetryPolicy(queueType);
  return {
    attempts: policy.maxAttempts,
    backoff: {
      type: "exponential",
      delay: policy.baseDelayMs,
    },
  };
}
