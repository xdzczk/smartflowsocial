/**
 * Queue workers and initialization
 *
 * This file handles the worker processes that process queue jobs.
 * For enqueueing/canceling jobs, use the queue abstraction layer:
 *   import { enqueuePostJob, cancelPostJob } from "~/infra/queue";
 */

import type { Prisma } from "@prisma/client";
import { Worker, type Job } from "bullmq";

import type { SignedEvent } from "~/features/nostr/types";
import { getUserById } from "~/features/user";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
import { getQueueInstance, redis, closeAllQueues } from "~/infra/queue";
import type { PostJobData, LongFormPostJobData } from "~/infra/queue";
import { createDeadLetterEntry } from "~/infra/queue/dead-letter-queue.server";
import {
  isRetryableError,
  shouldRetry,
  getRetryPolicy,
} from "~/infra/queue/retry-policy.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { recordJobMetrics, updateActiveJobs } from "~/lib/queue-metrics.server";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";
import {
  updateLongFormPostStatus,
  getCronDueScheduledLongFormPosts,
} from "~/models/longformpost.server";
import { updatePostStatus } from "~/models/post.commands.server";
import { getCronDueScheduledPosts } from "~/models/post.queries.server";

// ============================================================================
// Helper Functions for Queue Processing
// ============================================================================

interface PostData {
  id: string;
  userId: string;
  signedEvent: Prisma.JsonValue;
  scheduledFor: string;
}

function extractPostData(post: unknown): PostData | null {
  if (typeof post !== "object" || post === null) {
    return null;
  }

  const postId = "id" in post && typeof post.id === "string" ? post.id : null;
  const postUserId =
    "userId" in post && typeof post.userId === "string" ? post.userId : null;
  const postSignedEvent = "signedEvent" in post ? post.signedEvent : null;
  const postScheduledFor =
    "scheduledFor" in post && typeof post.scheduledFor === "string"
      ? post.scheduledFor
      : null;

  if (!postUserId || !postSignedEvent || !postScheduledFor || !postId) {
    return null;
  }

  return {
    id: postId,
    userId: postUserId,
    signedEvent: postSignedEvent,
    scheduledFor: postScheduledFor,
  };
}

async function processPost(postData: PostData, now: number): Promise<boolean> {
  const signedEvent = toSignedEvent(postData.signedEvent);
  if (!signedEvent) {
    return false;
  }

  const scheduledTime = parseInt(postData.scheduledFor, 10);
  if (isNaN(scheduledTime)) {
    return false;
  }

  const timeDiff = scheduledTime - now;
  if (timeDiff <= 1) {
    const { enqueuePostJob } = await import("~/infra/queue");
    await enqueuePostJob(
      postData.id,
      postData.userId,
      signedEvent,
      timeDiff <= 0 ? 0 : scheduledTime
    );
    return true;
  }

  return false;
}

async function processLongFormPost(
  postData: PostData,
  now: number
): Promise<boolean> {
  const signedEvent = toSignedEvent(postData.signedEvent);
  if (!signedEvent) {
    return false;
  }

  const scheduledTime = parseInt(postData.scheduledFor, 10);
  if (isNaN(scheduledTime)) {
    return false;
  }

  const timeDiff = scheduledTime - now;
  if (timeDiff <= 1) {
    const { enqueueLongFormPostJob } = await import("~/infra/queue");
    await enqueueLongFormPostJob(
      postData.id,
      postData.userId,
      signedEvent,
      timeDiff <= 0 ? 0 : scheduledTime
    );
    return true;
  }

  return false;
}

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

// Import state machine
import { PostStateMachine } from "./state-machine/post-state-machine.server";

