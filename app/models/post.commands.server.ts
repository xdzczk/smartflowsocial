/**
 * Post Model - Command Operations (Writes)
 *
 * This module provides write operations for Post entities.
 * All functions in this file perform INSERT, UPDATE, or DELETE operations.
 */

import { Prisma, type Post } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import { logError } from "~/lib/error-logger.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";

import type { CreatePostData } from "./post.types";

/**
 * Convert scheduledFor (string or Date) to DateTime
 */
function convertScheduledForToDateTime(
  scheduledFor?: Date | string | number | null
): Date | undefined {
  if (!scheduledFor) return undefined;

  if (scheduledFor instanceof Date) {
    return scheduledFor;
  }

  if (typeof scheduledFor === "number") {
    // Assume Unix timestamp in seconds
    return new Date(scheduledFor * 1000);
  }

  if (typeof scheduledFor === "string") {
    const timestamp = parseInt(scheduledFor, 10);
    if (!isNaN(timestamp)) {
      // Assume Unix timestamp in seconds
      return new Date(timestamp * 1000);
    }
  }

  return undefined;
}

/**
 * Create a new post in the database
 *
 * Note: This is a pure data access function. For best practices,
 * resolve queueTypeId in the feature layer before calling this function.
 * Use resolveQueueTypeId() from app/features/posts/services/queue-type-resolver.server.ts
 *
 * This function supports dual-write: writes to both scheduledFor (string) and scheduledAtUtc (DateTime)
 * for backward compatibility during migration period.
 */
export function createPost(data: CreatePostData): Promise<Post> {
  const {
    userId,
    content,
    postedAt,
    fileUrl,
    scheduledFor,
    nostrEventId,
    signedEvent,
    nostrEvent,
    postType,
    tags,
    caption,
    manual_override,
    queueTypeId,
    repost,
    isQuotedPost,
    isRecyclable,
    hashTagPresetId,
    creationIdempotencyKey,
  } = data;

  // Convert scheduledFor to DateTime for new field
  const scheduledAtUtc = convertScheduledForToDateTime(scheduledFor);

  // Determine initial state based on whether scheduledFor is provided
  const initialState = scheduledFor ? "SCHEDULED" : "DRAFT";

  return prisma.post.create({
    data: {
      content,
      fileUrl,
      scheduledAtUtc, // New DateTime field
      nostrEventId,
      signedEvent,
      nostrEvent,
      postType,
      postedAt,
      caption,
      tags,
      manual_override: manual_override ?? false,
      currentState: initialState, // Single source of truth
      repost: repost ?? false,
      isQuotedPost: isQuotedPost ?? false,
      isRecyclable: isRecyclable ?? false,
      creationIdempotencyKey,
      user: {
        connect: {
          id: userId,
        },
      },
      ...(queueTypeId && {
        queueType: {
          connect: {
            id: queueTypeId,
          },
        },
      }),
      ...(hashTagPresetId && {
        hashTagPreset: {
          connect: {
            id: hashTagPresetId,
          },
        },
      }),
    },
  });
}

/**
 * Create a post with an outbox event in a single transaction
 * This ensures atomicity: if post creation succeeds, outbox event is created
 * The outbox worker will later enqueue the job into BullMQ
 */
