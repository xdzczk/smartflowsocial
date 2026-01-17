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
import { LongFormPostStateMachine } from "~/features/posts/state-machine/longform-post-state-machine.server";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
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
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import {
  recordPostPublished,
  recordPostPublishFailed,
} from "~/lib/metrics/business-metrics.server";
import { recordPublishLatency } from "~/lib/metrics/performance-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { recordJobMetrics, updateActiveJobs } from "~/lib/queue-metrics.server";
import { fromPrismaDate, nowMillis, toUnixTimestamp } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";
import { getCronDueScheduledLongFormPosts } from "~/models/longformpost.server";
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

/**
 * Extract scheduledFor value from post object, handling both legacy and new fields
 */
async function extractScheduledFor(
  post: Record<string, unknown>
): Promise<string | null> {
  // Prefer scheduledAtUtc (newer field), fall back to scheduledFor
  if ("scheduledAtUtc" in post && post["scheduledAtUtc"] instanceof Date) {
    return Math.floor(post["scheduledAtUtc"].getTime() / 1000).toString();
  }

  if (!("scheduledFor" in post)) {
    return null;
  }

  const scheduledForValue = post["scheduledFor"];
  if (scheduledForValue instanceof Date) {
    return Math.floor(scheduledForValue.getTime() / 1000).toString();
  }

  if (typeof scheduledForValue !== "string") {
    return null;
  }

  // Check if it's a Unix timestamp (all digits) or a Date string
  if (/^\d+$/.test(scheduledForValue)) {
    return scheduledForValue;
  }

  // It's a Date string, parse it using Temporal for 100% consistency
  try {
    const { fromISOString, toUnixTimestamp } = await import("~/lib/temporal");
    const zonedDateTime = fromISOString(scheduledForValue, "UTC");
    return String(toUnixTimestamp(zonedDateTime));
  } catch {
    // Fallback - try with Date conversion
    try {
      const { fromDate, toUnixTimestamp } = await import("~/lib/temporal");
      const date = new Date(scheduledForValue);
      if (!isNaN(date.getTime())) {
        const zonedDateTime = fromDate(date, "UTC");
        return String(toUnixTimestamp(zonedDateTime));
      }
    } catch {
      // If parsing fails, leave as is
    }
  }

  return null;
}

