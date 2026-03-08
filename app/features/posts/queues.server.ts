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
import { getPostStats } from "~/features/posts/stats.server";
import type { RepostConditions } from "~/features/posts/types";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getNostrPublisher,
  type NostrPublishResult,
} from "~/infra/publishers/nostr-publisher.server";
import type { PublishLease } from "~/infra/publishing/publish-lease.server";
import {
  acquireLongFormPostPublishLease,
  acquirePostPublishLease,
  releaseLongFormPostPublishLease,
  releasePostPublishLease,
} from "~/infra/publishing/publish-lease.server";
import { getQueueInstance, redis, closeAllQueues } from "~/infra/queue";
import type { PostJobData, LongFormPostJobData } from "~/infra/queue";
import { createDeadLetterEntry } from "~/infra/queue/dead-letter-queue.server";
import type { QueueType } from "~/infra/queue/queue-types";
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
import {
  recordPublishLatency,
  recordPublishLateness,
} from "~/lib/metrics/performance-metrics.server";
import { buildObsContext } from "~/lib/observability-context.server";
import { prisma } from "~/lib/prisma.server";
import {
  recordJobMetrics,
  recordJobSkipped,
  recordJobStarted,
  recordJobRetry,
  updateActiveJobs,
} from "~/lib/queue-metrics.server";
import {
  addBreadcrumb,
  captureException,
  withSentrySpan,
} from "~/lib/sentry.server";
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

const QUEUE_SCHEDULED_POSTS: QueueType = "scheduled-posts";

const QUEUE_SCHEDULED_LONGFORM_POSTS: QueueType = "scheduled-longform-posts";
const QUEUE_POST_CHECKER: QueueType = "post-checker";

const SENTRY_QUEUE_PUBLISH_NAME = "queue.publish";
const SENTRY_QUEUE_PUBLISH_OP = "queue.publish";

interface WorkerSuccessResult {
  success: true;
  postId: string;
  skipped?: boolean;
}

async function getSanitizedUserRelays(userId: string): Promise<string[]> {
  // Canonical publishing relays (managed + direct intent).
  // Note: we keep this helper name for minimal churn in worker logic.
  return await resolveExecutionRelays(userId);
}

function computeScheduledForUnix(
  scheduledAtUtc: Date | null | undefined
): number {
  if (!scheduledAtUtc) return Math.floor(Date.now() / 1000);
  const zoned = fromPrismaDate(scheduledAtUtc, "UTC");
  return zoned ? toUnixTimestamp(zoned) : Math.floor(Date.now() / 1000);
}

async function publishWithQueueSpan(input: {
  queueName: QueueType;
  attributes: Record<string, unknown>;
  event: SignedEvent;
  relays: string[];
  correlationId?: string;
}): Promise<{
  publishLatencyMs: number;
  publishResult: NostrPublishResult;
}> {
  const publisher = getNostrPublisher();
  const publishStartTime = nowMillis();
  const publishResult = await withSentrySpan(
    {
      name: SENTRY_QUEUE_PUBLISH_NAME,
      op: SENTRY_QUEUE_PUBLISH_OP,
      attributes: input.attributes,
    },
    async () =>
      await publisher.publish(input.event, input.relays, input.correlationId)
  );
  return { publishLatencyMs: nowMillis() - publishStartTime, publishResult };
}

function computeWillRetry(input: {
  queueName: QueueType;
  attemptsMade: number;
  error: Error;
}): boolean {
  const policy = getRetryPolicy(input.queueName);
  return (
    shouldRetry(input.attemptsMade, policy) && isRetryableError(input.error)
  );
}

async function transitionPostToFailed(input: {
  stateMachine: PostStateMachine;
  postId: string;
  userId: string;
  errorMessage: string;
  lockId?: string | null;
}): Promise<void> {
  const currentPost = await prisma.post.findUnique({
    where: { id: input.postId },
    select: { currentState: true },
  });

  const currentState = currentPost?.currentState;
  if (currentState === "SCHEDULED") {
    await input.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Job started processing (before error)"
    );
  }

  await input.stateMachine.transition(
    input.postId,
    input.userId,
    "FAILED",
    input.errorMessage,
    input.lockId
      ? {
          additionalPostData: {
            publishingLockId: null,
            publishingLockExpiresAt: null,
          },
        }
      : undefined
  );
}