export async function createPostWithOutbox(
  data: CreatePostData,
  scheduledForUnix?: number,
  correlationId?: string
): Promise<Post> {
  const { userId, signedEvent, creationIdempotencyKey } = data;

  return prisma.$transaction(async (tx) => {
    // Determine initial state based on whether scheduledFor is provided
    const initialState = data.scheduledFor ? "SCHEDULED" : "DRAFT";

    // Create post
    const post = await tx.post.create({
      data: {
        content: data.content,
        fileUrl: data.fileUrl,
        scheduledAtUtc: convertScheduledForToDateTime(data.scheduledFor),
        nostrEventId: data.nostrEventId,
        signedEvent: data.signedEvent,
        nostrEvent: data.nostrEvent,
        postType: data.postType,
        postedAt: data.postedAt,
        caption: data.caption,
        tags: data.tags,
        manual_override: data.manual_override ?? false,
        currentState: initialState, // Single source of truth
        repost: data.repost ?? false,
        isQuotedPost: data.isQuotedPost ?? false,
        isRecyclable: data.isRecyclable ?? false,
        creationIdempotencyKey,
        user: {
          connect: {
            id: userId,
          },
        },
        ...(data.queueTypeId && {
          queueType: {
            connect: {
              id: data.queueTypeId,
            },
          },
        }),
        ...(data.hashTagPresetId && {
          hashTagPreset: {
            connect: {
              id: data.hashTagPresetId,
            },
          },
        }),
      },
    });

    // Record an initial transition for audit/history.
    // Use a no-op transition (STATE -> STATE) to avoid inventing an invalid "NONE" state.
    await tx.postStateTransition.create({
      data: {
        postId: post.id,
        fromState: initialState,
        toState: initialState,
        reason:
          initialState === "SCHEDULED"
            ? "Post created with schedule"
            : "Post created as draft",
      },
    });

    // Create read model event for post creation
    // @ts-ignore - Dynamic imports work at runtime in CommonJS
    const { createOutboxEventInTransaction } =
      await import("~/infra/outbox/outbox.server");
    await createOutboxEventInTransaction(
      tx as Prisma.TransactionClient,
      "POST_CREATED",
      post.id,
      "Post",
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial payload for read model events
      { postId: post.id, userId: post.userId } as PostScheduledPayload,
      undefined,
      undefined,
      correlationId
    );

    // If scheduled and has signed event, create outbox event
    if (scheduledForUnix && signedEvent && data.scheduledFor) {
      const scheduledAtUtc = new Date(scheduledForUnix * 1000);
      const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
        post.id,
        scheduledForUnix
      );

      const payload: PostScheduledPayload = {
        postId: post.id,
        userId,
        signedEvent,
        scheduledFor: scheduledForUnix,
        schemaVersion: "1.0",
        correlationId,
      };

      await createOutboxEventInTransaction(
        tx as Prisma.TransactionClient,
        "POST_SCHEDULED",
        post.id,
        "Post",
        payload,
        scheduledAtUtc,
        enqueueIdempotencyKey,
        correlationId
      );
    }

    return post;
  });
}

export async function deletePost({
  id,
  userId,
  correlationId,
}: {
  id: string;
  userId: string;
  correlationId?: string;
}): Promise<Post> {
  const post = await prisma.post.delete({
    where: {
      id,
      userId,
    },
  });

  // Emit POST_DELETED event for read model cleanup
  // @ts-ignore - Dynamic imports work at runtime in CommonJS
  const { createOutboxEvent } = await import("~/infra/outbox/outbox.server");
  void createOutboxEvent(
    "POST_DELETED",
    post.id,
    "Post",
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial payload for read model events
    { postId: post.id, userId: post.userId } as PostScheduledPayload,
    undefined,
    undefined,
    correlationId
    // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Fire-and-forget pattern
  ).catch((error) => {
    // Log but don't throw - read model updates shouldn't block writes
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to emit POST_DELETED event",
      postId: post.id,
      userId: post.userId,
      correlationId,
    });
  });

  return post;
}

export function reschedulePost({
  id,
  userId,
  newScheduledFor,
  overrideQueue,
  signedEvent,
  nostrEvent,
  queueTypeId,
}: {
  id: string;
  userId: string;
  newScheduledFor: string;
  overrideQueue: boolean;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  queueTypeId?: string | null;
}): Promise<Post> {
  const scheduledAtUtc = convertScheduledForToDateTime(newScheduledFor);
  const updateData: Prisma.PostUpdateInput = {
    scheduledAtUtc, // Also update new field
    manual_override: overrideQueue,
    updatedAt: new Date(),
  };

  // If new signed events are provided, update them, otherwise clear them
  if (signedEvent && nostrEvent) {
    // Prisma expects InputJsonValue for these fields
    updateData.signedEvent = signedEvent as unknown as Prisma.InputJsonValue;
    updateData.nostrEvent = nostrEvent as unknown as Prisma.InputJsonValue;
    updateData.nostrEventId = signedEvent.id;
  } else {
    // Clear signed event since timing changed - needs re-signing
    updateData.signedEvent = Prisma.DbNull;
    updateData.nostrEvent = Prisma.DbNull;
    updateData.nostrEventId = null;
  }

  // Handle queueTypeId connection/disconnection
  if (queueTypeId !== undefined) {
    if (queueTypeId) {
      updateData.queueType = {
        connect: {
          id: queueTypeId,
        },
      };
    } else {
      updateData.queueType = {
        disconnect: true,
      };
    }
  }

  return prisma.post.update({
    where: {
      id,
      userId,
    },
    data: updateData,
  });
}

