/**
 * LongFormPost write/state commands: create, update, delete, publish.
 */

import type { LongFormPost, Prisma } from "@prisma/client";

import {
  calculateLongFormStatus,
  LongFormPostStateMachine,
} from "~/features/posts/server/longform";
import { logError, logInfo } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";

import {
  DEFAULT_DELETE_REASON,
  DELETE_EVENT_SCHEMA_VERSION,
  extractLongFormDeleteReference,
  isNostrDeleteEventsEnabled,
  isOutboxEventTypeConstraintError,
  toSignedEvent,
} from "./longformpost-shared.server";

// ============================================================================
// Update LongFormPost Helper Functions (command-only)
// ============================================================================

/** Convert scheduledAtUtc (Date | number | null) to Unix seconds string for internal use. */
function toScheduledAtUtcUnix(
  v: Date | number | null | undefined
): string | null | undefined {
  if (v == null) return v === null ? null : undefined;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return Math.floor(v.getTime() / 1000).toString();
  return undefined;
}

function extractScheduledForFromTags(
  scheduledAtUtcUnix: string | null | undefined,
  isPublished: boolean | undefined,
  signedEvent: unknown
): string | null | undefined {
  if (scheduledAtUtcUnix !== undefined) return scheduledAtUtcUnix;
  if (isPublished) return scheduledAtUtcUnix;
  if (
    !signedEvent ||
    typeof signedEvent !== "object" ||
    !("tags" in signedEvent)
  ) {
    return scheduledAtUtcUnix;
  }
  const tags = signedEvent["tags"];
  if (!Array.isArray(tags)) return scheduledAtUtcUnix;
  const publishedAtTag = tags.find(
    (tag: unknown): tag is string[] =>
      Array.isArray(tag) && tag[0] === "published_at"
  );
  if (publishedAtTag?.[1]) return String(publishedAtTag[1]);
  return scheduledAtUtcUnix;
}

function buildBasicUpdateData(
  title: string | null | undefined,
  summary: string | null | undefined,
  content: string | null | undefined,
  image: string | null | undefined,
  tags: string | null | undefined,
  finalScheduledFor: string | null | undefined
): Prisma.LongFormPostUpdateInput {
  const updateData: Prisma.LongFormPostUpdateInput = {
    updatedAt: new Date(),
  };

  if (title !== undefined) updateData.title = title;
  if (summary !== undefined) updateData.summary = summary;
  if (content !== undefined) updateData.content = content;
  if (image !== undefined) updateData.image = image;
  if (tags !== undefined && tags !== null) {
    const tagsArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateData.tags = tagsArray;
  }
  if (finalScheduledFor !== undefined) {
    const timestamp = finalScheduledFor ? parseInt(finalScheduledFor, 10) : NaN;
    updateData.scheduledAtUtc = !isNaN(timestamp)
      ? new Date(timestamp * 1000)
      : null;
  }

  return updateData;
}

function setQueueTypeUpdate(
  updateData: Prisma.LongFormPostUpdateInput,
  queueTypeId: string | null | undefined
): void {
  if (queueTypeId === undefined) {
    return;
  }
  if (queueTypeId === null) {
    updateData.queueType = { disconnect: true };
  } else {
    updateData.queueType = { connect: { id: queueTypeId } };
  }
}

function setEventData(
  updateData: Prisma.LongFormPostUpdateInput,
  signedEvent: unknown,
  nostrEvent: unknown
): void {
  if (signedEvent !== undefined) {
    updateData.signedEvent = signedEvent as Prisma.InputJsonValue;
    updateData.nostrEventId =
      signedEvent && typeof signedEvent === "object" && "id" in signedEvent
        ? String(signedEvent["id"])
        : null;
  }
  if (nostrEvent !== undefined) {
    updateData.nostrEvent = nostrEvent as Prisma.InputJsonValue;
  }
}

function getPublishedAtFromSignedEvent(signedEvent: unknown): Date {
  if (
    signedEvent &&
    typeof signedEvent === "object" &&
    "published_at" in signedEvent &&
    typeof signedEvent["published_at"] === "number"
  ) {
    return new Date(signedEvent["published_at"] * 1000);
  }
  return new Date();
}

/**
 * Create a new longform post in the database
 *
 * Note: This is a pure data access function. Status calculation
 * is done using calculateLongFormStatus() from the feature layer.
 */
