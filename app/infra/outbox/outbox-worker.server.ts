/**
 * Outbox Worker
 *
 * Drains outbox events and enqueues them into BullMQ.
 * Runs periodically to process unprocessed events.
 */

import {
  processPayloadWithVersion,
  CURRENT_VERSION,
  getPayloadVersion,
} from "~/infra/queue/version-handler.server";
import {
  classifyError,
  ErrorCategory,
  isRetryableErrorEnhanced,
  getRetryDelayForError,
} from "~/lib/error-classification.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import {
  recordOutboxEventDeadLettered,
  recordOutboxEventProcessed,
  recordOutboxEventRetried,
  setOutboxBacklog,
} from "~/lib/metrics/business-metrics.server";
import { recordOutboxProcessingDuration } from "~/lib/metrics/performance-metrics.server";
import { buildObsContext } from "~/lib/observability-context.server";
import { recordJobMetrics, recordJobStarted } from "~/lib/queue-metrics.server";

import { queueClient } from "../queue/queue-client.server";
import type { PostJobData, LongFormPostJobData } from "../queue/queue-types";

import {
  computeNextAttemptAt,
  getOutboxRetryPolicy,
} from "./outbox-retry-policy.server";
import {
  getUnprocessedOutboxEvents,
  claimOutboxEvent,
  markOutboxEventSucceeded,
  markOutboxEventFailed,
  deadLetterOutboxEvent,
  getOutboxBacklogCounts,
  type PostScheduledPayload,
  type LongFormPostScheduledPayload,
  type OutboxEventType,
} from "./outbox.server";
import { updateReadModels } from "./read-model-worker.server";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000; // 5 seconds
const OUTBOX_LOCK_TTL_MS = 30_000;

const QUEUE_SCHEDULED_POSTS = "scheduled-posts" as const;
const QUEUE_SCHEDULED_LONGFORM_POSTS = "scheduled-longform-posts" as const;
const JOB_PUBLISH_POST = "publish-post" as const;
const JOB_PUBLISH_LONGFORM_POST = "publish-longform-post" as const;

function isDuplicateJobIdError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  // BullMQ jobId collision errors vary by version/driver; keep matching broad.
  return (
    m.includes("job") &&
    (m.includes("already exists") ||
      m.includes("exists already") ||
      m.includes("duplicat"))
  );
}

function isDefinitelyNonRetryableOutboxError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("unknown event type") ||
    msg.includes("failed to process payload version") ||
    msg.includes("payload version") ||
    msg.includes("schema version")
  );
}

/**
 * Process a single outbox event
 */
