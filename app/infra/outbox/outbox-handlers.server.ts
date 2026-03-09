/**
 * Outbox event handlers: POST_SCHEDULED, LONGFORM_SCHEDULED, CANCELLED, DELETE_REQUESTED.
 * Used by the outbox worker; processOutboxEvent() dispatches by event type.
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
import { env } from "~/lib/env.server";
import { logInfo } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";
import { buildObsContext } from "~/lib/observability-context.server";

import { queueClient } from "../queue/queue-client.server";
import type { PostJobData, LongFormPostJobData } from "../queue/queue-types";

import type {
  PostScheduledPayload,
  LongFormPostScheduledPayload,
  PostDeleteRequestedPayload,
  LongFormDeleteRequestedPayload,
  OutboxEventType,
} from "./outbox.server";

const QUEUE_SCHEDULED_POSTS = "scheduled-posts" as const;
const QUEUE_SCHEDULED_LONGFORM_POSTS = "scheduled-longform-posts" as const;
const JOB_PUBLISH_POST = "publish-post" as const;
const JOB_PUBLISH_LONGFORM_POST = "publish-longform-post" as const;

export interface ProcessableOutboxEvent {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  payload: unknown;
  createdAt: Date;
  scheduledFor: Date | null;
  correlationId?: string | null;
}

export function isDefinitelyNonRetryableOutboxError(error: Error): boolean {
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

function isDuplicateJobIdError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("job") &&
    (m.includes("already exists") ||
      m.includes("exists already") ||
      m.includes("duplicat"))
  );
}

function getCorrelationId(event: ProcessableOutboxEvent): string | undefined {
  return event.correlationId ?? undefined;
}

function getVersionedPayload<
  T extends PostScheduledPayload | LongFormPostScheduledPayload,
>(event: ProcessableOutboxEvent): { payload: T; version: string | undefined } {
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

function getDeleteSignerSecret(): string {
  const signerSecret = env.NOSTR_NSEC?.trim();
  if (!signerSecret) {
    throw new Error("NOSTR_NSEC not configured for delete event signing");
  }
  return signerSecret;
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
    const { logError } = await import("~/lib/error-logger.server");
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
    const { logError } = await import("~/lib/error-logger.server");
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
 * Process a single outbox event (dispatches by event type).
 */
export async function processOutboxEvent(
  event: ProcessableOutboxEvent
): Promise<void> {
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

    case "POST_CREATED":
    case "POST_UPDATED":
    case "POST_PUBLISHED":
    case "POST_DELETED":
    case "LONGFORM_CREATED":
    case "LONGFORM_UPDATED":
    case "LONGFORM_PUBLISHED":
    case "LONGFORM_DELETED":
      break;

    default: {
      const _exhaustiveCheck: never = event.eventType;
      throw new Error(`Unknown event type: ${_exhaustiveCheck as string}`);
    }
  }
}
