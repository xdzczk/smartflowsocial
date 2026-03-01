/**
 * LongFormPost Model - Database Access Layer
 *
 * This module provides pure database access operations for LongFormPost entities.
 * It contains ONLY Prisma queries and data persistence operations.
 *
 * **What belongs here:**
 * - CRUD operations (create, read, update, delete)
 * - Database queries with filters, pagination, sorting
 * - Data aggregation queries
 * - Prisma transactions
 *
 * **What does NOT belong here:**
 * - Business logic or workflows
 * - Status determination logic
 * - PublishedAt calculation logic
 * - Permission checks or authorization
 * - Plan enforcement or subscription validation
 *
 * For business logic, see: app/features/posts/
 */

import type { LongFormPost, User, Prisma } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { calculateLongFormStatus } from "~/features/posts/server";
import { LongFormPostStateMachine } from "~/features/posts/state-machine/longform-post-state-machine.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import { generatePublishAttemptId } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";

export type { LongFormPost } from "@prisma/client";

const DELETE_EVENT_SCHEMA_VERSION = "1.0";
const DEFAULT_DELETE_REASON = "Deleted via SmartFlow";

function isNostrDeleteEventsEnabled(): boolean {
  const raw = process.env["ENABLE_NOSTR_DELETE_EVENTS"];
  if (!raw) return false;
  return ["1", "true", "yes", "y", "on", "enabled"].includes(
    raw.trim().toLowerCase()
  );
}

function isOutboxEventTypeConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.message.includes("OutboxEvent_eventType_check")) {
    return true;
  }
  const errWithCause = error as Error & {
    cause?: { originalCode?: string; message?: string };
  };
  const cause = errWithCause.cause;
  if (!cause) {
    return false;
  }
  return (
    cause.originalCode === "23514" &&
    String(cause.message ?? "").includes("OutboxEvent_eventType_check")
  );
}

/**
 * Type guard to check if a value is a SignedEvent
 */