async function processEvent(event: {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  payload: unknown;
  scheduledFor: Date | null;
  correlationId?: string | null;
}) {
  const correlationId = event.correlationId ?? undefined;

  switch (event.eventType) {
    case "POST_SCHEDULED": {
      // Process payload with version handling
      const versionResult = processPayloadWithVersion<PostScheduledPayload>(
        event.payload,
        {
          eventId: event.id,
          aggregateId: event.aggregateId,
        }
      );

      if (!versionResult.success || !versionResult.payload) {
        throw new Error(
          versionResult.error ?? "Failed to process payload version"
        );
      }

      const payload = versionResult.payload;
      const scheduledFor = payload.scheduledFor;

      // Log version if different from current
      if (versionResult.version && versionResult.version !== CURRENT_VERSION) {
        logInfo(
          "Processed payload with version migration",
          buildObsContext({
            postId: payload.postId,
            outboxEventId: event.id,
            correlationId: payload.correlationId ?? correlationId,
            eventType: event.eventType,
          })
        );
        logInfo("Outbox payload schema migration details", {
          postId: payload.postId,
          eventId: event.id,
          originalVersion: getPayloadVersion(event.payload),
          migratedVersion: versionResult.version,
        });
      }

      const result = await queueClient.enqueue<PostJobData>(
        QUEUE_SCHEDULED_POSTS,
        JOB_PUBLISH_POST,
        {
          postId: payload.postId,
          userId: payload.userId,
          signedEvent: payload.signedEvent,
          correlationId: payload.correlationId ?? correlationId, // Preserve correlation ID
        },
        {
          scheduledFor,
          jobId: payload.postId, // Deterministic jobId for cancellation
        }
      );

      if (!result.success) {
        const errorMessage = result.error ?? "Failed to enqueue post job";
        if (isDuplicateJobIdError(errorMessage)) {
          // Treat deterministic jobId collisions as idempotent success.
          logInfo(
            "Post job already enqueued; treating outbox as idempotent",
            buildObsContext({
              postId: payload.postId,
              outboxEventId: event.id,
              correlationId: payload.correlationId ?? correlationId,
              eventType: event.eventType,
              queueName: QUEUE_SCHEDULED_POSTS,
              jobId: payload.postId,
            })
          );
          break;
        }
        throw new Error(errorMessage);
      }

      logInfo("Enqueued post job from outbox", {
        ...buildObsContext({
          postId: payload.postId,
          outboxEventId: event.id,
          correlationId: payload.correlationId ?? correlationId,
          eventType: event.eventType,
          queueName: QUEUE_SCHEDULED_POSTS,
          jobId: payload.postId,
        }),
        schemaVersion: versionResult.version,
      });
      break;
    }

    case "LONGFORM_SCHEDULED": {
      // Process payload with version handling
      const versionResult =
        processPayloadWithVersion<LongFormPostScheduledPayload>(event.payload, {
          eventId: event.id,
          aggregateId: event.aggregateId,
        });

      if (!versionResult.success || !versionResult.payload) {
        throw new Error(
          versionResult.error ?? "Failed to process payload version"
        );
      }

      const payload = versionResult.payload;
      const scheduledFor = payload.scheduledFor;

      // Log version if different from current
      if (versionResult.version && versionResult.version !== CURRENT_VERSION) {
        logInfo(
          "Processed payload with version migration",
          buildObsContext({
            postId: payload.postId,
            outboxEventId: event.id,
            correlationId: payload.correlationId ?? correlationId,
            eventType: event.eventType,
          })
        );
        logInfo("Outbox payload schema migration details", {
          postId: payload.postId,
          eventId: event.id,
          originalVersion: getPayloadVersion(event.payload),
          migratedVersion: versionResult.version,
        });
      }

      const result = await queueClient.enqueue<LongFormPostJobData>(
        QUEUE_SCHEDULED_LONGFORM_POSTS,
        JOB_PUBLISH_LONGFORM_POST,
        {
          postId: payload.postId,
          userId: payload.userId,
          signedEvent: payload.signedEvent,
          correlationId: payload.correlationId ?? correlationId, // Preserve correlation ID
        },
        {
          scheduledFor,
          jobId: payload.postId,
        }
      );

      if (!result.success) {
        const errorMessage =
          result.error ?? "Failed to enqueue longform post job";
        if (isDuplicateJobIdError(errorMessage)) {
          logInfo(
            "Longform job already enqueued; treating outbox as idempotent",
            buildObsContext({
              postId: payload.postId,
              outboxEventId: event.id,
              correlationId: payload.correlationId ?? correlationId,
              eventType: event.eventType,
              queueName: QUEUE_SCHEDULED_LONGFORM_POSTS,
              jobId: payload.postId,
            })
          );
          break;
        }
        throw new Error(errorMessage);
      }

      logInfo("Enqueued longform post job from outbox", {
        ...buildObsContext({
          postId: payload.postId,
          outboxEventId: event.id,
          correlationId: payload.correlationId ?? correlationId,
          eventType: event.eventType,
          queueName: QUEUE_SCHEDULED_LONGFORM_POSTS,
          jobId: payload.postId,
        }),
        schemaVersion: versionResult.version,
      });
      break;
    }

    case "POST_CANCELLED":
    case "LONGFORM_CANCELLED": {
      // Cancel job in BullMQ
      const cancelled = await queueClient.cancelByData(
        event.eventType === "POST_CANCELLED"
          ? QUEUE_SCHEDULED_POSTS
          : QUEUE_SCHEDULED_LONGFORM_POSTS,
        "postId",
        event.aggregateId
      );

      if (cancelled) {
        logInfo(
          "Cancelled job from outbox",
          buildObsContext({
            postId: event.aggregateId,
            outboxEventId: event.id,
            correlationId,
            eventType: event.eventType,
          })
        );
      }
      break;
    }

    // Read model events - no queue action needed, handled by read model worker
    case "POST_CREATED":
    case "POST_UPDATED":
    case "POST_PUBLISHED":
    case "POST_DELETED":
    case "LONGFORM_CREATED":
    case "LONGFORM_UPDATED":
    case "LONGFORM_PUBLISHED":
    case "LONGFORM_DELETED":
      // These events don't need queue processing
      break;

    default: {
      const _exhaustiveCheck: never = event.eventType;
      throw new Error(`Unknown event type: ${_exhaustiveCheck as string}`);
    }
  }
}

/**
 * Process all unprocessed outbox events
 */
