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
import { logError, logInfo } from "~/lib/error-logger.server";
import { recordOutboxEventProcessed } from "~/lib/metrics/business-metrics.server";
import { recordOutboxProcessingDuration } from "~/lib/metrics/performance-metrics.server";

import { queueClient } from "../queue/queue-client.server";
import type { PostJobData, LongFormPostJobData } from "../queue/queue-types";

import {
  getUnprocessedOutboxEvents,
  markOutboxEventProcessed,
  type PostScheduledPayload,
  type LongFormPostScheduledPayload,
  type OutboxEventType,
} from "./outbox.server";
import { updateReadModels } from "./read-model-worker.server";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000; // 5 seconds

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
        logInfo("Processed payload with version migration", {
          postId: payload.postId,
          eventId: event.id,
          originalVersion: getPayloadVersion(event.payload),
          migratedVersion: versionResult.version,
        });
      }

      const result = await queueClient.enqueue<PostJobData>(
        "scheduled-posts",
        "publish-post",
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
        throw new Error(result.error ?? "Failed to enqueue post job");
      }

      logInfo("Enqueued post job from outbox", {
        postId: payload.postId,
        eventId: event.id,
        correlationId: payload.correlationId ?? correlationId,
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
        logInfo("Processed payload with version migration", {
          postId: payload.postId,
          eventId: event.id,
          originalVersion: getPayloadVersion(event.payload),
          migratedVersion: versionResult.version,
        });
      }

      const result = await queueClient.enqueue<LongFormPostJobData>(
        "scheduled-longform-posts",
        "publish-longform-post",
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
        throw new Error(result.error ?? "Failed to enqueue longform post job");
      }

      logInfo("Enqueued longform post job from outbox", {
        postId: payload.postId,
        eventId: event.id,
        correlationId: payload.correlationId ?? correlationId,
        schemaVersion: versionResult.version,
      });
      break;
    }

    case "POST_CANCELLED":
    case "LONGFORM_CANCELLED": {
      // Cancel job in BullMQ
      const cancelled = await queueClient.cancelByData(
        event.eventType === "POST_CANCELLED"
          ? "scheduled-posts"
          : "scheduled-longform-posts",
        "postId",
        event.aggregateId
      );

      if (cancelled) {
        logInfo("Cancelled job from outbox", {
          postId: event.aggregateId,
          eventId: event.id,
        });
      }
      break;
    }

    default:
      throw new Error(`Unknown event type: ${event.eventType}`);
  }
}

/**
 * Process all unprocessed outbox events
 */
export async function processOutboxEvents(): Promise<{
  processed: number;
  errors: number;
}> {
  const events = await getUnprocessedOutboxEvents(BATCH_SIZE);
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "outbox-worker.server.ts:processOutboxEvents",
      message: "Outbox events fetched",
      data: {
        eventCount: events.length,
        eventTypes: events.map((e) => e.eventType),
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      hypothesisId: "B",
    }),
  }).catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
  // #endregion
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    const startTime = Date.now();
    try {
      await processEvent({
        id: event.id,
        eventType: event.eventType as OutboxEventType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        scheduledFor: event.scheduledFor,
        correlationId: event.correlationId ?? undefined,
      });
      await markOutboxEventProcessed(event.id);
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
    } catch (error) {
      errors++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await markOutboxEventProcessed(event.id, errorMessage);

      const duration = Date.now() - startTime;
      recordOutboxEventProcessed(event.eventType, false);
      recordOutboxProcessingDuration(event.eventType, duration, false);

      logError(error instanceof Error ? error : new Error(errorMessage), {
        eventId: event.id,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId ?? undefined,
        message: "Failed to process outbox event",
      });
    }
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
