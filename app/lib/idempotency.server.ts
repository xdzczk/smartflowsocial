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
