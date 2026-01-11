/**
 * Outbox Worker
 *
 * Drains outbox events and enqueues them into BullMQ.
 * Runs periodically to process unprocessed events.
 */

import { prisma } from "~/lib/prisma.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import {
  processPayloadWithVersion,
  CURRENT_VERSION,
  getPayloadVersion,
} from "~/infra/queue/version-handler.server";

import { queueClient } from "../queue/queue-client.server";
import type { PostJobData, LongFormPostJobData } from "../queue/queue-types";
import {
  getUnprocessedOutboxEvents,
  markOutboxEventProcessed,
  type PostScheduledPayload,
  type LongFormPostScheduledPayload,
  type OutboxEventType,
} from "./outbox.server";

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
      const versionResult = processPayloadWithVersion<LongFormPostScheduledPayload>(
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
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    const startTime = Date.now();
    try {
      await processEvent(event);
      await markOutboxEventProcessed(event.id);
      processed++;

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
  void processOutboxEvents().catch((error) => {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error in initial outbox processing",
    });
  });

  // Then process periodically
  const interval = setInterval(() => {
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
