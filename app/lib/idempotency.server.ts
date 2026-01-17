/**
 * Idempotency Key Generation
 *
 * Generates deterministic idempotency keys for post creation and job enqueueing
 * to prevent duplicate operations from retries or race conditions.
 */

import { createHash } from "crypto";

/**
 * Generate a deterministic idempotency key for post creation
 * @param userId - The user ID
 * @param content - The post content
 * @param scheduledFor - Optional scheduled timestamp (Unix seconds)
 * @returns SHA-256 hash of the input
 */
export function generateCreationIdempotencyKey(
  userId: string,
  content: string,
  scheduledFor?: number
): string {
  const input = `${userId}:${content}:${scheduledFor ?? "now"}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a deterministic idempotency key for job enqueueing
 * @param postId - The post ID
 * @param scheduledFor - Scheduled timestamp (Unix seconds)
 * @returns SHA-256 hash of the input
 */
export function generateEnqueueIdempotencyKey(
  postId: string,
  scheduledFor: number
): string {
  const input = `${postId}:${scheduledFor}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a deterministic idempotency key for a publish attempt
 *
 * This is a first-class idempotency concept for publish attempts.
 * Each publish attempt gets a unique ID that can be used to:
 * - Prevent duplicate publishes if worker crashes mid-publish
 * - Track which attempt succeeded
 * - Provide idempotency guarantees for horizontal scaling
 *
 * @param postId - The post ID
 * @param scheduledFor - Scheduled timestamp (Unix seconds) - the scheduled window
 * @param attemptNumber - Optional attempt number (for retries)
 * @returns SHA-256 hash of the input
 */
export function generatePublishAttemptId(
  postId: string,
  scheduledFor: number,
  attemptNumber = 0
): string {
  // Include postId, scheduled window, and attempt number
  // This ensures each publish attempt has a unique ID
  const input = `publish:${postId}:${scheduledFor}:${attemptNumber}`;
  return createHash("sha256").update(input).digest("hex");
}