async function transitionLongFormPostToFailed(input: {
  stateMachine: LongFormPostStateMachine;
  postId: string;
  userId: string;
  errorMessage: string;
  lockId?: string | null;
}): Promise<void> {
  const currentPost = await prisma.longFormPost.findUnique({
    where: { id: input.postId },
    select: { currentState: true },
  });

  const currentState = currentPost?.currentState;
  if (currentState === "SCHEDULED") {
    await input.stateMachine.transition(
      input.postId,
      input.userId,
      "PUBLISHING",
      "Job started processing (before error)"
    );
  }

  await input.stateMachine.transition(
    input.postId,
    input.userId,
    "FAILED",
    input.errorMessage,
    input.lockId
      ? {
          additionalPostData: {
            publishingLockId: null,
            publishingLockExpiresAt: null,
          },
        }
      : undefined
  );
}

async function handleScheduledPostJobError(input: {
  job: Job<PostJobData>;
  startTime: number;
  lease: PublishLease | null;
  error: unknown;
}): Promise<void> {
  const { postId, userId, correlationId } = input.job.data;
  const queueName = QUEUE_SCHEDULED_POSTS;

  const duration = nowMillis() - input.startTime;
  const err =
    input.error instanceof Error ? input.error : new Error(String(input.error));
  const errorType = err.constructor.name;
  const attemptsMade = input.job.attemptsMade + 1;
  const willRetry = computeWillRetry({ queueName, attemptsMade, error: err });
  const lockId = input.lease?.lockId;

  if (willRetry) {
    recordJobRetry(queueName);
  }

  try {
    const stateMachine = new PostStateMachine();
    await transitionPostToFailed({
      stateMachine,
      postId,
      userId,
      errorMessage: `Publish failed: ${err.message}`,
      lockId,
    });
  } catch (stateError) {
    logError(
      stateError instanceof Error ? stateError : new Error(String(stateError)),
      {
        postId,
        userId,
        correlationId,
        message: "Failed to transition post to FAILED state",
      }
    );
    if (lockId) {
      await releasePostPublishLease({ postId, userId, lockId });
    }
  }

  recordJobMetrics(queueName, duration, false, err);

  if (willRetry && lockId) {
    await releasePostPublishLease({ postId, userId, lockId });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      postType: true,
      postKind: true,
      queueType: { select: { name: true } },
    },
  });
  if (post) {
    recordPostPublishFailed(post.postType, "scheduled", errorType);
  }

  if (!willRetry) {
    await createDeadLetterEntry(
      queueName,
      input.job.id ?? "unknown",
      "publish-post",
      input.job.data,
      err,
      attemptsMade,
      correlationId
    );

    // Send push notification for publish failure (only on final failure, not retries)
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { publishAttemptId: true },
      });
      const publishAttemptId =
        post?.publishAttemptId ?? `failed_${postId}_${Date.now()}`;
      const { sendPublishFailureNotification } =
        await import("~/infra/notifications/push-notification.server");
      await sendPublishFailureNotification(
        userId,
        postId,
        publishAttemptId,
        err.message
      );
    } catch (notificationError) {
      // Log but don't fail if notification fails
      logError(
        notificationError instanceof Error
          ? notificationError
          : new Error(String(notificationError)),
        {
          message: "Failed to send publish failure notification",
          postId,
          userId,
        }
      );
    }
  }

  logError(err, {
    userId,
    postId,
    message: "Error processing scheduled post",
    correlationId,
    attemptsMade,
    willRetry,
  });

  captureException(err, {
    tags: { queue: queueName, job: "scheduled-post" },
    extra: {
      postId,
      userId,
      correlationId,
      jobId: input.job.id ?? "unknown",
      attempt: input.job.attemptsMade,
      attemptsMade,
      willRetry,
      errorType,
    },
    level: willRetry ? "warning" : "error",
  });
}

