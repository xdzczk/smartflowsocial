/**
 * Scheduled post job handler: processPost (checker), runScheduledPostJob, handleScheduledPostJobError.
 * Uses shared.server.ts and queue-payload.server.ts for shared helpers.
 */

import type { Job } from "bullmq";

import type { SignedEvent } from "~/features/nostr/types";
import {
  QUEUE_SCHEDULED_POSTS,
  type WorkerSuccessResult,
  getSanitizedUserRelays,
  publishWithQueueSpan,
  computeWillRetry,
} from "~/features/posts/queue-handlers/shared.server";
import {
  type PostData,
  toSignedEvent,
  computeScheduledForUnix,
  delayMs,
} from "~/features/posts/queue-payload.server";
import { isHeldByQueue, isQueuePaused } from "~/features/posts/queue-status";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { getPostStats } from "~/features/posts/stats.server";
import type { RepostConditions } from "~/features/posts/types";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import type { PublishLease } from "~/infra/publishing/publish-lease.server";
import {
  acquirePostPublishLease,
  releasePostPublishLease,
} from "~/infra/publishing/publish-lease.server";
import type { PostJobData } from "~/infra/queue";
import { createDeadLetterEntry } from "~/infra/queue/dead-letter-queue.server";
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
import {
  recordJobMetrics,
  recordJobSkipped,
  recordJobRetry,
} from "~/lib/queue-metrics.server";
import { addBreadcrumb, captureException } from "~/lib/sentry.server";
import { nowMillis } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import { findPostUnique } from "../repositories/post-queries-data.server";
import { discardScheduledPost } from "../scheduling/services/attached-followups.server";

const ATTACHED_PARENT_PUBLISH_GRACE_SECONDS = 3600;
const ATTACHED_PARENT_DEFER_SECONDS = 60;

function eventIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("id" in value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function readSignedEvent(value: unknown): SignedEvent | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as SignedEvent;
}

async function resolveSignedEventForEnqueue(
  postId: string,
  userId: string,
  fromJob: SignedEvent | undefined
): Promise<SignedEvent | undefined> {
  const fromJobEvent = readSignedEvent(fromJob);
  if (fromJobEvent) return fromJobEvent;
  const row = await findPostUnique(
    { id: postId, userId },
    { select: { signedEvent: true } }
  );
  return readSignedEvent(row?.signedEvent);
}

async function deferAttachedChildPublish(input: {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
}): Promise<void> {
  const { enqueuePostJob } = await import("~/infra/queue");
  const { nowSeconds } = await import("~/lib/temporal");
  await enqueuePostJob(
    input.postId,
    input.userId,
    input.signedEvent,
    nowSeconds() + ATTACHED_PARENT_DEFER_SECONDS
  );
}

// ---------------------------------------------------------------------------
// processPost (used by checker)
// ---------------------------------------------------------------------------

