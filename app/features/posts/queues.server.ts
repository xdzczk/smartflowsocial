/**
 * Queue workers and initialization
 *
 * This file handles the worker processes that process queue jobs.
 * For enqueueing/canceling jobs, use the queue abstraction layer:
 *   import { enqueuePostJob, cancelPostJob } from "~/infra/queue";
 */

import type { Prisma } from "@prisma/client";
import { Worker } from "bullmq";
import type { Job } from "bullmq";

import type { SignedEvent } from "~/features/nostr/types";
import { getUserById } from "~/features/user";
import { getQueueInstance, redis, closeAllQueues } from "~/infra/queue";
import type { PostJobData, LongFormPostJobData } from "~/infra/queue";
import { env } from "~/lib/env.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import { prisma } from "~/lib/prisma.server";
import { recordJobMetrics, updateActiveJobs } from "~/lib/queue-metrics.server";
import {
  updateLongFormPostStatus,
  getCronDueScheduledLongFormPosts,
} from "~/models/longformpost.server";
import { updatePostStatus } from "~/models/post.commands.server";
import { getCronDueScheduledPosts } from "~/models/post.queries.server";

/**
 * Type guard to check if value is a SignedEvent
 */
function isSignedEvent(value: unknown): value is SignedEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "pubkey" in value &&
    "created_at" in value &&
    "kind" in value &&
    "tags" in value &&
    "content" in value &&
    "sig" in value
  );
}

/**
 * Convert Prisma JsonValue to SignedEvent if valid
 */
function toSignedEvent(
  value: Prisma.JsonValue | null | undefined
): SignedEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return isSignedEvent(value) ? value : null;
}

// Queue name constants

const QUEUE_SCHEDULED_POSTS = "scheduled-posts";

const QUEUE_SCHEDULED_LONGFORM_POSTS = "scheduled-longform-posts";
const QUEUE_POST_CHECKER = "post-checker";

// Get queue instances using the abstraction
const _scheduledPostsQueue = getQueueInstance(QUEUE_SCHEDULED_POSTS);
const _scheduledLongFormPostsQueue = getQueueInstance(
  QUEUE_SCHEDULED_LONGFORM_POSTS
);
const postCheckerQueue = getQueueInstance(QUEUE_POST_CHECKER);

