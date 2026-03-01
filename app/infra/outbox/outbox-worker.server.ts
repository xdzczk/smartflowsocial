/**
 * Outbox Worker
 *
 * Drains outbox events and enqueues them into BullMQ.
 * Runs periodically to process unprocessed events.
 */

import {
  buildLongFormKind5DeleteDraft,
  buildPostKind5DeleteDraft,
} from "~/features/nostr/delete-event.server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";
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
  setOutboxOldestReadyAgeSeconds,
} from "~/lib/metrics/business-metrics.server";
import {
  recordOutboxEnqueueToProcessLatency,
  recordOutboxProcessingDuration,
} from "~/lib/metrics/performance-metrics.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";
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
  extendOutboxEventLock,
  markOutboxEventSucceeded,
  markOutboxEventFailed,
  deadLetterOutboxEvent,
  getOutboxBacklogCounts,
  getOldestReadyOutboxAgeSeconds,
  type PostScheduledPayload,
  type LongFormPostScheduledPayload,
  type PostDeleteRequestedPayload,
  type LongFormDeleteRequestedPayload,
  type OutboxEventType,
} from "./outbox.server";
import { updateReadModels } from "./read-model-worker.server";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000; // 5 seconds
const OUTBOX_LOCK_TTL_MS = 30_000;
const OUTBOX_LOCK_HEARTBEAT_MS = Math.max(
  1_000,
  Math.floor(OUTBOX_LOCK_TTL_MS / 3)
);

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
    msg.includes("schema version") ||
    msg.includes("invalid delete payload") ||
    msg.includes("nostr_nsec") ||
    msg.includes("delete signer pubkey mismatch") ||
    msg.includes("outbox lock lost before finalize")
  );
}

function parsePostDeleteRequestedPayload(
  payload: unknown
): PostDeleteRequestedPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid delete payload: expected object");
  }

  const data = payload as {
    postId?: unknown;
    userId?: unknown;
    originalEventId?: unknown;
    originalEventPubkey?: unknown;
    reason?: unknown;
    schemaVersion?: unknown;
    correlationId?: unknown;
  };

  if (
    typeof data.postId !== "string" ||
    typeof data.userId !== "string" ||
    typeof data.originalEventId !== "string" ||
    typeof data.originalEventPubkey !== "string" ||
    typeof data.schemaVersion !== "string"
  ) {
    throw new Error("Invalid delete payload: missing required fields");
  }

  return {
    postId: data.postId,
    userId: data.userId,
    originalEventId: data.originalEventId,
    originalEventPubkey: data.originalEventPubkey,
    reason: typeof data.reason === "string" ? data.reason : undefined,
    schemaVersion: data.schemaVersion,
    correlationId:
      typeof data.correlationId === "string" ? data.correlationId : undefined,
  };
}

function parseLongFormDeleteRequestedPayload(
  payload: unknown
): LongFormDeleteRequestedPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid delete payload: expected object");
  }

  const data = payload as {
    postId?: unknown;
    userId?: unknown;
    aCoordinate?: unknown;
    originalEventId?: unknown;
    originalEventPubkey?: unknown;
    reason?: unknown;
    schemaVersion?: unknown;
    correlationId?: unknown;
  };

  if (
    typeof data.postId !== "string" ||
    typeof data.userId !== "string" ||
    typeof data.aCoordinate !== "string" ||
    typeof data.originalEventPubkey !== "string" ||
    typeof data.schemaVersion !== "string"
  ) {
    throw new Error("Invalid delete payload: missing required fields");
  }

  return {
    postId: data.postId,
    userId: data.userId,
    aCoordinate: data.aCoordinate,
    originalEventId:
      typeof data.originalEventId === "string"
        ? data.originalEventId
        : undefined,
    originalEventPubkey: data.originalEventPubkey,
    reason: typeof data.reason === "string" ? data.reason : undefined,
    schemaVersion: data.schemaVersion,
    correlationId:
      typeof data.correlationId === "string" ? data.correlationId : undefined,
  };
}

interface ProcessableOutboxEvent {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  payload: unknown;
  createdAt: Date;
  scheduledFor: Date | null;
  correlationId?: string | null;
}

function getCorrelationId(event: ProcessableOutboxEvent): string | undefined {
  return event.correlationId ?? undefined;
}

