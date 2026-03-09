/**
 * Outbox Worker
 *
 * Drains outbox events and enqueues them into BullMQ.
 * Event handlers live in outbox-handlers.server.ts; lock/heartbeat/finalize in outbox-lock.server.ts.
 */

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
  setOutboxOldestReadyAgeSeconds,
} from "~/lib/metrics/business-metrics.server";
import {
  recordOutboxEnqueueToProcessLatency,
  recordOutboxProcessingDuration,
} from "~/lib/metrics/performance-metrics.server";
import { buildObsContext } from "~/lib/observability-context.server";
import { recordJobMetrics, recordJobStarted } from "~/lib/queue-metrics.server";

import {
  processOutboxEvent,
  isDefinitelyNonRetryableOutboxError,
  type ProcessableOutboxEvent,
} from "./outbox-handlers.server";
import {
  acquireOutboxLock,
  startOutboxLockHeartbeat,
  finalizeOutboxSuccess,
  finalizeOutboxFailed,
  finalizeOutboxDeadLetter,
} from "./outbox-lock.server";
import {
  getOutboxRetryPolicy,
  computeNextAttemptAt,
} from "./outbox-retry-policy.server";
import {
  getUnprocessedOutboxEvents,
  getOutboxBacklogCounts,
  getOldestReadyOutboxAgeSeconds,
  type OutboxEventType,
} from "./outbox.server";
import { updateReadModels } from "./read-model-worker.server";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000;

/**
 * Process all unprocessed outbox events
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- Worker orchestration intentionally centralizes retry/finalization branches.
export async function processOutboxEvents(): Promise<{
  processed: number;
  errors: number;
}> {
  const events = await getUnprocessedOutboxEvents(BATCH_SIZE, new Date());
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    const lock = await acquireOutboxLock({
      eventId: event.id,
      now: new Date(),
    });
    if (!lock) {
      continue;
    }

    const startTime = Date.now();
    recordJobStarted("outbox");
    const lockState = { refreshFailed: false };
    const stopHeartbeat = startOutboxLockHeartbeat({
      eventId: event.id,
      lockId: lock.lockId,
      onRefreshFailed: () => {
        lockState.refreshFailed = true;
      },
    });

    try {
      const processable: ProcessableOutboxEvent = {
        id: event.id,
        eventType: event.eventType as ProcessableOutboxEvent["eventType"],
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt,
        scheduledFor: event.scheduledFor,
        correlationId: event.correlationId ?? undefined,
      };
      await processOutboxEvent(processable);

      if (lockState.refreshFailed) {
        throw new Error(
          `Outbox lock lost before finalize for event ${event.id}`
        );
      }
      const finalizeSucceeded = await finalizeOutboxSuccess({
        eventId: event.id,
        lockId: lock.lockId,
        now: new Date(),
      });
      if (!finalizeSucceeded) {
        throw new Error(
          `Outbox lock lost before finalize for event ${event.id}`
        );
      }
      processed++;

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
        void (async () => {
          try {
            await updateReadModels({
              id: event.id,
              eventType: event.eventType as OutboxEventType,
              aggregateId: event.aggregateId,
              aggregateType: event.aggregateType,
              payload: event.payload,
              correlationId: event.correlationId,
            });
          } catch (readModelError) {
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
          }
        })();
      }

      const duration = Date.now() - startTime;
      const enqueueToProcessLatencyMs =
        Date.now() - new Date(event.createdAt).getTime();
      recordOutboxEventProcessed(event.eventType, true);
      recordOutboxProcessingDuration(event.eventType, duration, true);
      recordOutboxEnqueueToProcessLatency(
        event.eventType,
        enqueueToProcessLatencyMs
      );
      recordJobMetrics("outbox", duration, true);
    } catch (error) {
      errors++;
      const err = error instanceof Error ? error : new Error(String(error));

      const shouldRetryByClassification =
        isRetryableErrorEnhanced(err) ||
        classifyError(err).category === ErrorCategory.UNKNOWN;
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
        const movedToDlq = await finalizeOutboxDeadLetter({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
        });
        if (!movedToDlq) {
          logError(
            new Error("Outbox dead-letter finalize conflict"),
            buildObsContext({
              outboxEventId: event.id,
              correlationId: event.correlationId ?? undefined,
              eventType: event.eventType,
              postId: event.aggregateId,
            })
          );
        }
        recordOutboxEventDeadLettered(event.eventType, "non_retryable");
      } else if (attemptsAfterIncrement >= policy.maxAttempts) {
        const movedToDlq = await finalizeOutboxDeadLetter({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
        });
        if (!movedToDlq) {
          logError(
            new Error("Outbox dead-letter finalize conflict"),
            buildObsContext({
              outboxEventId: event.id,
              correlationId: event.correlationId ?? undefined,
              eventType: event.eventType,
              postId: event.aggregateId,
            })
          );
        }
        recordOutboxEventDeadLettered(event.eventType, "max_attempts");
      } else {
        const suggestedDelayMs = getRetryDelayForError(err) ?? 0;
        const nextAttemptAt = computeNextAttemptAt({
          now: new Date(),
          attemptsAfterIncrement,
          policy,
          minimumDelayMs: suggestedDelayMs,
        });
        const markedForRetry = await finalizeOutboxFailed({
          eventId: event.id,
          lockId: lock.lockId,
          errorMessage: err.message,
          nextAttemptAt,
        });
        if (!markedForRetry) {
          logError(
            new Error("Outbox retry finalize conflict"),
            buildObsContext({
              outboxEventId: event.id,
              correlationId: event.correlationId ?? undefined,
              eventType: event.eventType,
              postId: event.aggregateId,
            })
          );
        }
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
    } finally {
      stopHeartbeat();
    }
  }

  try {
    const now = new Date();
    const [counts, oldestReadyAgeSeconds] = await Promise.all([
      getOutboxBacklogCounts(now),
      getOldestReadyOutboxAgeSeconds(now),
    ]);
    setOutboxBacklog("pending", counts.pending);
    setOutboxBacklog("ready", counts.ready);
    setOutboxBacklog("dead_letter", counts.deadLettered);
    setOutboxOldestReadyAgeSeconds(oldestReadyAgeSeconds);
  } catch {
    // Best-effort
  }

  return { processed, errors };
}

/**
 * Start the outbox worker (runs continuously)
 */
export function startOutboxWorker() {
  logInfo("Starting outbox worker", { pollInterval: POLL_INTERVAL_MS });
  let isProcessing = false;

  void (async () => {
    isProcessing = true;
    try {
      await processOutboxEvents();
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error in initial outbox processing",
      });
    } finally {
      isProcessing = false;
    }
  })();

  const interval = setInterval(() => {
    if (isProcessing) {
      return;
    }
    void (async () => {
      isProcessing = true;
      try {
        await processOutboxEvents();
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          message: "Error in periodic outbox processing",
        });
      } finally {
        isProcessing = false;
      }
    })();
  }, POLL_INTERVAL_MS);

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