// Worker to process scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  QUEUE_SCHEDULED_POSTS,
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent } = job.data;
    const startTime = Date.now();
    const queueName = QUEUE_SCHEDULED_POSTS;

    try {
      updateActiveJobs(queueName, 1);
      // Idempotency check: verify post exists and is not already posted
      const existingPost = await prisma.post.findUnique({
        where: { id: postId, userId },
        select: { isPosted: true, nostrEventId: true },
      });

      if (!existingPost) {
        throw new Error(`Post ${postId} not found for user ${userId}`);
      }

      // If already posted, skip processing (idempotency)
      if (existingPost.isPosted) {
        logInfo("Post already posted, skipping duplicate job", {
          postId,
          userId,
        });
        return { success: true, postId, skipped: true };
      }

      // Update post status to posted (atomic operation)
      await updatePostStatus({
        id: postId,
        userId: userId,
        isPosted: true,
      });

      // Get user relays
      const user = await getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      const userRelays =
        user && typeof user === "object" && "userRelays" in user
          ? user.userRelays
          : null;
      const relaysArray = Array.isArray(userRelays) ? userRelays : [];
      const sanitizedRelays = relaysArray.map((relay: unknown) => {
        const relayStr = typeof relay === "string" ? relay : String(relay);
        return relayStr.trim();
      });

      // Post to nostr publisher endpoint
      // Read directly from process.env to support test environment changes
      const publisherUrl =
        process.env["NOSTR_PUBLISHER_URL"] ?? env.NOSTR_PUBLISHER_URL;
      if (!publisherUrl) {
        throw new Error("NOSTR_PUBLISHER_URL environment variable is not set");
      }
      const response = await fetchWithRetry(publisherUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays: sanitizedRelays,
          event: signedEvent,
        }),
        timeout: 15000, // 15 seconds for publishing
        maxRetries: 2,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to post to nostr publisher: ${response.statusText}`
        );
      }

      const duration = Date.now() - startTime;
      recordJobMetrics(queueName, duration, true);
      updateActiveJobs(queueName, -1);
      return { success: true, postId };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      recordJobMetrics(queueName, duration, false, err);
      updateActiveJobs(queueName, -1);
      logError(err, {
        userId,
        postId,
        message: "Error processing scheduled post",
      });
      throw error;
    }
  },
  {
    connection: redis as unknown as { host: string; port: number },
    concurrency: 5,
  }
);

// Worker to process scheduled longform posts
export const scheduledLongFormPostsWorker = new Worker<LongFormPostJobData>(
  QUEUE_SCHEDULED_LONGFORM_POSTS,
  async (job: Job<LongFormPostJobData>) => {
    const { postId, userId, signedEvent } = job.data;
    const startTime = Date.now();
    const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;

    try {
      updateActiveJobs(queueName, 1);
      // Idempotency check: verify post exists and is not already published
      const existingPost = await prisma.longFormPost.findUnique({
        where: { id: postId, userId },
        select: { isPublished: true, nostrEventId: true },
      });

      if (!existingPost) {
        throw new Error(`Longform post ${postId} not found for user ${userId}`);
      }

      // If already published, skip processing (idempotency)
      if (existingPost.isPublished) {
        logInfo("Longform post already published, skipping duplicate job", {
          postId,
          userId,
        });
        return { success: true, postId, skipped: true };
      }

      // Update longform post status to published (atomic operation)
      await updateLongFormPostStatus({
        id: postId,
        userId: userId,
        isPublished: true,
      });

      // Get user relays
      const user = await getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      const userRelays =
        user && typeof user === "object" && "userRelays" in user
          ? user.userRelays
          : null;
      const relaysArray = Array.isArray(userRelays) ? userRelays : [];
      const sanitizedRelays = relaysArray.map((relay: unknown) => {
        const relayStr = typeof relay === "string" ? relay : String(relay);
        return relayStr.trim();
      });

      // Post to nostr publisher endpoint
      // Read directly from process.env to support test environment changes
      const publisherUrl =
        process.env["NOSTR_PUBLISHER_URL"] ?? env.NOSTR_PUBLISHER_URL;
      if (!publisherUrl) {
        throw new Error("NOSTR_PUBLISHER_URL environment variable is not set");
      }
      const response = await fetchWithRetry(publisherUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays: sanitizedRelays,
          event: signedEvent,
        }),
        timeout: 15000, // 15 seconds for publishing
        maxRetries: 2,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to post longform to nostr publisher: ${response.statusText}`
        );
      }

      const duration = Date.now() - startTime;
      recordJobMetrics(queueName, duration, true);
      updateActiveJobs(queueName, -1);
      return { success: true, postId };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      recordJobMetrics(queueName, duration, false, err);
      updateActiveJobs(queueName, -1);
      logError(err, {
        userId,
        postId,
        message: "Error processing scheduled longform post",
      });
      throw error;
    }
  },
  {
    connection: redis as unknown as { host: string; port: number },
    concurrency: 5,
  }
);