function getVersionedPayload<
  T extends PostScheduledPayload | LongFormPostScheduledPayload,
>(
  event: ProcessableOutboxEvent
): {
  payload: T;
  version: string | undefined;
} {
  const versionResult = processPayloadWithVersion<T>(event.payload, {
    eventId: event.id,
    aggregateId: event.aggregateId,
  });

  if (!versionResult.success || !versionResult.payload) {
    throw new Error(versionResult.error ?? "Failed to process payload version");
  }

  return {
    payload: versionResult.payload,
    version: versionResult.version,
  };
}

function logPayloadMigration(params: {
  event: ProcessableOutboxEvent;
  postId: string;
  correlationId: string | undefined;
  version: string | undefined;
}): void {
  if (!params.version || params.version === CURRENT_VERSION) {
    return;
  }

  logInfo(
    "Processed payload with version migration",
    buildObsContext({
      postId: params.postId,
      outboxEventId: params.event.id,
      correlationId: params.correlationId,
      eventType: params.event.eventType,
    })
  );
  logInfo("Outbox payload schema migration details", {
    postId: params.postId,
    eventId: params.event.id,
    originalVersion: getPayloadVersion(params.event.payload),
    migratedVersion: params.version,
  });
}

async function enqueueScheduledEvent(params: {
  queueName:
    | typeof QUEUE_SCHEDULED_POSTS
    | typeof QUEUE_SCHEDULED_LONGFORM_POSTS;
  jobName: typeof JOB_PUBLISH_POST | typeof JOB_PUBLISH_LONGFORM_POST;
  event: ProcessableOutboxEvent;
  postId: string;
  userId: string;
  signedEvent: PostJobData["signedEvent"];
  scheduledFor: number;
  correlationId: string | undefined;
  duplicateLogMessage: string;
  successLogMessage: string;
  defaultErrorMessage: string;
  schemaVersion: string | undefined;
}): Promise<void> {
  const result = await queueClient.enqueue<PostJobData | LongFormPostJobData>(
    params.queueName,
    params.jobName,
    {
      postId: params.postId,
      userId: params.userId,
      signedEvent: params.signedEvent,
      correlationId: params.correlationId,
    },
    {
      scheduledFor: params.scheduledFor,
      jobId: params.postId,
    }
  );

  if (!result.success) {
    const errorMessage = result.error ?? params.defaultErrorMessage;
    if (isDuplicateJobIdError(errorMessage)) {
      logInfo(
        params.duplicateLogMessage,
        buildObsContext({
          postId: params.postId,
          outboxEventId: params.event.id,
          correlationId: params.correlationId,
          eventType: params.event.eventType,
          queueName: params.queueName,
          jobId: params.postId,
        })
      );
      return;
    }

    throw new Error(errorMessage);
  }

  logInfo(params.successLogMessage, {
    ...buildObsContext({
      postId: params.postId,
      outboxEventId: params.event.id,
      correlationId: params.correlationId,
      eventType: params.event.eventType,
      queueName: params.queueName,
      jobId: params.postId,
    }),
    schemaVersion: params.schemaVersion,
  });
}

async function handlePostScheduled(
  event: ProcessableOutboxEvent
): Promise<void> {
  const correlationId = getCorrelationId(event);
  const { payload, version } = getVersionedPayload<PostScheduledPayload>(event);

  logPayloadMigration({
    event,
    postId: payload.postId,
    correlationId: payload.correlationId ?? correlationId,
    version,
  });

  await enqueueScheduledEvent({
    queueName: QUEUE_SCHEDULED_POSTS,
    jobName: JOB_PUBLISH_POST,
    event,
    postId: payload.postId,
    userId: payload.userId,
    signedEvent: payload.signedEvent,
    scheduledFor: payload.scheduledFor,
    correlationId: payload.correlationId ?? correlationId,
    duplicateLogMessage:
      "Post job already enqueued; treating outbox as idempotent",
    successLogMessage: "Enqueued post job from outbox",
    defaultErrorMessage: "Failed to enqueue post job",
    schemaVersion: version,
  });
}

