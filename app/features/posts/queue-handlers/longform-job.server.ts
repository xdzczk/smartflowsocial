/**
 * Scheduled longform post job handler: processLongFormPost (checker), runScheduledLongFormPostJob, handleScheduledLongFormPostJobError.
 * Uses shared.server.ts for shared helpers.
 */

import type { Job } from "bullmq";

import { LongFormPostStateMachine } from "~/features/posts/longform/index.server";
import {
  QUEUE_SCHEDULED_LONGFORM_POSTS,
  type WorkerSuccessResult,
  getSanitizedUserRelays,
  publishWithQueueSpan,
  computeWillRetry,
} from "~/features/posts/queue-handlers/shared.server";
import {
  type PostData,
  toSignedEvent,
  computeScheduledForUnix,
} from "~/features/posts/queue-payload.server";
import { isHeldByQueue, isQueuePaused } from "~/features/posts/queue-status";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import type { PublishLease } from "~/infra/publishing/publish-lease.server";
import {
  acquireLongFormPostPublishLease,
  releaseLongFormPostPublishLease,
} from "~/infra/publishing/publish-lease.server";
import type { LongFormPostJobData } from "~/infra/queue";
import { createDeadLetterEntry } from "~/infra/queue/dead-letter-queue.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import { recordPostPublished } from "~/lib/metrics/business-metrics.server";
import { recordPublishLateness } from "~/lib/metrics/performance-metrics.server";
import { buildObsContext } from "~/lib/observability-context.server";
import {
  recordJobMetrics,
  recordJobSkipped,
  recordJobRetry,
} from "~/lib/queue-metrics.server";
import { addBreadcrumb, captureException } from "~/lib/sentry.server";
import { nowMillis } from "~/lib/temporal";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import { findLongFormPostUnique } from "../repositories/longform-data.server";

// ---------------------------------------------------------------------------
// processLongFormPost (used by checker)
// ---------------------------------------------------------------------------

export async function processLongFormPost(
  postData: PostData,
  now: number
): Promise<boolean> {
  const currentPostRaw = await findLongFormPostUnique(
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

// ---------------------------------------------------------------------------
// transitionLongFormPostToFailed (internal)
// ---------------------------------------------------------------------------

async function transitionLongFormPostToFailed(input: {
  stateMachine: LongFormPostStateMachine;
  postId: string;
  userId: string;
  errorMessage: string;
  lockId?: string | null;
}): Promise<void> {
  const currentPost = await findLongFormPostUnique(
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
// handleScheduledLongFormPostJobError (export)
// ---------------------------------------------------------------------------

export async function handleScheduledLongFormPostJobError(input: {
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

    try {
      const longformPost = await findLongFormPostUnique(
        { id: postId },
        { select: { publishAttemptId: true } }
      );
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

// ---------------------------------------------------------------------------
// runScheduledLongFormPostJob (export)
// ---------------------------------------------------------------------------

export async function runScheduledLongFormPostJob(input: {
  job: Job<LongFormPostJobData>;
  startTime: number;
  ctx: { lease: PublishLease | null };
}): Promise<WorkerSuccessResult> {
  const job = input.job;
  const { postId, userId, signedEvent, correlationId } = job.data;
  const queueName = QUEUE_SCHEDULED_LONGFORM_POSTS;
  const stateMachine = new LongFormPostStateMachine();

  const existingPostRaw = await findLongFormPostUnique(
    { id: postId, userId },
    {
      select: {
        scheduledAtUtc: true,
        currentState: true,
        queueHoldStatus: true,
        queueType: { select: { name: true, status: true, isEnabled: true } },
      },
    }
  );
  const existingPost = existingPostRaw as {
    scheduledAtUtc: Date | null;
    currentState: string | null;
    queueHoldStatus: string | null;
    queueType: {
      name?: string | null;
      status?: string | null;
      isEnabled?: boolean | null;
    } | null;
  } | null;

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

  if (
    isHeldByQueue(existingPost.queueHoldStatus) ||
    isQueuePaused(existingPost.queueType)
  ) {
    logInfo(
      "Skipping scheduled longform post because queue is paused or held",
      {
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
      }
    );
    recordJobSkipped(
      queueName,
      isHeldByQueue(existingPost.queueHoldStatus)
        ? "queue_held"
        : "queue_paused"
    );
    addBreadcrumb({
      message: "scheduled_longform_job_skipped_queue_paused_or_held",
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

  try {
    const { sendPublishSuccessNotification } =
      await import("~/infra/notifications/push-notification.server");
    await sendPublishSuccessNotification(userId, postId, publishAttemptId, {
      isLongForm: true,
      source: "scheduled",
      queueName:
        (existingPost as { queueType?: { name: string } }).queueType?.name ??
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