export async function processPost(
  postData: PostData,
  now: number
): Promise<boolean> {
  const currentPostRaw = await findPostUnique(
    { id: postData.id, userId: postData.userId },
    {
      select: {
        currentState: true,
        queueHoldStatus: true,
        queueType: { select: { status: true, isEnabled: true } },
      },
    }
  );
  const currentPost = currentPostRaw as {
    currentState: string | null;
    queueHoldStatus: string | null;
    queueType: { status?: string | null; isEnabled?: boolean | null } | null;
  } | null;
  if (
    currentPost?.currentState !== "SCHEDULED" ||
    isHeldByQueue(currentPost.queueHoldStatus) ||
    isQueuePaused(currentPost.queueType)
  ) {
    return false;
  }

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

// ---------------------------------------------------------------------------
// transitionPostToFailed (internal)
// ---------------------------------------------------------------------------

async function transitionPostToFailed(input: {
  stateMachine: PostStateMachine;
  postId: string;
  userId: string;
  errorMessage: string;
  lockId?: string | null;
}): Promise<void> {
  const currentPost = await findPostUnique(
    { id: input.postId },
    { select: { currentState: true } }
  );

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

// ---------------------------------------------------------------------------
// getScheduledPostWithRetry (internal)
// ---------------------------------------------------------------------------

const POST_LOOKUP_RETRY_ATTEMPTS = 3;
const POST_LOOKUP_RETRY_DELAYS_MS = [0, 1000, 2000];

async function getScheduledPostWithRetry(
  postId: string,
  userId: string,
  context: { correlationId?: string; jobId?: string }
): Promise<{
  scheduledAtUtc: Date | null;
  currentState: string | null;
  queueHoldStatus: string | null;
  queueType: {
    name?: string | null;
    status?: string | null;
    isEnabled?: boolean | null;
  } | null;
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
    const postRaw = await findPostUnique(
      { id: postId, userId },
      {
        select: {
          scheduledAtUtc: true,
          currentState: true,
          queueHoldStatus: true,
          queueType: {
            select: {
              name: true,
              status: true,
              isEnabled: true,
            },
          },
        },
      }
    );
    const post = postRaw as {
      scheduledAtUtc: Date | null;
      currentState: string | null;
      queueHoldStatus: string | null;
      queueType: {
        name?: string | null;
        status?: string | null;
        isEnabled?: boolean | null;
      } | null;
    } | null;
    if (post) return post;
  }
  return null;
}

// ---------------------------------------------------------------------------
// handleScheduledPostJobError (export)
// ---------------------------------------------------------------------------

export async function handleScheduledPostJobError(input: {
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

  const post = await findPostUnique(
    { id: postId },
    {
      select: {
        postType: true,
        postKind: true,
        queueType: { select: { name: true } },
      },
    }
  );
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

    try {
      const post = await findPostUnique(
        { id: postId },
        { select: { publishAttemptId: true } }
      );
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

// ---------------------------------------------------------------------------
// runScheduledPostJob (export)
// ---------------------------------------------------------------------------

// eslint-disable-next-line sonarjs/cognitive-complexity -- Scheduled publish: validation, signing, contest hook, retries
export async function runScheduledPostJob(input: {
  job: Job<PostJobData>;
  startTime: number;
  ctx: { lease: PublishLease | null };
}): Promise<WorkerSuccessResult> {
  const job = input.job;
  const { postId, userId, correlationId } = job.data;
  const signedEventFromJob = job.data.signedEvent as SignedEvent | undefined;
  const queueName = QUEUE_SCHEDULED_POSTS;
  const stateMachine = new PostStateMachine();

  const existingPost = await getScheduledPostWithRetry(postId, userId, {
    correlationId,
    jobId: String(job.id ?? "unknown"),
  });

  if (!existingPost) {
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

  if (
    isHeldByQueue(existingPost.queueHoldStatus) ||
    isQueuePaused(existingPost.queueType)
  ) {
    logInfo("Skipping scheduled post because queue is paused or held", {
      ...buildObsContext({
        postId,
        userId,
        correlationId,
        queueName,
        jobId: String(job.id ?? "unknown"),
        attemptsMade: job.attemptsMade + 1,
      }),
      queueStatus: existingPost.queueType?.status ?? null,
      queueHoldStatus: existingPost.queueHoldStatus,
    });
    recordJobSkipped(
      queueName,
      isHeldByQueue(existingPost.queueHoldStatus)
        ? "queue_held"
        : "queue_paused"
    );
    addBreadcrumb({
      message: "scheduled_post_job_skipped_queue_paused_or_held",
      category: "worker",
      level: "info",
      data: {
        queue: queueName,
        postId,
        userId,
        correlationId,
        queueStatus: existingPost.queueType?.status ?? null,
        queueHoldStatus: existingPost.queueHoldStatus,
      },
    });
    return { success: true, postId, skipped: true };
  }

  const scheduledForUnix = computeScheduledForUnix(existingPost.scheduledAtUtc);
  const publishAttemptId = generatePublishAttemptId(
    postId,
    scheduledForUnix,
    job.attemptsMade
  );

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

  const repostMeta = await findPostUnique(
    { id: postId, userId },
    {
      select: {
        postKind: true,
        repostOfPostId: true,
        repostConditions: true,
        dependencyMode: true,
        signingState: true,
        parentScheduledActionId: true,
        expectedParentEventId: true,
        currentState: true,
      },
    }
  );
  if (
    repostMeta?.dependencyMode === "attached" &&
    repostMeta.parentScheduledActionId
  ) {
    const invalidReason =
      repostMeta.currentState !== "SCHEDULED"
        ? "Attached child is no longer scheduled"
        : repostMeta.signingState !== "signed"
          ? "Attached child signing state is not signed"
          : null;
    if (invalidReason) {
      await releasePostPublishLease({ postId, userId, lockId: lease.lockId });
      input.ctx.lease = null;
      if (repostMeta.currentState === "SCHEDULED") {
        await discardScheduledPost({
          postId,
          userId,
          reason: `Follow-up discarded: ${invalidReason}`,
        });
      }
      logInfo("Skipping attached child publish due to dependency guard", {
        postId,
        userId,
        correlationId,
        reason: invalidReason,
      });
      recordJobSkipped(queueName, "attached_dependency_invalid");
      return { success: true, postId, skipped: true };
    }

    const parentPost = await findPostUnique(
      { id: repostMeta.parentScheduledActionId, userId },
      {
        select: { currentState: true, nostrEventId: true, signedEvent: true },
      }
    );
    const parentEventId =
      parentPost?.nostrEventId ?? eventIdFromUnknown(parentPost?.signedEvent);
    const parentState = parentPost?.currentState;
    const parentEventMismatch =
      parentState === "PUBLISHED" &&
      parentEventId != null &&
      repostMeta.expectedParentEventId != null &&
      parentEventId !== repostMeta.expectedParentEventId;
    const parentNotPublished =
      parentState !== "PUBLISHED" || parentEventId == null;
    if (parentNotPublished || parentEventMismatch) {
      await releasePostPublishLease({ postId, userId, lockId: lease.lockId });
      input.ctx.lease = null;

      const parentTerminal =
        parentState === "CANCELLED" ||
        parentState === "FAILED" ||
        parentState === "DRAFT";
      const latenessSeconds = Math.floor(Date.now() / 1000) - scheduledForUnix;

      if (parentEventMismatch) {
        await discardScheduledPost({
          postId,
          userId,
          reason: "Follow-up discarded: parent signing changed",
        });
        recordJobSkipped(queueName, "attached_parent_event_mismatch");
      } else if (
        parentTerminal ||
        latenessSeconds > ATTACHED_PARENT_PUBLISH_GRACE_SECONDS
      ) {
        await discardScheduledPost({
          postId,
          userId,
          reason: "Parent post did not publish; follow-up discarded",
        });
        recordJobSkipped(
          queueName,
          parentTerminal ? "attached_parent_failed" : "attached_parent_timeout"
        );
      } else {
        const signedEventForDefer = await resolveSignedEventForEnqueue(
          postId,
          userId,
          signedEventFromJob
        );
        if (signedEventForDefer) {
          await deferAttachedChildPublish({
            postId,
            userId,
            signedEvent: signedEventForDefer,
          });
        }
        recordJobSkipped(queueName, "attached_parent_not_ready");
      }

      logInfo("Skipping attached child publish due to parent guard", {
        postId,
        userId,
        correlationId,
        parentScheduledActionId: repostMeta.parentScheduledActionId,
        expectedParentEventId: repostMeta.expectedParentEventId,
        parentEventId,
        parentState,
      });
      return { success: true, postId, skipped: true };
    }
  }
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
    const sourcePost = await findPostUnique(
      { id: repostMeta.repostOfPostId, userId },
      { select: { nostrEventId: true, signedEvent: true } }
    );
    const sourceEventId =
      sourcePost?.nostrEventId ??
      (sourcePost?.signedEvent &&
      typeof sourcePost.signedEvent === "object" &&
      !Array.isArray(sourcePost.signedEvent) &&
      "id" in sourcePost.signedEvent &&
      typeof (sourcePost.signedEvent as { id: string }).id === "string"
        ? (sourcePost.signedEvent as { id: string }).id
        : null);
    if (!sourceEventId) {
      await releasePostPublishLease({
        postId,
        userId,
        lockId: lease.lockId,
      });
      input.ctx.lease = null;
      await discardScheduledPost({
        postId,
        userId,
        reason: "Repost skipped: could not verify engagement conditions",
      });
      logInfo("Repost skipped: could not verify engagement conditions", {
        postId,
        userId,
        correlationId,
        queueName,
      });
      recordJobSkipped(queueName, "repost_conditions_unverifiable");
      return { success: true, postId, skipped: true };
    }

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
      await discardScheduledPost({
        postId,
        userId,
        reason: "Repost skipped: engagement conditions not met",
      });
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

  await stateMachine.transition(
    postId,
    userId,
    "PUBLISHING",
    "Job started processing"
  );

  let eventToPublish: SignedEvent | undefined =
    signedEventFromJob &&
    typeof signedEventFromJob === "object" &&
    !Array.isArray(signedEventFromJob)
      ? signedEventFromJob
      : undefined;
  if (eventToPublish == null) {
    const postWithEvent = await findPostUnique(
      { id: postId, userId },
      { select: { signedEvent: true } }
    );
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

  const post = await findPostUnique(
    { id: postId },
    {
      select: {
        postType: true,
        postKind: true,
        queueType: {
          select: {
            name: true,
          },
        },
      },
    }
  );
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

  try {
    const { maybeActivateContestAfterSourcePostPublish } =
      await import("~/features/contest");
    await maybeActivateContestAfterSourcePostPublish({
      postId,
      userId,
      publishedEventId: validatedSignedEvent.id,
    });
  } catch (orchErr) {
    logError(orchErr instanceof Error ? orchErr : new Error(String(orchErr)), {
      message: "Contest launch hook after scheduled publish failed",
      postId,
      userId,
    });
  }

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

  try {
    const { sendPublishSuccessNotification } =
      await import("~/infra/notifications/push-notification.server");
    await sendPublishSuccessNotification(userId, postId, publishAttemptId, {
      isLongForm: false,
      source: "scheduled",
      postKind: post?.postKind,
      queueName:
        (post as { queueType?: { name: string } } | null)?.queueType?.name ??
        null,
    });
  } catch (notificationError) {
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