async function handleLongFormScheduled(
  event: ProcessableOutboxEvent
): Promise<void> {
  const correlationId = getCorrelationId(event);
  const { payload, version } =
    getVersionedPayload<LongFormPostScheduledPayload>(event);

  logPayloadMigration({
    event,
    postId: payload.postId,
    correlationId: payload.correlationId ?? correlationId,
    version,
  });

  await enqueueScheduledEvent({
    queueName: QUEUE_SCHEDULED_LONGFORM_POSTS,
    jobName: JOB_PUBLISH_LONGFORM_POST,
    event,
    postId: payload.postId,
    userId: payload.userId,
    signedEvent: payload.signedEvent,
    scheduledFor: payload.scheduledFor,
    correlationId: payload.correlationId ?? correlationId,
    duplicateLogMessage:
      "Longform job already enqueued; treating outbox as idempotent",
    successLogMessage: "Enqueued longform post job from outbox",
    defaultErrorMessage: "Failed to enqueue longform post job",
    schemaVersion: version,
  });
}

async function handleCancelledEvent(
  event: ProcessableOutboxEvent
): Promise<void> {
  const correlationId = getCorrelationId(event);
  const queueName =
    event.eventType === "POST_CANCELLED"
      ? QUEUE_SCHEDULED_POSTS
      : QUEUE_SCHEDULED_LONGFORM_POSTS;
  const cancelled = await queueClient.cancelByData(
    queueName,
    "postId",
    event.aggregateId
  );

  if (!cancelled) {
    return;
  }

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

function getDeleteSignerSecret(): string {
  const signerSecret = process.env["NOSTR_NSEC"]?.trim();
  if (!signerSecret) {
    throw new Error("NOSTR_NSEC not configured for delete event signing");
  }
  return signerSecret;
}

async function handlePostDeleteRequested(
  event: ProcessableOutboxEvent
): Promise<void> {
  const correlationId = getCorrelationId(event);
  const payload = parsePostDeleteRequestedPayload(event.payload);
  const signerSecret = getDeleteSignerSecret();

  const draft = buildPostKind5DeleteDraft(
    payload,
    Math.floor(event.createdAt.getTime() / 1000)
  );
  if (!draft) {
    throw new Error("Invalid delete payload: could not build kind5 draft");
  }

  const signerPubkey = nostrAdapter.getPublicKey(signerSecret);
  if (signerPubkey !== draft.expectedPubkey) {
    throw new Error("Delete signer pubkey mismatch");
  }

  const signedDeleteEvent = nostrAdapter.finalizeEvent(
    draft.unsignedEvent,
    signerSecret
  );
  const relays = await resolveExecutionRelays(payload.userId);

  logInfo("Publishing post delete request to relays", {
    ...buildObsContext({
      postId: payload.postId,
      userId: payload.userId,
      correlationId: payload.correlationId ?? correlationId,
      outboxEventId: event.id,
      eventType: event.eventType,
    }),
    targetEventId: payload.originalEventId,
    relayCount: relays.length,
  });

  const publishResult = await getNostrPublisher().publish(
    signedDeleteEvent,
    relays,
    payload.correlationId ?? correlationId
  );

  try {
    await persistPublishRelayAcks({
      publishAttemptId: `delete:${payload.postId}:${payload.originalEventId}`,
      userId: payload.userId,
      eventId: signedDeleteEvent.id,
      results: publishResult.results,
    });
  } catch (ackError) {
    logError(
      ackError instanceof Error ? ackError : new Error(String(ackError)),
      {
        ...buildObsContext({
          postId: payload.postId,
          userId: payload.userId,
          correlationId: payload.correlationId ?? correlationId,
          outboxEventId: event.id,
          eventType: event.eventType,
        }),
        message: "Failed to persist post delete relay ACKs",
      }
    );
  }

  logInfo("Published post delete request to relays", {
    ...buildObsContext({
      postId: payload.postId,
      userId: payload.userId,
      correlationId: payload.correlationId ?? correlationId,
      outboxEventId: event.id,
      eventType: event.eventType,
    }),
    deleteEventId: signedDeleteEvent.id,
  });
}

async function handleLongFormDeleteRequested(
  event: ProcessableOutboxEvent
): Promise<void> {
  const correlationId = getCorrelationId(event);
  const payload = parseLongFormDeleteRequestedPayload(event.payload);
  const signerSecret = getDeleteSignerSecret();

  const draft = buildLongFormKind5DeleteDraft(
    payload,
    Math.floor(event.createdAt.getTime() / 1000)
  );
  if (!draft) {
    throw new Error("Invalid delete payload: could not build kind5 draft");
  }

  const signerPubkey = nostrAdapter.getPublicKey(signerSecret);
  if (signerPubkey !== draft.expectedPubkey) {
    throw new Error("Delete signer pubkey mismatch");
  }

  const signedDeleteEvent = nostrAdapter.finalizeEvent(
    draft.unsignedEvent,
    signerSecret
  );
  const relays = await resolveExecutionRelays(payload.userId);

  logInfo("Publishing longform delete request to relays", {
    ...buildObsContext({
      postId: payload.postId,
      userId: payload.userId,
      correlationId: payload.correlationId ?? correlationId,
      outboxEventId: event.id,
      eventType: event.eventType,
    }),
    aCoordinate: payload.aCoordinate,
    relayCount: relays.length,
  });

  const publishResult = await getNostrPublisher().publish(
    signedDeleteEvent,
    relays,
    payload.correlationId ?? correlationId
  );

  try {
    await persistPublishRelayAcks({
      publishAttemptId: `delete:${payload.postId}:${payload.aCoordinate}`,
      userId: payload.userId,
      eventId: signedDeleteEvent.id,
      results: publishResult.results,
    });
  } catch (ackError) {
    logError(
      ackError instanceof Error ? ackError : new Error(String(ackError)),
      {
        ...buildObsContext({
          postId: payload.postId,
          userId: payload.userId,
          correlationId: payload.correlationId ?? correlationId,
          outboxEventId: event.id,
          eventType: event.eventType,
        }),
        message: "Failed to persist longform delete relay ACKs",
      }
    );
  }

  logInfo("Published longform delete request to relays", {
    ...buildObsContext({
      postId: payload.postId,
      userId: payload.userId,
      correlationId: payload.correlationId ?? correlationId,
      outboxEventId: event.id,
      eventType: event.eventType,
    }),
    deleteEventId: signedDeleteEvent.id,
  });
}

/**
 * Process a single outbox event
 */
async function processEvent(event: ProcessableOutboxEvent) {
  switch (event.eventType) {
    case "POST_SCHEDULED":
      await handlePostScheduled(event);
      break;
    case "LONGFORM_SCHEDULED":
      await handleLongFormScheduled(event);
      break;
    case "POST_CANCELLED":
    case "LONGFORM_CANCELLED":
      await handleCancelledEvent(event);
      break;
    case "POST_DELETE_REQUESTED":
      await handlePostDeleteRequested(event);
      break;
    case "LONGFORM_DELETE_REQUESTED":
      await handleLongFormDeleteRequested(event);
      break;

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
// eslint-disable-next-line sonarjs/cognitive-complexity -- Worker orchestration intentionally centralizes retry/finalization branches.
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
    const lockState = { refreshFailed: false };
    const heartbeat = setInterval(() => {
      void (async () => {
        const refreshed = await extendOutboxEventLock({
          eventId: event.id,
          lockId: lock.lockId,
          ttlMs: OUTBOX_LOCK_TTL_MS,
          now: new Date(),
        });
        if (!refreshed) {
          lockState.refreshFailed = true;
        }
      })();
    }, OUTBOX_LOCK_HEARTBEAT_MS);
    try {
      await processEvent({
        id: event.id,
        eventType: event.eventType as OutboxEventType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt,
        scheduledFor: event.scheduledFor,
        correlationId: event.correlationId ?? undefined,
      });
      if (lockState.refreshFailed) {
        throw new Error(
          `Outbox lock lost before finalize for event ${event.id}`
        );
      }
      const finalizeSucceeded = await markOutboxEventSucceeded({
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
        const movedToDlq = await deadLetterOutboxEvent({
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
        const movedToDlq = await deadLetterOutboxEvent({
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
        const markedForRetry = await markOutboxEventFailed({
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
      clearInterval(heartbeat);
    }
  }

  // Update backlog gauges (best-effort)
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
    // Best-effort: never fail outbox processing due to metrics.
  }

  return { processed, errors };
}

/**
 * Start the outbox worker (runs continuously)
 */
export function startOutboxWorker() {
  logInfo("Starting outbox worker", { pollInterval: POLL_INTERVAL_MS });
  let isProcessing = false;

  // Process immediately on start

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

  // Then process periodically
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
