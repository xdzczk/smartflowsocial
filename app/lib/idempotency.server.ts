/**
 * Idempotency Key Generation
 *
 * Generates deterministic idempotency keys for post creation and job enqueueing
 * to prevent duplicate operations from retries or race conditions.
 */

import { createHash } from "crypto";

/**
 * Generate a deterministic idempotency key for post creation.
 * Include mediaKey when the post has media (e.g. image URLs) so that different
 * media with the same caption produce different posts (e.g. multiple image-only posts with no caption).
 *
 * NOTE: This content-hash form has no time component for immediate publishes
 * (`scheduledFor` undefined collapses to the literal "now"), so two unrelated
 * publish attempts of the same exact content will collide forever — across
 * sessions, cold restarts, etc. Prefer {@link generateSubmissionIdempotencyKey}
 * when the client can supply a per-attempt submission id; fall back to this
 * helper only for legacy clients that do not yet send `submissionId`.
 *
 * @param userId - The user ID
 * @param content - The post content (caption for media posts)
 * @param scheduledFor - Optional scheduled timestamp (Unix seconds)
 * @param mediaKey - Optional stable key for media (e.g. sorted fileUrl array joined); omit for text-only
 */
export function generateCreationIdempotencyKey(
  userId: string,
  content: string,
  scheduledFor?: number,
  mediaKey?: string
): string {
  const media = mediaKey != null && mediaKey !== "" ? mediaKey : "";
  const input = `${userId}:${content}:${scheduledFor ?? "now"}:${media}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a deterministic idempotency key from a client-generated submission
 * id. Each composer publish attempt gets a stable uuid (kept across retries
 * and signer-reconnect resumes). Two separate user clicks always have distinct
 * submission ids, so re-publishing the same content from a new session creates
 * a fresh Post instead of silently matching a historical one.
 *
 * The "submission:" prefix isolates this key namespace from the legacy
 * content-hash keys, so the two schemes can coexist on the same column during
 * rollout without ever colliding by accident.
 */
export function generateSubmissionIdempotencyKey(submissionId: string): string {
  if (!submissionId || typeof submissionId !== "string") {
    throw new Error(
      "generateSubmissionIdempotencyKey requires a non-empty submissionId"
    );
  }
  return createHash("sha256")
    .update(`submission:${submissionId}`)
    .digest("hex");
}

/**
 * Generate a deterministic idempotency key for job enqueueing
 * @param postId - The post ID
 * @param scheduledFor - Scheduled timestamp (Unix seconds)
 * @param nostrEventId - When set (e.g. signed Nostr event id), included so re-signing
 *   the same slot produces a distinct key and concurrent duplicate submits dedupe safely.
 * @returns SHA-256 hash of the input
 */
export function generateEnqueueIdempotencyKey(
  postId: string,
  scheduledFor: number,
  nostrEventId?: string
): string {
  const input =
    nostrEventId != null && nostrEventId !== ""
      ? `${postId}:${scheduledFor}:${nostrEventId}`
      : `${postId}:${scheduledFor}`;
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