async function handleScheduledLongFormPostJobError(input: {
  job: Job<LongFormPostJobData>;
  startTime: number;
  lease: PublishLease | null;
  error: unknown;
}): Promise<void> {
  const { postId, userId, correlationId } = input.job.data;
  const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;

  const duration = nowMillis() - input.startTime;
  const err =
    input.error instanceof Error ? input.error : new Error(String(input.error));
  const attemptsMade = input.job.attemptsMade + 1;
  const willRetry = computeWillRetry({ queueName, attemptsMade, error: err });
  const lockId = input.lease?.lockId;

  if (willRetry) {
    recordJobRetry(queueName);
  }

  recordJobMetrics(queueName, duration, false, err);

  if (willRetry && lockId) {
    await releaseLongFormPostPublishLease({ postId, userId, lockId });
  }

  if (!willRetry) {
    await createDeadLetterEntry(
      queueName,
      input.job.id ?? "unknown",
      "publish-longform-post",
      input.job.data,
      err,
      attemptsMade,
      correlationId
    );

    // Send push notification for publish failure (only on final failure, not retries)
    try {
      const longformPost = await prisma.longFormPost.findUnique({
        where: { id: postId },
        select: { publishAttemptId: true },
      });
      const publishAttemptId =
        longformPost?.publishAttemptId ?? `failed_${postId}_${Date.now()}`;
      const { sendPublishFailureNotification } =
        await import("~/infra/notifications/push-notification.server");
      await sendPublishFailureNotification(
        userId,
        postId,
        publishAttemptId,
        err.message
      );
    } catch (notificationError) {
      // Log but don't fail if notification fails
      logError(
        notificationError instanceof Error
          ? notificationError
          : new Error(String(notificationError)),
        {
          message: "Failed to send publish failure notification",
          postId,
          userId,
        }
      );
    }
  }

  if (!willRetry) {
    try {
      const stateMachine = new LongFormPostStateMachine();
      await transitionLongFormPostToFailed({
        stateMachine,
        postId,
        userId,
        errorMessage: `Publish failed: ${err.message}`,
        lockId,
      });
    } catch (stateError) {
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
      if (lockId) {
        await releaseLongFormPostPublishLease({ postId, userId, lockId });
      }
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

  captureException(err, {
    tags: { queue: queueName, job: "scheduled-longform" },
    extra: {
      postId,
      userId,
      correlationId,
      jobId: input.job.id ?? "unknown",
      attempt: input.job.attemptsMade,
      attemptsMade,
      willRetry,
    },
    level: willRetry ? "warning" : "error",
  });
}

/** Delay helper for retries (avoids pulling in a sleep util). */
function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const POST_LOOKUP_RETRY_ATTEMPTS = 3;
const POST_LOOKUP_RETRY_DELAYS_MS = [0, 1000, 2000];

/**
 * Fetch scheduled post with retries to tolerate replica lag (e.g. reposts
 * created in the same second as outbox processing may not be visible on replicas yet).
 */
async function getScheduledPostWithRetry(
  postId: string,
  userId: string,
  context: { correlationId?: string; jobId?: string }
): Promise<{
  scheduledAtUtc: Date | null;
  currentState: string | null;
} | null> {
  for (let attempt = 0; attempt < POST_LOOKUP_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMsVal = POST_LOOKUP_RETRY_DELAYS_MS[attempt] ?? 0;
      logInfo(
        "Post not found on first lookup, retrying after delay (possible replica lag)",
        {
          postId,
          userId,
          attempt: attempt + 1,
          delayMs: delayMsVal,
          ...context,
        }
      );
      await delayMs(delayMsVal);
    }
    const post = await prisma.post.findUnique({
      where: { id: postId, userId },
      select: {
        scheduledAtUtc: true,
        currentState: true,
      },
    });
    if (post) return post;
  }
  return null;
}

async function runScheduledPostJob(input: {
  job: Job<PostJobData>;
  startTime: number;
  ctx: { lease: PublishLease | null };
}): Promise<WorkerSuccessResult> {
  const job = input.job;
  const { postId, userId, correlationId } = job.data;
  // Allow undefined at runtime (e.g. legacy or corrupted payload); fallback to post row
  const signedEventFromJob = job.data.signedEvent as SignedEvent | undefined;
  const queueName = QUEUE_SCHEDULED_POSTS;
  const stateMachine = new PostStateMachine();

  // Idempotency check: verify post exists and get scheduled time (with retries for replica lag)
  const existingPost = await getScheduledPostWithRetry(postId, userId, {
    correlationId,
    jobId: String(job.id ?? "unknown"),
  });

  if (!existingPost) {
    // Scheduled posts can be deleted by the user before the queued job runs.
    // Treat this as a benign, idempotent skip to avoid dead-letter noise.
    logInfo("Scheduled post not found when processing job, skipping", {
      ...buildObsContext({
        postId,
        userId,
        correlationId,
        queueName,
        jobId: String(job.id ?? "unknown"),
        attemptsMade: job.attemptsMade + 1,
      }),
    });
    recordJobSkipped(queueName, "post_not_found");
    addBreadcrumb({
      message: "scheduled_post_job_skipped_post_not_found",
      category: "worker",
      level: "info",
      data: { queue: queueName, postId, userId, correlationId },
    });
    return { success: true, postId, skipped: true };
  }

  const isAlreadyPosted = existingPost.currentState === "PUBLISHED";
  if (isAlreadyPosted) {
    logInfo("Post already posted, skipping duplicate job", {
      ...buildObsContext({
        postId,
        userId,
        correlationId,
        queueName,
        jobId: String(job.id ?? "unknown"),
        attemptsMade: job.attemptsMade + 1,
      }),
    });
    recordJobSkipped(queueName, "already_published");
    addBreadcrumb({
      message: "scheduled_post_job_skipped_already_published",
      category: "worker",
      level: "info",
      data: { queue: queueName, postId, userId, correlationId },
    });
    return { success: true, postId, skipped: true };
  }

  const scheduledForUnix = computeScheduledForUnix(existingPost.scheduledAtUtc);
  const publishAttemptId = generatePublishAttemptId(
    postId,
    scheduledForUnix,
    job.attemptsMade
  );

  // Acquire a DB-backed publish lease.
  const lease = await acquirePostPublishLease({ postId, userId });
  input.ctx.lease = lease;
  if (!lease) {
    logInfo("Publish lease held by another worker, skipping duplicate job", {
      ...buildObsContext({
        postId,
        userId,
        correlationId,
        publishAttemptId,
        queueName,
        jobId: String(job.id ?? "unknown"),
        attemptsMade: job.attemptsMade + 1,
      }),
    });
    recordJobSkipped(queueName, "publish_lease_held");
    addBreadcrumb({
      message: "scheduled_post_job_skipped_lease_held",
      category: "worker",
      level: "info",
      data: {
        queue: queueName,
        postId,
        userId,
        correlationId,
        publishAttemptId,
      },
    });
    return { success: true, postId, skipped: true };
  }

  // Conditional repost: only publish if source post meets engagement thresholds
  const repostMeta = await prisma.post.findUnique({
    where: { id: postId, userId },
    select: { postKind: true, repostOfPostId: true, repostConditions: true },
  });
  const conditions = repostMeta?.repostConditions as
    | RepostConditions
    | null
    | undefined;
  const hasConditions =
    repostMeta?.postKind === "REPOST" &&
    repostMeta.repostOfPostId &&
    conditions &&
    typeof conditions === "object" &&
    Object.keys(conditions).length > 0;

  if (hasConditions && repostMeta.repostOfPostId) {
    const sourcePost = await prisma.post.findUnique({
      where: { id: repostMeta.repostOfPostId, userId },
      select: { nostrEventId: true, signedEvent: true },
    });
    const sourceEventId =
      sourcePost?.nostrEventId ??
      (sourcePost?.signedEvent &&
      typeof sourcePost.signedEvent === "object" &&
      !Array.isArray(sourcePost.signedEvent) &&
      "id" in sourcePost.signedEvent &&
      typeof (sourcePost.signedEvent as { id: string }).id === "string"
        ? (sourcePost.signedEvent as { id: string }).id
        : null);
    if (sourceEventId) {
      const statsRecord = await getPostStats([sourceEventId]);
      const stats = statsRecord[sourceEventId];
      const cond = conditions as Record<string, number>;
      const mapping: Record<
        string,
        "likes" | "zaps" | "replies" | "reposts" | "satszapped"
      > = {
        minReactions: "likes",
        minZaps: "zaps",
        minComments: "replies",
        minReposts: "reposts",
        minSats: "satszapped",
      };
      const conditionsMet = (() => {
        if (stats === undefined) return false;
        for (const [k, minVal] of Object.entries(cond)) {
          const statsKey = mapping[k];
          if (!statsKey || typeof minVal !== "number") continue;
          const actual = stats[statsKey];
          if (actual < minVal) return false;
        }
        return true;
      })();
      if (!conditionsMet) {
        await releasePostPublishLease({
          postId,
          userId,
          lockId: lease.lockId,
        });
        input.ctx.lease = null;
        await stateMachine.transition(
          postId,
          userId,
          "CANCELLED",
          "Repost skipped: engagement conditions not met"
        );
        logInfo("Repost skipped: engagement conditions not met", {
          postId,
          userId,
          correlationId,
          queueName,
          sourceEventId,
        });
        recordJobSkipped(queueName, "repost_conditions_not_met");
        return { success: true, postId, skipped: true };
      }
    }
  }

  // Transition to PUBLISHING
  await stateMachine.transition(
    postId,
    userId,
    "PUBLISHING",
    "Job started processing"
  );

  // Use signedEvent from job payload; fallback to post row (e.g. reposts/quotes from bulk where payload may have been lost)
  let eventToPublish: SignedEvent | undefined =
    signedEventFromJob &&
    typeof signedEventFromJob === "object" &&
    !Array.isArray(signedEventFromJob)
      ? signedEventFromJob
      : undefined;
  if (eventToPublish == null) {
    const postWithEvent = await prisma.post.findUnique({
      where: { id: postId, userId },
      select: { signedEvent: true },
    });
    const fromDb = postWithEvent?.signedEvent;
    if (fromDb && typeof fromDb === "object" && !Array.isArray(fromDb)) {
      eventToPublish = fromDb as unknown as SignedEvent;
      logInfo("Using signedEvent from post row (job payload missing)", {
        postId,
        userId,
        correlationId,
        queueName,
      });
    }
  }
  if (eventToPublish == null) {
    throw new Error(
      `Post ${postId}: no signedEvent in job data or post row; cannot publish to Nostr`
    );
  }

  const validatedSignedEvent =
    validateSignedEventCryptographically(eventToPublish);
  const sanitizedRelays = await getSanitizedUserRelays(userId);

  const { publishLatencyMs, publishResult } = await publishWithQueueSpan({
    queueName,
    attributes: {
      queue: queueName,
      postId,
      userId,
      correlationId,
      relayCount: sanitizedRelays.length,
      attempt: job.attemptsMade,
    },
    event: validatedSignedEvent,
    relays: sanitizedRelays,
    correlationId,
  });

  // Persist per-relay outcomes for observability (best-effort).
  try {
    await persistPublishRelayAcks({
      publishAttemptId,
      userId,
      eventId: validatedSignedEvent.id,
      results: publishResult.results,
    });
  } catch (ackError) {
    logError(
      ackError instanceof Error ? ackError : new Error(String(ackError)),
      {
        queue: queueName,
        postId,
        userId,
        correlationId,
        publishAttemptId,
        message: "Scheduled posts worker: Failed to persist publish ACKs",
      }
    );
  }

  try {
    await stateMachine.transition(
      postId,
      userId,
      "PUBLISHED",
      "Successfully published to Nostr",
      {
        additionalPostData: {
          nostrEventId: validatedSignedEvent.id,
          publishAttemptId,
          publishedAt: new Date(),
          publishingLockId: null,
          publishingLockExpiresAt: null,
        },
      }
    );
  } catch (transitionError) {
    await releasePostPublishLease({
      postId,
      userId,
      lockId: lease.lockId,
    });
    throw transitionError;
  }

  const duration = nowMillis() - input.startTime;
  recordJobMetrics(queueName, duration, true);

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      postType: true,
      postKind: true,
      queueType: {
        select: {
          name: true,
        },
      },
    },
  });
  if (post) {
    recordPostPublished(post.postType, "scheduled");
    recordPublishLatency(post.postType, "scheduled", publishLatencyMs);
    recordPublishLateness(
      post.postType,
      Math.floor(Date.now() / 1000) - scheduledForUnix
    );
  }

  logInfo("Post published successfully from queue", {
    ...buildObsContext({
      postId,
      userId,
      correlationId,
      publishAttemptId,
      queueName,
      jobId: String(job.id ?? "unknown"),
      attemptsMade: job.attemptsMade + 1,
    }),
  });
  addBreadcrumb({
    message: "scheduled_post_job_succeeded",
    category: "worker",
    level: "info",
    data: {
      queue: queueName,
      postId,
      userId,
      correlationId,
      publishAttemptId,
      jobId: String(job.id ?? "unknown"),
    },
  });

  // Send push notification for publish success (immediate, no batching)
  try {
    const { sendPublishSuccessNotification } =
      await import("~/infra/notifications/push-notification.server");
    await sendPublishSuccessNotification(userId, postId, publishAttemptId, {
      isLongForm: false,
      source: "scheduled",
      postKind: post?.postKind,
      queueName: post?.queueType?.name ?? null,
    });
  } catch (notificationError) {
    // Log but don't fail the job if notification fails
    logError(
      notificationError instanceof Error
        ? notificationError
        : new Error(String(notificationError)),
      {
        message: "Failed to send publish success notification",
        postId,
        userId,
        publishAttemptId,
      }
    );
  }

  return { success: true, postId };
}