export async function updatePost({
  id,
  userId,
  data,
}: {
  id: string;
  userId: string;
  data: Partial<CreatePostData>;
}): Promise<Post> {
  // Prepare the update data
  const updateData: Prisma.PostUpdateInput = {
    updatedAt: new Date(),
  };

  // Only include defined fields
  if (data.scheduledFor !== undefined) {
    // Explicitly clear both fields when null, otherwise set them
    if (data.scheduledFor === null) {
      updateData.scheduledAtUtc = null;
    } else {
      // TypeScript narrows to Date | string | number here (null excluded)
      // Update scheduledAtUtc only (scheduledFor legacy field removed)
      const scheduledAtUtc = convertScheduledForToDateTime(data.scheduledFor);
      updateData.scheduledAtUtc = scheduledAtUtc ?? null;
    }
  }
  if (data.userId !== undefined)
    updateData.user = { connect: { id: data.userId } };
  if (data.content !== undefined) updateData.content = data.content;
  if (data.caption !== undefined) updateData.caption = data.caption;
  if (data.postedAt !== undefined) updateData.postedAt = data.postedAt;
  if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
  if (data.nostrEventId !== undefined)
    updateData.nostrEventId = data.nostrEventId;
  if (data.signedEvent !== undefined)
    updateData.signedEvent =
      data.signedEvent as unknown as Prisma.InputJsonValue;
  if (data.nostrEvent !== undefined)
    updateData.nostrEvent = data.nostrEvent as unknown as Prisma.InputJsonValue;
  if (data.tags !== undefined) updateData.tags = data.tags;
  // Note: Flag fields (draft, isScheduled, isPosted) have been removed.
  // Use PostStateMachine.transition() to change state instead.
  if (data.isRecyclable !== undefined)
    updateData.isRecyclable = data.isRecyclable;
  // Helper function to handle relation connect/disconnect
  const handleRelation = (
    value: string | null | undefined,
    connectKey: keyof Prisma.PostUpdateInput,
    disconnectKey: keyof Prisma.PostUpdateInput
  ): void => {
    if (value === undefined) return;
    if (value === null) {
      (updateData[disconnectKey] as { disconnect: boolean }) = {
        disconnect: true,
      };
    } else {
      (updateData[connectKey] as { connect: { id: string } }) = {
        connect: { id: value },
      };
    }
  };

  // templateId is not in CreatePostData, handle separately if needed
  if ("templateId" in data && data.templateId !== undefined) {
    handleRelation(
      data.templateId ? String(data.templateId) : null,
      "template",
      "template"
    );
  }
  handleRelation(data.hashTagPresetId, "hashTagPreset", "hashTagPreset");
  // Handle queueTypeId - check for null explicitly, not just undefined
  if ("queueTypeId" in data) {
    handleRelation(
      data.queueTypeId === null ? null : (data.queueTypeId ?? undefined),
      "queueType",
      "queueType"
    );
  }

  const post = await prisma.post.update({
    where: {
      id,
      userId,
    },
    data: updateData,
  });

  // Emit POST_UPDATED event for read model updates
  // @ts-ignore - Dynamic imports work at runtime in CommonJS
  const { createOutboxEvent } = await import("~/infra/outbox/outbox.server");
  void createOutboxEvent(
    "POST_UPDATED",
    post.id,
    "Post",
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial payload for read model events
    { postId: post.id, userId: post.userId } as PostScheduledPayload
    // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Fire-and-forget pattern
  ).catch((error) => {
    // Log but don't throw - read model updates shouldn't block writes
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to emit POST_UPDATED event",
      postId: post.id,
      userId: post.userId,
    });
  });

  return post;
}