function isSignedEvent(value: unknown): value is SignedEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  if (
    !("id" in event) ||
    !("pubkey" in event) ||
    !("created_at" in event) ||
    !("kind" in event) ||
    !("tags" in event) ||
    !("content" in event) ||
    !("sig" in event)
  ) {
    return false;
  }

  return (
    typeof event["id"] === "string" &&
    typeof event["pubkey"] === "string" &&
    typeof event["created_at"] === "number" &&
    typeof event["kind"] === "number" &&
    Array.isArray(event["tags"]) &&
    typeof event["content"] === "string" &&
    typeof event["sig"] === "string"
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

function extractLongFormDeleteReference(post: {
  signedEvent: Prisma.JsonValue | null;
  nostrEvent: Prisma.JsonValue | null;
  nostrEventId: string | null;
}): {
  originalEventPubkey: string;
  originalEventId?: string;
  aCoordinate: string;
} | null {
  const signed = toSignedEvent(post.signedEvent);
  const rawNostr =
    post.nostrEvent && typeof post.nostrEvent === "object"
      ? (post.nostrEvent as { id?: unknown; pubkey?: unknown; tags?: unknown })
      : null;
  const pubkey =
    signed?.pubkey ??
    (rawNostr && typeof rawNostr.pubkey === "string" ? rawNostr.pubkey : null);
  if (!pubkey) return null;

  const tags = Array.isArray(signed?.tags)
    ? signed.tags
    : Array.isArray(rawNostr?.tags)
      ? (rawNostr.tags as unknown[])
      : [];
  const dTagEntry = tags.find(
    (tag): tag is string[] =>
      Array.isArray(tag) &&
      tag.length >= 2 &&
      tag[0] === "d" &&
      typeof tag[1] === "string" &&
      tag[1].trim().length > 0
  );
  if (!dTagEntry?.[1]) return null;

  const originalEventId =
    signed?.id ??
    (rawNostr && typeof rawNostr.id === "string" ? rawNostr.id : null) ??
    post.nostrEventId ??
    undefined;

  return {
    originalEventPubkey: pubkey,
    originalEventId,
    aCoordinate: `30023:${pubkey}:${dTagEntry[1]}`,
  };
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
  scheduledFor,
  queueTypeId,
  hashTagPresetId,
}: {
  userId: LongFormPost["userId"];
  title: LongFormPost["title"];
  summary?: LongFormPost["summary"];
  content: LongFormPost["content"];
  image?: LongFormPost["image"];
  tags?: LongFormPost["tags"];
  isPublished?: boolean; // Parameter kept for backward compatibility, but flags removed from schema
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  scheduledFor?: string | null;
  queueTypeId?: LongFormPost["queueTypeId"];
  hashTagPresetId?: LongFormPost["hashTagPresetId"];
}) {
  // Calculate status and related fields using business logic from feature layer
  // Convert Prisma JsonValue to SignedEvent type
  const typedSignedEvent = signedEvent ? toSignedEvent(signedEvent) : null;

  const { status, publishedAt, nostrEventId, finalScheduledFor } =
    calculateLongFormStatus({
      isPublished,
      scheduledFor,
      signedEvent: typedSignedEvent,
    });

  // Convert scheduledFor string to DateTime for new field
  let scheduledAtUtc: Date | undefined;
  if (finalScheduledFor) {
    const timestamp = parseInt(finalScheduledFor, 10);
    if (!isNaN(timestamp)) {
      scheduledAtUtc = new Date(timestamp * 1000);
    }
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

// ============================================================================
// Update LongFormPost Helper Functions
// ============================================================================

function extractScheduledForFromTags(
  scheduledFor: string | null | undefined,
  isPublished: boolean | undefined,
  signedEvent: unknown
): string | null | undefined {
  if (scheduledFor !== undefined) {
    return scheduledFor;
  }
  if (isPublished) {
    return scheduledFor;
  }
  if (
    !signedEvent ||
    typeof signedEvent !== "object" ||
    !("tags" in signedEvent)
  ) {
    return scheduledFor;
  }
  const tags = signedEvent["tags"];
  if (!Array.isArray(tags)) {
    return scheduledFor;
  }
  const publishedAtTag = tags.find(
    (tag: unknown): tag is string[] =>
      Array.isArray(tag) && tag[0] === "published_at"
  );
  if (publishedAtTag && Array.isArray(publishedAtTag) && publishedAtTag[1]) {
    return String(publishedAtTag[1]);
  }
  return scheduledFor;
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
    // scheduledFor legacy column removed; store only scheduledAtUtc
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
  scheduledFor,
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
  isPublished?: boolean; // Parameter kept for backward compatibility, but flags removed from schema
  signedEvent?: LongFormPost["signedEvent"];
  nostrEvent?: LongFormPost["nostrEvent"];
  scheduledFor?: string | null;
  queueTypeId?: LongFormPost["queueTypeId"];
  publishedAt?: Date | null;
  status?: LongFormPost["status"];
  hashTagPresetId?: string | null;
}) {
  const finalScheduledFor = extractScheduledForFromTags(
    scheduledFor,
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

export async function getLongFormPost({
  id,
  userId,
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
}) {
  return prisma.longFormPost.findFirst({
    where: { id, userId },
    include: {
      queueType: true,
    },
  });
}

export async function getLongFormPostByEventId({
  nostrEventId,
  userId,
}: {
  nostrEventId: LongFormPost["nostrEventId"];
  userId: LongFormPost["userId"];
}) {
  if (!nostrEventId) return null;

  return prisma.longFormPost.findFirst({
    where: { nostrEventId, userId },
  });
}

export async function getUserLongFormPosts({
  userId,
  isPublished,
  page = 1,
  limit = 10,
}: {
  userId: LongFormPost["userId"];
  isPublished?: boolean;
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const where: Prisma.LongFormPostWhereInput = { userId };
  if (isPublished !== undefined) {
    // Use currentState as single source of truth
    where.currentState = isPublished ? "PUBLISHED" : { not: "PUBLISHED" };
  }

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({ where }),
  ]);

  return {
    posts,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
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

      // @ts-ignore - Dynamic imports work at runtime in CommonJS
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

      return row;
    });

    if (isNostrDeleteEventsEnabled()) {
      if (!deleteRef) {
        logInfo(
          "Skipping LONGFORM_DELETE_REQUESTED outbox event: missing metadata",
          { postId: deleted.id, userId: deleted.userId, correlationId }
        );
      } else {
        try {
          // @ts-ignore - Dynamic imports work at runtime in CommonJS
          const { createOutboxEvent } =
            await import("~/infra/outbox/outbox.server");
          await createOutboxEvent(
            "LONGFORM_DELETE_REQUESTED",
            deleted.id,
            "LongFormPost",
            {
              postId: deleted.id,
              userId: deleted.userId,
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
              { postId: deleted.id, userId: deleted.userId, correlationId }
            );
          } else {
            logError(
              error instanceof Error ? error : new Error(String(error)),
              {
                message:
                  "Failed to enqueue LONGFORM_DELETE_REQUESTED outbox event (post already deleted)",
                postId: deleted.id,
                userId: deleted.userId,
                correlationId,
              }
            );
          }
        }
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

export async function getDraftLongFormPosts({
  userId,
  page = 1,
  limit = 20,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where: {
        userId,
        // Use currentState as single source of truth
        currentState: "DRAFT",
      },
      include: {
        queueType: true,
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({
      where: {
        userId,
        // Use currentState as single source of truth
        currentState: "DRAFT",
      },
    }),
  ]);

  return {
    posts,
    pagination: {
      currentPage: page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getPublishedLongFormPosts({
  userId,
  page = 1,
  limit = 10,
  publishedFromUtc,
  publishedToUtc,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
  /** Filter by published date range (inclusive). Used for Published page date filter. */
  publishedFromUtc?: Date;
  publishedToUtc?: Date;
}) {
  const skip = (page - 1) * limit;

  const where: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "PUBLISHED",
  };
  if (publishedFromUtc !== undefined || publishedToUtc !== undefined) {
    where.publishedAt = {
      ...(publishedFromUtc !== undefined && { gte: publishedFromUtc }),
      ...(publishedToUtc !== undefined && { lte: publishedToUtc }),
    };
  }

  const [posts, total] = await Promise.all([
    prisma.longFormPost.findMany({
      where,
      include: { queueType: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({ where }),
  ]);

  return {
    posts,
    pagination: {
      currentPage: page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getScheduledLongFormPosts({
  userId,
  page = 1,
  limit = 20,
  since,
  afterScheduledAtUtc,
  queueType,
  scheduledFromUtc,
  scheduledToUtc,
}: {
  userId: User["id"];
  page?: number;
  limit?: number;
  since?: number; // Unix timestamp in milliseconds for delta sync
  /** When set, return only posts with scheduledAtUtc > this date (for cursor-based load more). */
  afterScheduledAtUtc?: Date;
  queueType?: string;
  /** Filter by scheduled date range (inclusive). Used for Scheduled page date filter. */
  scheduledFromUtc?: Date;
  scheduledToUtc?: Date;
}) {
  try {
    const skip = afterScheduledAtUtc ? 0 : (page - 1) * limit;

    const where: Prisma.LongFormPostWhereInput = {
      userId,
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
    };

    // Add delta sync filter if since timestamp is provided
    if (since !== undefined) {
      const sinceDate = new Date(since);
      where.updatedAt = {
        gte: sinceDate,
      };
    }

    // Cursor-based: only posts after this date (for Flow load more future)
    if (afterScheduledAtUtc !== undefined) {
      where.scheduledAtUtc = {
        gt: afterScheduledAtUtc,
      };
    }

    // Date range filter (Scheduled page): inclusive [scheduledFromUtc, scheduledToUtc]
    if (scheduledFromUtc !== undefined || scheduledToUtc !== undefined) {
      where.scheduledAtUtc = {
        ...(where.scheduledAtUtc as Prisma.DateTimeFilter),
        ...(scheduledFromUtc !== undefined && { gte: scheduledFromUtc }),
        ...(scheduledToUtc !== undefined && { lte: scheduledToUtc }),
      };
    }

    // Add queue type filter if specified ("unassigned" = no queue, else filter by queue name)
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        where.queueTypeId = null;
      } else {
        where.queueType = { name: queueType };
      }
    }

    const [posts, total] = await Promise.all([
      prisma.longFormPost.findMany({
        where,
        include: {
          queueType: true,
        },
        orderBy: { scheduledAtUtc: "asc" },
        skip,
        take: limit,
      }),
      prisma.longFormPost.count({ where }),
    ]);

    return {
      posts,
      pagination: {
        currentPage: page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching scheduled longform posts",
      userId,
    });
    return {
      posts: [],
      pagination: {
        currentPage: 1,
        limit,
        total: 0,
        pages: 0,
      },
    };
  }
}

/**
 * Returns longform posts (scheduled and published) with scheduledAtUtc in the given UTC range (inclusive).
 * Used for Next 7 days schedule overview: shows both upcoming and past posts per day.
 * Respects queueType filter.
 */
export async function getScheduledLongFormPostsInDateRange({
  userId,
  queueType,
  fromUtc,
  toUtc,
}: {
  userId: string;
  queueType?: string;
  fromUtc: Date;
  toUtc: Date;
}): Promise<
  Array<{
    scheduledAtUtc: Date | null;
    queueType: { name: string } | null;
  }>
> {
  try {
    const where: Prisma.LongFormPostWhereInput = {
      userId,
      currentState: { in: ["SCHEDULED", "PUBLISHED"] },
      scheduledAtUtc: {
        gte: fromUtc,
        lte: toUtc,
      },
    };
    if (queueType && queueType !== "all") {
      if (queueType === "unassigned") {
        where.queueTypeId = null;
      } else {
        where.queueType = { name: queueType };
      }
    }
    return await prisma.longFormPost.findMany({
      where,
      select: {
        scheduledAtUtc: true,
        queueType: { select: { name: true } },
      },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching scheduled longform posts in date range",
      userId,
    });
    return [];
  }
}

/**
 * Returns the latest scheduledAtUtc among future scheduled longform posts (for runway KPI).
 * Respects queueType filter; use queueType "all" for no filter.
 */
export async function getLatestScheduledLongFormAtUtc({
  userId,
  queueType = "all",
  now,
}: {
  userId: User["id"];
  queueType?: string;
  now: Date;
}): Promise<Date | null> {
  const where: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "SCHEDULED",
    scheduledAtUtc: { gt: now },
  };
  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      where.queueTypeId = null;
    } else {
      where.queueType = { name: queueType };
    }
  }
  const post = await prisma.longFormPost.findFirst({
    where,
    orderBy: { scheduledAtUtc: "desc" },
    select: { scheduledAtUtc: true },
  });
  return post?.scheduledAtUtc ?? null;
}

export async function getLongFormPostsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
  });
}

export function getCronDueScheduledLongFormPosts(): Promise<LongFormPost[]> {
  const now = new Date();
  return prisma.longFormPost.findMany({
    where: {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      scheduledAtUtc: {
        lte: now,
      },
    },
  });
}

export function getPastLongFormPosts({
  userId,
  startDate,
  endDate,
  queueType,
  beforeDate,
  limit: takeLimit,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
  /** When set, return only posts with postedAt < beforeDate (for Flow load more past). */
  beforeDate?: Date;
  /** Max number of posts to return (for Flow load more past). */
  limit?: number;
}): Promise<LongFormPost[]> {
  const whereClause: Prisma.LongFormPostWhereInput = {
    userId,
    currentState: "PUBLISHED",
    ...(beforeDate
      ? {
          OR: [
            {
              postedAt: { gte: startDate, lt: beforeDate, not: null },
            },
            {
              publishedAt: { gte: startDate, lt: beforeDate, not: null },
            },
          ],
        }
      : {
          OR: [
            {
              postedAt: {
                gte: startDate,
                lte: endDate,
                not: null,
              },
            },
            {
              publishedAt: {
                gte: startDate,
                lte: endDate,
                not: null,
              },
            },
          ],
        }),
  };

  if (queueType && queueType !== "all") {
    if (queueType === "unassigned") {
      whereClause.queueTypeId = null;
    } else {
      whereClause.queueType = { name: queueType };
    }
  }

  return prisma.longFormPost.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
    },
    ...(takeLimit !== undefined ? { take: takeLimit } : {}),
  });
}

export interface LongFormStatistics {
  scheduledCount: number;
  successCount: number;
}

export interface ScheduledLongFormCountByQueueRow {
  queueTypeId: string | null;
  count: number;
}

export async function getScheduledLongFormCountByQueue({
  userId,
}: {
  userId: string;
}): Promise<ScheduledLongFormCountByQueueRow[]> {
  try {
    const rows = await prisma.longFormPost.groupBy({
      by: ["queueTypeId"],
      where: {
        userId,
        currentState: "SCHEDULED",
      },
      _count: { id: true },
    });
    return rows.map((r) => ({
      queueTypeId: r.queueTypeId,
      count: r._count.id,
    }));
  } catch {
    return [];
  }
}

export async function getLongFormStatistics({
  userId,
}: {
  userId: string;
}): Promise<LongFormStatistics> {
  try {
    const [scheduledCount, successCount] = await Promise.all([
      prisma.longFormPost.count({
        where: {
          userId,
          currentState: "SCHEDULED",
        },
      }),
      prisma.longFormPost.count({
        where: {
          userId,
          currentState: "PUBLISHED",
        },
      }),
    ]);
    return { scheduledCount, successCount };
  } catch {
    return { scheduledCount: 0, successCount: 0 };
  }
}