// Worker to process scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  QUEUE_SCHEDULED_POSTS,
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent, correlationId } = job.data;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "queues.server.ts:scheduledPostsWorker",
        message: "Processing scheduled post job",
        data: { postId, userId, jobId: job.id },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "A",
      }),
    }).catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
    // #endregion
    const startTime = Date.now();
    const queueName = QUEUE_SCHEDULED_POSTS;
    const stateMachine = new PostStateMachine();

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
          correlationId,
        });
        return { success: true, postId, skipped: true };
      }

      // Transition to PUBLISHING
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHING",
        "Job started processing"
      );

      // Cryptographically validate the signed event before publishing
      // This ensures the event signature and ID are valid
      const validatedSignedEvent =
        validateSignedEventCryptographically(signedEvent);

      // Get user relays
      const user = await getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      const userRelays =
        typeof user === "object" && "userRelays" in user
          ? user.userRelays
          : null;
      const relaysArray = Array.isArray(userRelays) ? userRelays : [];
      const sanitizedRelays = relaysArray.map((relay: unknown) => {
        const relayStr = typeof relay === "string" ? relay : String(relay);
        return relayStr.trim();
      });

      // Publish to Nostr using publisher service (with health-aware routing)
      const publishStartTime = Date.now();
      const publisher = getNostrPublisher();
      await publisher.publish(
        validatedSignedEvent,
        sanitizedRelays,
        correlationId
      );
      const publishLatency = Date.now() - publishStartTime;

      // Update post status to posted (atomic operation)
      await updatePostStatus({
        id: postId,
        userId: userId,
        isPosted: true,
      });

      // Transition to PUBLISHED
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHED",
        "Successfully published to Nostr"
      );

      const duration = Date.now() - startTime;
      recordJobMetrics(queueName, duration, true);
      updateActiveJobs(queueName, -1);

      // Record business metrics
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { postType: true },
      });
      if (post) {
        recordPostPublished(post.postType, "scheduled");
        recordPublishLatency(post.postType, "scheduled", publishLatency);
      }

      logInfo("Post published successfully from queue", {
        postId,
        userId,
        correlationId,
      });
      return { success: true, postId };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = err.constructor.name;
      const attemptsMade = job.attemptsMade + 1;
      const policy = getRetryPolicy(queueName);

      // Check if we should retry
      const willRetry =
        shouldRetry(attemptsMade, policy) && isRetryableError(err);

      // Transition to FAILED
      try {
        await stateMachine.transition(
          postId,
          userId,
          "FAILED",
          `Publish failed: ${err.message}`
        );
      } catch (stateError) {
        // Log but don't fail the job if state transition fails
        logError(
          stateError instanceof Error
            ? stateError
            : new Error(String(stateError)),
          {
            postId,
            userId,
            correlationId,
            message: "Failed to transition post to FAILED state",
          }
        );
      }

      recordJobMetrics(queueName, duration, false, err);
      updateActiveJobs(queueName, -1);

      // Record business metrics
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { postType: true },
      });
      if (post) {
        recordPostPublishFailed(post.postType, "scheduled", errorType);
      }

      // If we've exhausted retries or error is not retryable, move to dead letter queue
      if (!willRetry) {
        await createDeadLetterEntry(
          queueName,
          job.id ?? "unknown",
          "publish-post",
          job.data,
          err,
          attemptsMade,
          correlationId
        );
      }

      logError(err, {
        userId,
        postId,
        message: "Error processing scheduled post",
        correlationId,
        attemptsMade,
        willRetry,
      });
      throw error;
    }
  },
  {
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
    concurrency: 5,
  }
);

// Worker to process scheduled longform posts
export const scheduledLongFormPostsWorker = new Worker<LongFormPostJobData>(
  QUEUE_SCHEDULED_LONGFORM_POSTS,
  async (job: Job<LongFormPostJobData>) => {
    const { postId, userId, signedEvent, correlationId } = job.data;
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
          correlationId,
        });
        return { success: true, postId, skipped: true };
      }

      // Cryptographically validate the signed event before publishing
      // This ensures the event signature and ID are valid
      const validatedSignedEvent =
        validateSignedEventCryptographically(signedEvent);

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
        typeof user === "object" && "userRelays" in user
          ? user.userRelays
          : null;
      const relaysArray = Array.isArray(userRelays) ? userRelays : [];
      const sanitizedRelays = relaysArray.map((relay: unknown) => {
        const relayStr = typeof relay === "string" ? relay : String(relay);
        return relayStr.trim();
      });

      // Publish to Nostr using publisher service (with health-aware routing)
      const publisher = getNostrPublisher();
      await publisher.publish(
        validatedSignedEvent,
        sanitizedRelays,
        correlationId
      );

      const duration = Date.now() - startTime;
      recordJobMetrics(queueName, duration, true);
      updateActiveJobs(queueName, -1);
      logInfo("Longform post published successfully from queue", {
        postId,
        userId,
        correlationId,
      });
      return { success: true, postId };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      const attemptsMade = job.attemptsMade + 1;
      const policy = getRetryPolicy(queueName);

      // Check if we should retry
      const willRetry =
        shouldRetry(attemptsMade, policy) && isRetryableError(err);

      recordJobMetrics(queueName, duration, false, err);
      updateActiveJobs(queueName, -1);

      // If we've exhausted retries or error is not retryable, move to dead letter queue
      if (!willRetry) {
        await createDeadLetterEntry(
          queueName,
          job.id ?? "unknown",
          "publish-longform-post",
          job.data,
          err,
          attemptsMade,
          correlationId
        );
      }

      logError(err, {
        userId,
        postId,
        message: "Error processing scheduled longform post",
        correlationId,
        attemptsMade,
        willRetry,
      });
      throw error;
    }
  },
  {
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
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
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "queues.server.ts:postCheckerWorker",
            message: "Due posts found",
            data: {
              postsCount: posts.length,
              longformCount: longformPosts.length,
              postIds: posts.map((p) => p.id),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
      // #endregion
      const now = Math.floor(Date.now() / 1000);

      // Process regular posts
      for (const post of posts) {
        const postData = extractPostData(post);
        if (postData) {
          await processPost(postData, now);
        }
      }

      // Process longform posts
      for (const longformPost of longformPosts) {
        const postData = extractPostData(longformPost);
        if (postData) {
          await processLongFormPost(postData, now);
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
    // BullMQ accepts ioredis instances at runtime, but TypeScript types don't reflect this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- BullMQ runtime accepts ioredis instance
    connection: redis as any,
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