export async function processOutboxEvents(): Promise<{
  processed: number;
  errors: number;
}> {
  const events = await getUnprocessedOutboxEvents(BATCH_SIZE, new Date());
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    const lock = await claimOutboxEvent({
      eventId: event.id,
      ttlMs: OUTBOX_LOCK_TTL_MS,
      now: new Date(),
    });
    if (!lock) {
      // Another worker may have claimed it, or it's no longer eligible.
      continue;
    }

    const startTime = Date.now();
    recordJobStarted("outbox");
    try {
      await processEvent({
        id: event.id,
        eventType: event.eventType as OutboxEventType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        scheduledFor: event.scheduledFor,
        correlationId: event.correlationId ?? undefined,
      });
      await markOutboxEventSucceeded({
        eventId: event.id,
        lockId: lock.lockId,
        now: new Date(),
      });
      processed++;

      // Update read models for read model events
      if (
        event.eventType === "POST_CREATED" ||
        event.eventType === "POST_UPDATED" ||
        event.eventType === "POST_PUBLISHED" ||
        event.eventType === "POST_DELETED" ||
        event.eventType === "LONGFORM_CREATED" ||
        event.eventType === "LONGFORM_UPDATED" ||
        event.eventType === "LONGFORM_PUBLISHED" ||
        event.eventType === "LONGFORM_DELETED"
      ) {
        // Update read models asynchronously (don't block event processing)
        void updateReadModels({
          id: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          payload: event.payload,
          correlationId: event.correlationId,
          // eslint-disable-next-line promise/prefer-await-to-then -- Fire-and-forget pattern
        }).catch((readModelError) => {
          logError(
            readModelError instanceof Error
              ? readModelError
              : new Error(String(readModelError)),
            {
              eventId: event.id,
              eventType: event.eventType,
              aggregateId: event.aggregateId,
              message: "Failed to update read models (non-blocking)",
            }
          );
        });
      }

      const duration = Date.now() - startTime;
      recordOutboxEventProcessed(event.eventType, true);
      recordOutboxProcessingDuration(event.eventType, duration, true);
      recordJobMetrics("outbox", duration, true);
    } catch (error) {
      errors++;
      const err = error instanceof Error ? error : new Error(String(error));

      // Determine retryability
      const classification = classifyError(err);
      const shouldRetryByClassification =
        isRetryableErrorEnhanced(err) ||
        classification.category === ErrorCategory.UNKNOWN;
      const shouldRetry =
        !isDefinitelyNonRetryableOutboxError(err) &&
        shouldRetryByClassification;

      const attemptsSoFar = event.attempts;
      const attemptsAfterIncrement = attemptsSoFar + 1;
      const policy = getOutboxRetryPolicy();

      const duration = Date.now() - startTime;
      recordOutboxEventProcessed(event.eventType, false);
      recordOutboxProcessingDuration(event.eventType, duration, false);
      recordJobMetrics("outbox", duration, false, err);

      if (!shouldRetry) {
        await deadLetterOutboxEvent({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
        });
        recordOutboxEventDeadLettered(event.eventType, "non_retryable");
      } else if (attemptsAfterIncrement >= policy.maxAttempts) {
        await deadLetterOutboxEvent({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
        });
        recordOutboxEventDeadLettered(event.eventType, "max_attempts");
      } else {
        const suggestedDelayMs = getRetryDelayForError(err) ?? 0;
        const nextAttemptAt = computeNextAttemptAt({
          now: new Date(),
          attemptsAfterIncrement,
          policy,
          minimumDelayMs: suggestedDelayMs,
        });
        await markOutboxEventFailed({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
          nextAttemptAt,
        });
        recordOutboxEventRetried(event.eventType);
      }

      logError(err, {
        eventId: event.id,
        aggregateId: event.aggregateId,
        message: "Failed to process outbox event",
        attemptsAfterIncrement,
        retryable: shouldRetry,
        ...buildObsContext({
          outboxEventId: event.id,
          correlationId: event.correlationId ?? undefined,
          eventType: event.eventType,
          postId: event.aggregateId,
        }),
      });
    }
  }

  // Update backlog gauges (best-effort)
  try {
    const counts = await getOutboxBacklogCounts(new Date());
    setOutboxBacklog("pending", counts.pending);
    setOutboxBacklog("ready", counts.ready);
    setOutboxBacklog("dead_letter", counts.deadLettered);
  } catch {
    // Best-effort: never fail outbox processing due to metrics.
  }

  return { processed, errors };
}

/**
 * Start the outbox worker (runs continuously)
 */
export function startOutboxWorker() {
  logInfo("Starting outbox worker", { pollInterval: POLL_INTERVAL_MS });

  // Process immediately on start
  // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Fire-and-forget pattern
  void processOutboxEvents().catch((error) => {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error in initial outbox processing",
    });
  });

  // Then process periodically
  const interval = setInterval(() => {
    // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Fire-and-forget pattern
    void processOutboxEvents().catch((error) => {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error in periodic outbox processing",
      });
    });
  }, POLL_INTERVAL_MS);

  // Cleanup on shutdown
  process.on("SIGTERM", () => {
    clearInterval(interval);
    logInfo("Outbox worker shutting down");
  });

  process.on("SIGINT", () => {
    clearInterval(interval);
    logInfo("Outbox worker shutting down");
  });

  return interval;
}