export async function createLongFormPost({
  userId,
  title,
  summary,
  content,
  image,
  tags,
  isPublished = false,
  signedEvent,
  nostrEvent,
  scheduledAtUtc: scheduledAtUtcInput,
  queueTypeId,
  hashTagPresetId,
}: {
  userId: LongFormPost["userId"];
  title: LongFormPost["title"];
  summary?: LongFormPost["summary"];
  content: LongFormPost["content"];
  image?: LongFormPost["image"];
  tags?: LongFormPost["tags"];
  isPublished?: boolean;
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  /** When to publish (UTC). Date or Unix seconds. Null to clear. */
  scheduledAtUtc?: Date | number | null;
  queueTypeId?: LongFormPost["queueTypeId"];
  hashTagPresetId?: LongFormPost["hashTagPresetId"];
}) {
  const typedSignedEvent = signedEvent ? toSignedEvent(signedEvent) : null;
  const scheduledAtUtcUnix = toScheduledAtUtcUnix(scheduledAtUtcInput);

  const { status, publishedAt, nostrEventId, finalScheduledFor } =
    calculateLongFormStatus({
      isPublished,
      scheduledFor: scheduledAtUtcUnix,
      signedEvent: typedSignedEvent,
    });

  let scheduledAtUtc: Date | undefined;
  if (finalScheduledFor) {
    const timestamp = parseInt(finalScheduledFor, 10);
    if (!isNaN(timestamp)) scheduledAtUtc = new Date(timestamp * 1000);
  }

  // Determine initial state based on status calculation
  const initialState = isPublished
    ? "PUBLISHED"
    : finalScheduledFor
      ? "SCHEDULED"
      : "DRAFT";

  return prisma.longFormPost.create({
    data: {
      userId,
      title,
      summary,
      content,
      image,
      tags: tags ?? [],
      // Note: Flag fields (isPublished, isScheduled, draft) have been removed.
      // Use LongFormPostStateMachine.transition() to change state instead.
      signedEvent: signedEvent as Prisma.InputJsonValue,
      nostrEvent: nostrEvent as Prisma.InputJsonValue,
      nostrEventId,
      status,
      publishedAt,
      postedAt: initialState === "PUBLISHED" ? new Date() : null,
      scheduledAtUtc, // New DateTime field
      currentState: initialState, // Single source of truth
      queueTypeId,
      hashTagPresetId,
    },
  });
}

export async function updateLongFormPost({
  id,
  userId,
  title,
  summary,
  content,
  image,
  tags,
  isPublished,
  signedEvent,
  nostrEvent,
  scheduledAtUtc: scheduledAtUtcInput,
  queueTypeId,
  publishedAt: _publishedAt,
  status: _status,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
  title?: LongFormPost["title"];
  summary?: LongFormPost["summary"];
  content?: LongFormPost["content"];
  image?: LongFormPost["image"];
  tags?: LongFormPost["tags"];
  isPublished?: boolean;
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  /** When to publish (UTC). Date or Unix seconds. Null to clear. */
  scheduledAtUtc?: Date | number | null;
  queueTypeId?: LongFormPost["queueTypeId"];
  publishedAt?: Date | null;
  status?: LongFormPost["status"];
  hashTagPresetId?: string | null;
}) {
  const scheduledAtUtcUnix = toScheduledAtUtcUnix(scheduledAtUtcInput);
  const finalScheduledFor = extractScheduledForFromTags(
    scheduledAtUtcUnix,
    isPublished,
    signedEvent
  );

  const updateData = buildBasicUpdateData(
    title,
    summary,
    content,
    image,
    tags && typeof tags === "string" ? tags : null,
    finalScheduledFor
  );
  if (scheduledAtUtcInput !== undefined || queueTypeId !== undefined) {
    updateData.queueHoldStatus = "NONE";
    updateData.queueHeldAtUtc = null;
    updateData.queueHeldOriginalScheduledAtUtc = null;
    updateData.queueHeldByQueueTypeId = null;
  }

  setQueueTypeUpdate(updateData, queueTypeId);
  setEventData(updateData, signedEvent, nostrEvent);

  // Handle state transitions using state machine if state needs to change
  if (isPublished !== undefined || finalScheduledFor !== undefined) {
    const finalIsPublished = isPublished ?? false;
    const isScheduled = Boolean(finalScheduledFor && !finalIsPublished);

    // Determine target state
    const targetState = finalIsPublished
      ? "PUBLISHED"
      : isScheduled
        ? "SCHEDULED"
        : "DRAFT";

    // Use state machine to transition state
    const stateMachine = new LongFormPostStateMachine();
    await stateMachine.transition(
      id,
      userId,
      targetState,
      finalIsPublished
        ? "Longform post published"
        : isScheduled
          ? "Longform post scheduled"
          : "Longform post saved as draft"
    );

    // Update status and dates based on state
    if (finalIsPublished) {
      updateData.status = "ACTIVE";
      updateData.publishedAt = getPublishedAtFromSignedEvent(signedEvent);
      updateData.postedAt = new Date();
    } else if (isScheduled && finalScheduledFor) {
      updateData.status = "SCHEDULED";
      updateData.publishedAt = new Date(parseInt(finalScheduledFor) * 1000);
    } else {
      updateData.status = "DRAFT";
    }
  }

  return prisma.longFormPost.update({
    where: { id, userId },
    data: updateData,
  });
}

