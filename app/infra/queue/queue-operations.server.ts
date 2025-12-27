/**
 * High-level queue operations
 * These functions provide a clean API for common queue operations
 */

import type { SignedEvent } from "~/features/nostr/types";

import { queueClient } from "./queue-client.server";
import type { PostJobData, LongFormPostJobData } from "./queue-types";
/**
 * Schedule a regular post to be published
 * @param postId - The post ID
 * @param userId - The user ID
 * @param signedEvent - The signed Nostr event
 * @param scheduledFor - Unix timestamp (in seconds) when the post should be published, or 0 for immediate
 */
export function enqueuePostJob(
  postId: string,
  userId: string,
  signedEvent: SignedEvent,
  scheduledFor: number,
): Promise<void> {
  // Handle immediate scheduling (delay: 0)
  const options = scheduledFor === 0 
    ? { delay: 0 }
    : { scheduledFor };

  const result = await queueClient.enqueue<PostJobData>(
    "scheduled-posts",
    "publish-post",
    { postId, userId, signedEvent },
    options,
  );

  if (!result.success) {
    throw new Error(result.error || "Failed to schedule post");
  }
}

/**
 * Cancel a scheduled post
 * @param postId - The post ID to cancel
 * @returns true if the job was found and cancelled, false otherwise
 */
export function cancelPostJob(postId: string): Promise<boolean> {
  return queueClient.cancelByData("scheduled-posts", "postId", postId);
}

/**
 * Schedule a longform post to be published
 * @param postId - The longform post ID
 * @param userId - The user ID
 * @param signedEvent - The signed Nostr event
 * @param scheduledFor - Unix timestamp (in seconds) when the post should be published, or 0 for immediate
 */
export function enqueueLongFormPostJob(
  postId: string,
  userId: string,
  signedEvent: SignedEvent,
  scheduledFor: number,
): Promise<void> {
  // Handle immediate scheduling (delay: 0)
  const options = scheduledFor === 0 
    ? { delay: 0 }
    : { scheduledFor };

  const result = await queueClient.enqueue<LongFormPostJobData>(
    "scheduled-longform-posts",
    "publish-longform-post",
    { postId, userId, signedEvent },
    options,
  );

  if (!result.success) {
    throw new Error(result.error || "Failed to schedule longform post");
  }
}

/**
 * Cancel a scheduled longform post
 * @param postId - The longform post ID to cancel
 * @returns true if the job was found and cancelled, false otherwise
 */
export function cancelLongFormPostJob(postId: string): Promise<boolean> {
  return queueClient.cancelByData("scheduled-longform-posts", "postId", postId);
}

/**
 * Enqueue a post checker job (for cron-like recurring jobs)
 * @param delay - Delay in milliseconds before processing
 */
export async function enqueuePostCheckerJob(delay = 0): Promise<void> {
  const result = await queueClient.enqueue<PostJobData>(
    "post-checker",
    "check-due-posts",
    { postId: "", userId: "", signedEvent: { id: "", pubkey: "", created_at: 0, kind: 0, tags: [], content: "", sig: "" } },
    { delay },
  );

  if (!result.success) {
    throw new Error(result.error || "Failed to enqueue post checker job");
  }
}

