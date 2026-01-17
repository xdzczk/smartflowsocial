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
import { prisma } from "~/lib/prisma.server";

export type { LongFormPost } from "@prisma/client";

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
      scheduledFor: finalScheduledFor, // Legacy field
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
  if (finalScheduledFor !== undefined)
    updateData.scheduledFor = finalScheduledFor;

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
}: {
  id: LongFormPost["id"];
  userId: LongFormPost["userId"];
}) {
  return prisma.longFormPost.delete({
    where: { id, userId },
  });
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
  return prisma.longFormPost.update({
    where: { id, userId },
    data: {
      // Note: Flag fields (isPublished) have been removed.
      // Use LongFormPostStateMachine.transition() to change state instead.
      status: "ACTIVE",
      publishedAt: new Date(),
      currentState: "PUBLISHED", // Single source of truth
      signedEvent: signedEvent as Prisma.InputJsonValue,
      nostrEvent: nostrEvent as Prisma.InputJsonValue,
      nostrEventId:
        signedEvent &&
        typeof signedEvent === "object" &&
        "id" in signedEvent &&
        typeof signedEvent["id"] === "string"
          ? signedEvent["id"]
          : null,
    },
  });
}

export async function getDraftLongFormPosts({
  userId,
}: {
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: {
      userId,
      // Use currentState as single source of truth
      currentState: "DRAFT",
    },
    include: {
      queueType: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPublishedLongFormPosts({
  userId,
  page = 1,
  limit = 10,
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
        currentState: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.longFormPost.count({
      where: {
        userId,
        // Use currentState as single source of truth
        currentState: "PUBLISHED",
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

export async function getScheduledLongFormPosts({
  userId,
}: {
  userId: User["id"];
}) {
  return prisma.longFormPost.findMany({
    where: {
      userId,
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
    },
    include: {
      queueType: true,
    },
    orderBy: { scheduledAtUtc: "asc" },
  });
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
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
  queueType?: string;
}): Promise<LongFormPost[]> {
  const whereClause: Prisma.LongFormPostWhereInput = {
    userId,
    // Use currentState as single source of truth
    currentState: "PUBLISHED",
    // Check both postedAt and publishedAt for date filtering
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
  };

  // Add queue type filter if specified
  if (queueType && queueType !== "all") {
    whereClause.queueType = {
      name: queueType,
    };
  }

  return prisma.longFormPost.findMany({
    where: whereClause,
    include: {
      queueType: true,
    },
    orderBy: {
      postedAt: "desc",
    },
  });
}