export async function deleteLongFormPost({
  id,
  userId,
  correlationId,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
  correlationId?: string;
}): Promise<LongFormPost | null> {
  // Check if post exists before attempting to delete
  const existingPost = await prisma.longFormPost.findUnique({
    where: {
      id,
      userId,
    },
  });

  // If post doesn't exist, return null instead of throwing
  if (!existingPost) {
    return null;
  }

  const deleteRef = extractLongFormDeleteReference(existingPost);

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.longFormPost.delete({
        where: { id, userId },
      });

      const { createOutboxEventInTransaction } =
        await import("~/infra/outbox/outbox.server");

      await createOutboxEventInTransaction(
        tx as Prisma.TransactionClient,
        "LONGFORM_DELETED",
        row.id,
        "LongFormPost",
        { postId: row.id, userId: row.userId },
        undefined,
        undefined,
        correlationId
      );

      if (isNostrDeleteEventsEnabled() && deleteRef) {
        try {
          await createOutboxEventInTransaction(
            tx as Prisma.TransactionClient,
            "LONGFORM_DELETE_REQUESTED",
            row.id,
            "LongFormPost",
            {
              postId: row.id,
              userId: row.userId,
              originalEventId: deleteRef.originalEventId,
              originalEventPubkey: deleteRef.originalEventPubkey,
              aCoordinate: deleteRef.aCoordinate,
              reason: DEFAULT_DELETE_REASON,
              schemaVersion: DELETE_EVENT_SCHEMA_VERSION,
              correlationId,
            },
            undefined,
            undefined,
            correlationId
          );
        } catch (error) {
          if (isOutboxEventTypeConstraintError(error)) {
            logInfo(
              "Skipping LONGFORM_DELETE_REQUESTED outbox event: DB constraint not yet updated",
              { postId: row.id, userId: row.userId, correlationId }
            );
          } else {
            throw error;
          }
        }
      }

      return row;
    });

    if (isNostrDeleteEventsEnabled()) {
      if (!deleteRef) {
        logInfo(
          "Skipping LONGFORM_DELETE_REQUESTED outbox event: missing metadata",
          { postId: deleted.id, userId: deleted.userId, correlationId }
        );
      }
    }

    return deleted;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to delete longform post and emit outbox events",
      postId: id,
      userId,
      correlationId,
    });
    throw error;
  }
}

export async function publishLongFormPost({
  id,
  userId,
  signedEvent,
  nostrEvent,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
  signedEvent: LongFormPost["signedEvent"];
  nostrEvent: LongFormPost["nostrEvent"];
}) {
  const nostrEventId =
    signedEvent &&
    typeof signedEvent === "object" &&
    "id" in signedEvent &&
    typeof signedEvent["id"] === "string"
      ? signedEvent["id"]
      : null;

  const publishAttemptId =
    signedEvent &&
    typeof signedEvent === "object" &&
    "created_at" in signedEvent &&
    typeof signedEvent["created_at"] === "number"
      ? generatePublishAttemptId(id, signedEvent["created_at"], 0)
      : null;

  const stateMachine = new LongFormPostStateMachine();
  await stateMachine.transition(
    id,
    userId,
    "PUBLISHED",
    "Longform post published",
    {
      additionalPostData: {
        status: "ACTIVE",
        publishedAt: new Date(),
        postedAt: new Date(),
        nostrEventId,
        publishAttemptId,
        signedEvent: signedEvent as Prisma.InputJsonValue,
        nostrEvent: nostrEvent as Prisma.InputJsonValue,
        publishingLockId: null,
        publishingLockExpiresAt: null,
      },
    }
  );

  const updated = await prisma.longFormPost.findUnique({
    where: { id, userId },
  });
  if (!updated) {
    throw new Error(`LongFormPost ${id} not found for user ${userId}`);
  }
  return updated;
}