// Worker to check for due posts and schedule them
export const postCheckerWorker = new Worker(
  QUEUE_POST_CHECKER,
  async () => {
    try {
      const [posts, longformPosts] = await Promise.all([
        getCronDueScheduledPosts(),
        getCronDueScheduledLongFormPosts(),
      ]);
      const now = Math.floor(Date.now() / 1000);

      // Process regular posts
      for (const post of posts) {
        if (!post || typeof post !== "object") continue;
        const postId =
          "id" in post && typeof post.id === "string" ? post.id : null;
        const postUserId =
          "userId" in post && typeof post.userId === "string"
            ? post.userId
            : null;
        const postSignedEvent = "signedEvent" in post ? post.signedEvent : null;
        const postScheduledFor =
          "scheduledFor" in post && typeof post.scheduledFor === "string"
            ? post.scheduledFor
            : null;

        if (!postUserId || !postSignedEvent || !postScheduledFor || !postId)
          continue;

        const signedEvent = toSignedEvent(postSignedEvent);
        if (!signedEvent) continue;

        const scheduledTime = parseInt(postScheduledFor, 10);
        if (isNaN(scheduledTime)) continue;
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing using the abstraction
          const { enqueuePostJob } = await import("~/infra/queue");
          // Use 0 for immediate processing when timeDiff <= 1
          await enqueuePostJob(
            postId,
            postUserId,
            signedEvent,
            timeDiff <= 0 ? 0 : scheduledTime
          );
        }
      }

      // Process longform posts
      for (const longformPost of longformPosts) {
        if (!longformPost || typeof longformPost !== "object") continue;
        const longformPostId =
          "id" in longformPost && typeof longformPost.id === "string"
            ? longformPost.id
            : null;
        const longformPostUserId =
          "userId" in longformPost && typeof longformPost.userId === "string"
            ? longformPost.userId
            : null;
        const longformPostSignedEvent =
          "signedEvent" in longformPost ? longformPost.signedEvent : null;
        const longformPostScheduledFor =
          "scheduledFor" in longformPost &&
          typeof longformPost.scheduledFor === "string"
            ? longformPost.scheduledFor
            : null;

        if (
          !longformPostUserId ||
          !longformPostSignedEvent ||
          !longformPostScheduledFor ||
          !longformPostId
        )
          continue;

        const signedEvent = toSignedEvent(longformPostSignedEvent);
        if (!signedEvent) continue;

        const scheduledTime = parseInt(longformPostScheduledFor, 10);
        if (isNaN(scheduledTime)) continue;
        const timeDiff = scheduledTime - now;

        if (timeDiff <= 1) {
          // Schedule immediate processing using the abstraction
          const { enqueueLongFormPostJob } = await import("~/infra/queue");
          // Use 0 for immediate processing when timeDiff <= 1
          await enqueueLongFormPostJob(
            longformPostId,
            longformPostUserId,
            signedEvent,
            timeDiff <= 0 ? 0 : scheduledTime
          );
        }
      }

      return { processed: posts.length + longformPosts.length };
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error checking scheduled posts",
      });
      throw error;
    }
  },
  {
    connection: redis as unknown as { host: string; port: number },
    concurrency: 1,
  }
);

// Start the recurring job to check for due posts every minute
async function startPostChecker() {
  // Set up recurring job directly (recurring jobs need direct queue access)
  await postCheckerQueue.add(
    "check-due-posts",
    {},
    {
      repeat: { every: 60000 }, // Every 60 seconds
      removeOnComplete: 1,
      removeOnFail: 1,
    }
  );
}

// Initialize the post checker
void (async () => {
  try {
    await startPostChecker();
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error starting post checker",
    });
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  void (async () => {
    await scheduledPostsWorker.close();
    await scheduledLongFormPostsWorker.close();
    await postCheckerWorker.close();
    await closeAllQueues();
  })();
});

process.on("SIGINT", () => {
  void (async () => {
    await scheduledPostsWorker.close();
    await scheduledLongFormPostsWorker.close();
    await postCheckerWorker.close();
    await closeAllQueues();
  })();
});

// Re-export queue operations for backward compatibility during migration
// These will be removed once all imports are updated
export {
  enqueuePostJob as schedulePost,
  cancelPostJob as cancelScheduledPost,
  enqueueLongFormPostJob as scheduleLongFormPost,
  cancelLongFormPostJob as cancelScheduledLongFormPost,
} from "~/infra/queue";