async function runScheduledLongFormPostJob(input: {
  job: Job<LongFormPostJobData>;
  startTime: number;
  ctx: { lease: PublishLease | null };
}): Promise<WorkerSuccessResult> {
  const job = input.job;
  const { postId, userId, signedEvent, correlationId } = job.data;
  const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;
  const stateMachine = new LongFormPostStateMachine();

  const existingPost = await prisma.longFormPost.findUnique({
    where: { id: postId, userId },
    select: {
      scheduledAtUtc: true,
      currentState: true,
      queueType: { select: { name: true } },
    },
  });

  if (!existingPost) {
    throw new Error(`Longform post ${postId} not found for user ${userId}`);
  }

  const isAlreadyPublished = existingPost.currentState === "PUBLISHED";
  if (isAlreadyPublished) {
    logInfo("Longform post already published, skipping duplicate job", {
      ...buildObsContext({
        postId,
        userId,
        correlationId,
        queueName,
        jobId: String(job.id ?? "unknown"),
        attemptsMade: job.attemptsMade + 1,
      }),
    });
    recordJobSkipped(queueName, "already_published");
    addBreadcrumb({
      message: "scheduled_longform_job_skipped_already_published",
      category: "worker",
      level: "info",
      data: { queue: queueName, postId, userId, correlationId },
    });
    return { success: true, postId, skipped: true };
  }

  const validatedSignedEvent =
    validateSignedEventCryptographically(signedEvent);
  const scheduledForUnix = computeScheduledForUnix(existingPost.scheduledAtUtc);
  const publishAttemptId = generatePublishAttemptId(
    postId,
    scheduledForUnix,
    job.attemptsMade
  );

  const lease = await acquireLongFormPostPublishLease({ postId, userId });
  input.ctx.lease = lease;
  if (!lease) {
    logInfo(
      "Publish lease held by another worker, skipping duplicate longform job",
      {
        ...buildObsContext({
          postId,
          userId,
          correlationId,
          publishAttemptId,
          queueName,
          jobId: String(job.id ?? "unknown"),
          attemptsMade: job.attemptsMade + 1,
        }),
      }
    );
    recordJobSkipped(queueName, "publish_lease_held");
    addBreadcrumb({
      message: "scheduled_longform_job_skipped_lease_held",
      category: "worker",
      level: "info",
      data: {
        queue: queueName,
        postId,
        userId,
        correlationId,
        publishAttemptId,
      },
    });
    return { success: true, postId, skipped: true };
  }

  await stateMachine.transition(
    postId,
    userId,
    "PUBLISHING",
    "Publishing longform post from queue"
  );

  const sanitizedRelays = await getSanitizedUserRelays(userId);

  const { publishResult } = await publishWithQueueSpan({
    queueName,
    attributes: {
      queue: queueName,
      longFormPostId: postId,
      userId,
      correlationId,
      relayCount: sanitizedRelays.length,
      attempt: job.attemptsMade,
    },
    event: validatedSignedEvent,
    relays: sanitizedRelays,
    correlationId,
  });

  // Persist per-relay outcomes for observability (best-effort).
  try {
    await persistPublishRelayAcks({
      publishAttemptId,
      userId,
      eventId: validatedSignedEvent.id,
      results: publishResult.results,
    });
  } catch (ackError) {
    logError(
      ackError instanceof Error ? ackError : new Error(String(ackError)),
      {
        queue: queueName,
        longFormPostId: postId,
        userId,
        correlationId,
        publishAttemptId,
        message: "Scheduled longform worker: Failed to persist publish ACKs",
      }
    );
  }

  try {
    await stateMachine.transition(
      postId,
      userId,
      "PUBLISHED",
      "Successfully published to Nostr",
      {
        additionalPostData: {
          nostrEventId: validatedSignedEvent.id,
          publishAttemptId,
          publishedAt: new Date(),
          publishingLockId: null,
          publishingLockExpiresAt: null,
        },
      }
    );
  } catch (transitionError) {
    await releaseLongFormPostPublishLease({
      postId,
      userId,
      lockId: lease.lockId,
    });
    throw transitionError;
  }

  recordJobMetrics(queueName, nowMillis() - input.startTime, true);
  recordPostPublished("LONGFORM", "scheduled");
  recordPublishLateness(
    "LONGFORM",
    Math.floor(Date.now() / 1000) - scheduledForUnix
  );
  logInfo("Longform post published successfully from queue", {
    ...buildObsContext({
      postId,
      userId,
      correlationId,
      publishAttemptId,
      queueName,
      jobId: String(job.id ?? "unknown"),
      attemptsMade: job.attemptsMade + 1,
    }),
  });
  addBreadcrumb({
    message: "scheduled_longform_job_succeeded",
    category: "worker",
    level: "info",
    data: {
      queue: queueName,
      postId,
      userId,
      correlationId,
      publishAttemptId,
      jobId: String(job.id ?? "unknown"),
    },
  });

  // Send push notification for publish success (immediate, no batching)
  try {
    const { sendPublishSuccessNotification } =
      await import("~/infra/notifications/push-notification.server");
    await sendPublishSuccessNotification(userId, postId, publishAttemptId, {
      isLongForm: true,
      source: "scheduled",
      queueName: existingPost.queueType?.name ?? null,
    });
  } catch (notificationError) {
    // Log but don't fail the job if notification fails
    logError(
      notificationError instanceof Error
        ? notificationError
        : new Error(String(notificationError)),
      {
        message: "Failed to send publish success notification",
        postId,
        userId,
        publishAttemptId,
      }
    );
  }

  return { success: true, postId };
}

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
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_POSTS;
    const ctx: { lease: PublishLease | null } = { lease: null };
    const { postId, userId, correlationId } = job.data;

    try {
      updateActiveJobs(queueName, 1);
      recordJobStarted(queueName);
      addBreadcrumb({
        message: "scheduled_post_job_started",
        category: "worker",
        level: "info",
        data: {
          queue: queueName,
          postId,
          userId,
          correlationId,
          jobId: job.id ?? "unknown",
          attempt: job.attemptsMade,
        },
      });
      return await runScheduledPostJob({ job, startTime, ctx });
    } catch (error) {
      await handleScheduledPostJobError({
        job,
        startTime,
        lease: ctx.lease,
        error,
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
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
    const startTime = nowMillis();
    const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;
    const ctx: { lease: PublishLease | null } = { lease: null };
    const { postId, userId, correlationId } = job.data;

    try {
      updateActiveJobs(queueName, 1);
      recordJobStarted(queueName);
      addBreadcrumb({
        message: "scheduled_longform_job_started",
        category: "worker",
        level: "info",
        data: {
          queue: queueName,
          postId,
          userId,
          correlationId,
          jobId: job.id ?? "unknown",
          attempt: job.attemptsMade,
        },
      });
      return await runScheduledLongFormPostJob({ job, startTime, ctx });
    } catch (error) {
      await handleScheduledLongFormPostJobError({
        job,
        startTime,
        lease: ctx.lease,
        error,
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
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
    const startTime = nowMillis();
    const queueName = QUEUE_POST_CHECKER;
    updateActiveJobs(queueName, 1);
    recordJobStarted(queueName);
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
        // Outbox-managed posts are enqueued by outbox worker; skip to avoid overlap.
        if (
          typeof post === "object" &&
          "enqueueIdempotencyKey" in post &&
          typeof post.enqueueIdempotencyKey === "string" &&
          post.enqueueIdempotencyKey.length > 0
        ) {
          continue;
        }
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
        // Outbox-managed longform posts are enqueued by outbox worker; skip overlap.
        if (
          typeof longformPost === "object" &&
          "enqueueIdempotencyKey" in longformPost &&
          typeof longformPost.enqueueIdempotencyKey === "string" &&
          longformPost.enqueueIdempotencyKey.length > 0
        ) {
          continue;
        }
        const postData = await extractPostData(longformPost);
        if (postData) {
          const success = await processLongFormPost(postData, now);
          if (success) {
            processed++;
          }
        }
      }

      const duration = nowMillis() - startTime;
      recordJobMetrics(queueName, duration, true);
      return { processed };
    } catch (error) {
      const duration = nowMillis() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      recordJobMetrics(queueName, duration, false, err);
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error checking scheduled posts",
      });
      throw error;
    } finally {
      updateActiveJobs(queueName, -1);
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