async function extractPostData(post: unknown): Promise<PostData | null> {
  if (typeof post !== "object" || post === null) {
    return null;
  }

  const postId = "id" in post && typeof post.id === "string" ? post.id : null;
  const postUserId =
    "userId" in post && typeof post.userId === "string" ? post.userId : null;
  const postSignedEvent = "signedEvent" in post ? post.signedEvent : null;

  // Handle both scheduledFor (legacy string) and scheduledAtUtc (DateTime)
  const postScheduledFor = await extractScheduledFor(
    post as Record<string, unknown>
  );

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

// Worker to process scheduled posts
export const scheduledPostsWorker = new Worker<PostJobData>(
  QUEUE_SCHEDULED_POSTS,
  async (job: Job<PostJobData>) => {
    const { postId, userId, signedEvent, correlationId } = job.data;
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_POSTS;
    const stateMachine = new PostStateMachine();

    try {
      updateActiveJobs(queueName, 1);
      // Idempotency check: verify post exists and get scheduled time
      const existingPost = await prisma.post.findUnique({
        where: { id: postId, userId },
        select: {
          nostrEventId: true,
          scheduledAtUtc: true,
          scheduledFor: true,
          publishAttemptId: true,
          currentState: true, // Include state for state-based checks
        },
      });

      if (!existingPost) {
        throw new Error(`Post ${postId} not found for user ${userId}`);
      }

      // If already posted, skip processing (idempotency)
      // Use currentState as single source of truth
      const isAlreadyPosted = existingPost.currentState === "PUBLISHED";
      if (isAlreadyPosted) {
        logInfo("Post already posted, skipping duplicate job", {
          postId,
          userId,
          correlationId,
        });
        return { success: true, postId, skipped: true };
      }

      // Generate publish attempt ID (first-class idempotency for publish attempts)
      const scheduledForUnix = existingPost.scheduledAtUtc
        ? (() => {
            const zoned = fromPrismaDate(existingPost.scheduledAtUtc, "UTC");
            return zoned
              ? toUnixTimestamp(zoned)
              : Math.floor(Date.now() / 1000);
          })()
        : existingPost.scheduledFor
          ? parseInt(existingPost.scheduledFor, 10)
          : Math.floor(Date.now() / 1000);

      const attemptNumber = job.attemptsMade;
      const publishAttemptId = generatePublishAttemptId(
        postId,
        scheduledForUnix,
        attemptNumber
      );

      // Check if this publish attempt already succeeded (idempotency check)
      // This prevents duplicate publishes if worker crashes mid-publish and job retries
      if (existingPost.publishAttemptId === publishAttemptId) {
        logInfo("Publish attempt already processed, skipping duplicate", {
          postId,
          userId,
          publishAttemptId,
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
      const publishStartTime = nowMillis();
      const publisher = getNostrPublisher();
      await publisher.publish(
        validatedSignedEvent,
        sanitizedRelays,
        correlationId
      );
      const publishLatency = nowMillis() - publishStartTime;

      // Store publish attempt ID and postedAt (flags will be set by state machine)
      // This ensures idempotency: if worker crashes after this, retry will see publishAttemptId and skip
      await prisma.post.update({
        where: { id: postId, userId },
        data: {
          publishAttemptId,
          postedAt: new Date(),
          // @deprecated - isPosted flag removed. State machine will set it via transition.
        },
      });

      // Transition to PUBLISHED (this will automatically sync flags including isPosted)
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHED",
        "Successfully published to Nostr"
      );

      const duration = nowMillis() - startTime;
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
      const duration = nowMillis() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = err.constructor.name;
      const attemptsMade = job.attemptsMade + 1;
      const policy = getRetryPolicy(queueName);

      // Check if we should retry
      const willRetry =
        shouldRetry(attemptsMade, policy) && isRetryableError(err);

      // Transition to FAILED
      // If post is still in SCHEDULED (error occurred before PUBLISHING transition),
      // we need to transition through PUBLISHING first
      try {
        // Get current state to determine transition path
        const currentPost = await prisma.post.findUnique({
          where: { id: postId },
          select: { currentState: true },
        });

        const currentState = currentPost?.currentState;
        if (currentState === "SCHEDULED") {
          // Transition to PUBLISHING first, then to FAILED
          await stateMachine.transition(
            postId,
            userId,
            "PUBLISHING",
            "Job started processing (before error)"
          );
        }
        // Now transition to FAILED (from either SCHEDULED->PUBLISHING or directly from PUBLISHING)
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
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;

    try {
      updateActiveJobs(queueName, 1);
      // Idempotency check: verify post exists and is not already published
      const existingPost = await prisma.longFormPost.findUnique({
        where: { id: postId, userId },
        select: { nostrEventId: true, currentState: true },
      });

      if (!existingPost) {
        throw new Error(`Longform post ${postId} not found for user ${userId}`);
      }

      // If already published, skip processing (idempotency)
      // Use currentState as single source of truth
      const isAlreadyPublished = existingPost.currentState === "PUBLISHED";
      if (isAlreadyPublished) {
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

      // Transition to PUBLISHING state
      const stateMachine = new LongFormPostStateMachine();
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHING",
        "Publishing longform post from queue"
      );

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

      // Transition to PUBLISHED state (this will automatically sync flags including isPublished)
      await stateMachine.transition(
        postId,
        userId,
        "PUBLISHED",
        "Successfully published to Nostr"
      );

      const duration = nowMillis() - startTime;
      recordJobMetrics(queueName, duration, true);
      updateActiveJobs(queueName, -1);
      logInfo("Longform post published successfully from queue", {
        postId,
        userId,
        correlationId,
      });
      return { success: true, postId };
    } catch (error) {
      const duration = nowMillis() - startTime;
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

      // Transition to FAILED state if not retrying
      if (!willRetry) {
        try {
          const stateMachine = new LongFormPostStateMachine();
          // Get current state to determine transition path
          const currentPost = await prisma.longFormPost.findUnique({
            where: { id: postId },
            select: { currentState: true },
          });

          const currentState = currentPost?.currentState;
          if (currentState === "SCHEDULED") {
            // Transition to PUBLISHING first, then to FAILED
            await stateMachine.transition(
              postId,
              userId,
              "PUBLISHING",
              "Job started processing (before error)"
            );
          }
          // Now transition to FAILED (from either SCHEDULED->PUBLISHING or directly from PUBLISHING)
          await stateMachine.transition(
            postId,
            userId,
            "FAILED",
            `Publish failed: ${err.message}`
          );
        } catch (stateError) {
          // Log but don't throw - state transition failure shouldn't block error handling
          logError(
            stateError instanceof Error
              ? stateError
              : new Error(String(stateError)),
            {
              postId,
              userId,
              correlationId,
              message: "Failed to transition to FAILED state",
            }
          );
        }
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
      const { nowSeconds } = await import("~/lib/temporal");
      const now = nowSeconds();

      // Process regular posts
      let processed = 0;
      for (const post of posts) {
        const postData = await extractPostData(post);
        if (postData) {
          const success = await processPost(postData, now);
          if (success) {
            processed++;
          }
        }
      }

      // Process longform posts
      for (const longformPost of longformPosts) {
        const postData = await extractPostData(longformPost);
        if (postData) {
          const success = await processLongFormPost(postData, now);
          if (success) {
            processed++;
          }
        }
      }

      return { processed };
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
  logInfo("Post checker recurring job registered", { interval: 60000 });
}

// Initialize the post checker
void (async () => {
  try {
    await startPostChecker();
    logInfo("Post checker initialized successfully");
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
