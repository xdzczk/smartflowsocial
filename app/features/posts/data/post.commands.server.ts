/**
 * Post Model - Command Operations (Writes)
 *
 * This module provides write operations for Post entities.
 * All functions in this file perform INSERT, UPDATE, or DELETE operations.
 */

import { Prisma, type Post } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { PostScheduledPayload } from "~/infra/outbox/outbox.server";
import { BRAND_DELETE_REASON } from "~/lib/brand";
import { env } from "~/lib/env.server";
import { logError, logInfo } from "~/lib/error-logger.server";
import { generateEnqueueIdempotencyKey } from "~/lib/idempotency.server";
import { prisma } from "~/lib/prisma.server";

import type { CreatePostData } from "./post.types";

const DELETE_EVENT_SCHEMA_VERSION = "1.0";
const DEFAULT_DELETE_REASON = BRAND_DELETE_REASON;

function isNostrDeleteEventsEnabled(): boolean {
  const raw = env.ENABLE_NOSTR_DELETE_EVENTS;
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

function extractEventReference(
  signedEvent: unknown,
  nostrEvent: unknown,
  nostrEventId: string | null
): { eventId: string; pubkey: string } | null {
  const fromSigned =
    signedEvent && typeof signedEvent === "object"
      ? (signedEvent as { id?: unknown; pubkey?: unknown })
      : null;
  if (
    fromSigned &&
    typeof fromSigned.id === "string" &&
    typeof fromSigned.pubkey === "string"
  ) {
    return { eventId: fromSigned.id, pubkey: fromSigned.pubkey };
  }

  const fromNostrEvent =
    nostrEvent && typeof nostrEvent === "object"
      ? (nostrEvent as { id?: unknown; pubkey?: unknown })
      : null;
  if (
    fromNostrEvent &&
    typeof fromNostrEvent.id === "string" &&
    typeof fromNostrEvent.pubkey === "string"
  ) {
    return { eventId: fromNostrEvent.id, pubkey: fromNostrEvent.pubkey };
  }

  if (
    nostrEventId &&
    fromNostrEvent &&
    typeof fromNostrEvent.pubkey === "string"
  ) {
    return { eventId: nostrEventId, pubkey: fromNostrEvent.pubkey };
  }

  return null;
}

/** Convert scheduledAtUtc (Date or Unix seconds) to Date for DB. */
function toScheduledAtUtcDate(
  v: Date | number | null | undefined
): Date | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v * 1000);
  return undefined;
}

/**
 * Create a new post in the database
 *
 * Note: This is a pure data access function. For best practices,
 * resolve queueTypeId in the feature layer before calling this function.
 * Use resolveQueueTypeId() from app/features/posts/services/queue-type-resolver.server.ts
 *
 * Writes scheduledAtUtc from scheduledFor input.
 */
export function createPost(data: CreatePostData): Promise<Post> {
  const {
    userId,
    content,
    publishedAt,
    fileUrl,
    scheduledAtUtc: scheduledAtUtcInput,
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
    repostOfPostId,
    quoteOfPostId,
    quoteOfLongFormPostId,
    postKind,
    threadGroupId,
    replyToEventId,
    replyToPostId,
  } = data;

  const scheduledAtUtc = toScheduledAtUtcDate(scheduledAtUtcInput);
  const initialState = scheduledAtUtc ? "SCHEDULED" : "DRAFT";

  return prisma.post.create({
    data: {
      content,
      fileUrl,
      scheduledAtUtc, // New DateTime field
      nostrEventId,
      signedEvent,
      nostrEvent,
      postType,
      publishedAt,
      caption,
      tags,
      manual_override: manual_override ?? false,
      currentState: initialState, // Single source of truth
      repost: repost ?? false,
      isQuotedPost: isQuotedPost ?? false,
      isRecyclable: isRecyclable ?? false,
      creationIdempotencyKey,
      postKind: postKind ?? "POST",
      ...(threadGroupId != null && { threadGroupId }),
      ...(replyToEventId != null && { replyToEventId }),
      ...(replyToPostId != null && {
        replyTo: { connect: { id: replyToPostId } },
      }),
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
      ...(repostOfPostId && {
        repostOf: {
          connect: { id: repostOfPostId },
        },
      }),
      ...(quoteOfPostId && {
        quoteOf: {
          connect: { id: quoteOfPostId },
        },
      }),
      ...(quoteOfLongFormPostId && {
        quoteOfLongForm: {
          connect: { id: quoteOfLongFormPostId },
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
    const scheduledAtUtcDate = toScheduledAtUtcDate(data.scheduledAtUtc);
    const initialState = scheduledAtUtcDate ? "SCHEDULED" : "DRAFT";

    // Create post
    const post = await tx.post.create({
      data: {
        content: data.content,
        fileUrl: data.fileUrl,
        scheduledAtUtc: scheduledAtUtcDate ?? null,
        nominalScheduledAtUtc: data.nominalScheduledAtUtc
          ? (toScheduledAtUtcDate(data.nominalScheduledAtUtc) ?? null)
          : null,
        nostrEventId: data.nostrEventId,
        signedEvent: data.signedEvent,
        nostrEvent: data.nostrEvent,
        postType: data.postType,
        publishedAt: data.publishedAt,
        caption: data.caption,
        tags: data.tags,
        manual_override: data.manual_override ?? false,
        currentState: initialState, // Single source of truth
        repost: data.repost ?? false,
        isQuotedPost: data.isQuotedPost ?? false,
        isRecyclable: data.isRecyclable ?? false,
        creationIdempotencyKey,
        postKind: data.postKind ?? "POST",
        ...(data.threadGroupId != null && {
          threadGroupId: data.threadGroupId,
        }),
        ...(data.replyToEventId != null && {
          replyToEventId: data.replyToEventId,
        }),
        ...(data.replyToPostId != null && {
          replyTo: { connect: { id: data.replyToPostId } },
        }),
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
        ...(data.repostOfPostId && {
          repostOf: {
            connect: { id: data.repostOfPostId },
          },
        }),
        ...(data.quoteOfPostId && {
          quoteOf: {
            connect: { id: data.quoteOfPostId },
          },
        }),
        ...(data.quoteOfLongFormPostId && {
          quoteOfLongForm: {
            connect: { id: data.quoteOfLongFormPostId },
          },
        }),
        ...(data.repostConditions != null &&
          Object.keys(data.repostConditions).length > 0 && {
            repostConditions:
              data.repostConditions as unknown as Prisma.InputJsonValue,
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
    if (scheduledForUnix && signedEvent && scheduledAtUtcDate) {
      const scheduledAtUtc = new Date(scheduledForUnix * 1000);
      const eventId =
        typeof signedEvent === "object" &&
        "id" in signedEvent &&
        typeof (signedEvent as { id: unknown }).id === "string"
          ? (signedEvent as { id: string }).id
          : undefined;
      const enqueueIdempotencyKey = generateEnqueueIdempotencyKey(
        post.id,
        scheduledForUnix,
        eventId
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
}): Promise<Post | null> {
  // Check if post exists before attempting to delete
  const existingPost = await prisma.post.findUnique({
    where: {
      id,
      userId,
    },
  });

  // If post doesn't exist, return null instead of throwing
  if (!existingPost) {
    return null;
  }

  const deleteRef = extractEventReference(
    existingPost.signedEvent,
    existingPost.nostrEvent,
    existingPost.nostrEventId
  );

  try {
    const post = await prisma.$transaction(async (tx) => {
      const deleted = await tx.post.delete({
        where: {
          id,
          userId,
        },
      });

      const { createOutboxEventInTransaction } =
        await import("~/infra/outbox/outbox.server");

      await createOutboxEventInTransaction(
        tx as Prisma.TransactionClient,
        "POST_DELETED",
        deleted.id,
        "Post",
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial payload for read model events
        { postId: deleted.id, userId: deleted.userId } as PostScheduledPayload,
        undefined,
        undefined,
        correlationId
      );

      if (isNostrDeleteEventsEnabled() && deleteRef) {
        try {
          await createOutboxEventInTransaction(
            tx as Prisma.TransactionClient,
            "POST_DELETE_REQUESTED",
            deleted.id,
            "Post",
            {
              postId: deleted.id,
              userId: deleted.userId,
              originalEventId: deleteRef.eventId,
              originalEventPubkey: deleteRef.pubkey,
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
              "Skipping POST_DELETE_REQUESTED outbox event: DB constraint not yet updated",
              {
                postId: deleted.id,
                userId: deleted.userId,
                correlationId,
              }
            );
          } else {
            throw error;
          }
        }
      }

      return deleted;
    });

    if (isNostrDeleteEventsEnabled()) {
      if (!deleteRef) {
        logInfo(
          "Skipping POST_DELETE_REQUESTED outbox event: missing metadata",
          {
            postId: post.id,
            userId: post.userId,
            correlationId,
          }
        );
      }
    }

    return post;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to delete post and emit outbox events",
      postId: id,
      userId,
      correlationId,
    });
    throw error;
  }
}

export function reschedulePost({
  id,
  userId,
  scheduledAtUtc: scheduledAtUtcInput,
  overrideQueue,
  signedEvent,
  nostrEvent,
  queueTypeId,
}: {
  id: string;
  userId: string;
  /** New schedule time: Date or Unix seconds. */
  scheduledAtUtc: Date | number;
  overrideQueue: boolean;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  queueTypeId?: string | null;
}): Promise<Post> {
  const scheduledAtUtc = toScheduledAtUtcDate(scheduledAtUtcInput);
  if (!scheduledAtUtc) {
    throw new Error("reschedulePost: scheduledAtUtc is required");
  }
  const updateData: Prisma.PostUpdateInput = {
    scheduledAtUtc,
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

  if (data.scheduledAtUtc !== undefined) {
    if (data.scheduledAtUtc === null) {
      updateData.scheduledAtUtc = null;
    } else {
      updateData.scheduledAtUtc =
        toScheduledAtUtcDate(data.scheduledAtUtc) ?? null;
    }
  }
  if (data.nominalScheduledAtUtc !== undefined) {
    updateData.nominalScheduledAtUtc = data.nominalScheduledAtUtc
      ? (toScheduledAtUtcDate(data.nominalScheduledAtUtc) ?? null)
      : null;
  }
  if (data.userId !== undefined)
    updateData.user = { connect: { id: data.userId } };
  if (data.content !== undefined) updateData.content = data.content;
  if (data.caption !== undefined) updateData.caption = data.caption;
  if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
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

/**
 * Clone an existing short-form draft for the same user (duplicate / convert flows).
 */
export async function cloneDraftPost(
  userId: string,
  sourceId: string
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const src = await prisma.post.findFirst({
    where: { id: sourceId, userId, currentState: "DRAFT" },
  });
  if (!src) {
    return { ok: false, error: "Draft not found" };
  }

  const { checkDraftCapacity } =
    await import("~/features/payments/entitlements/draft-template-cap.server");
  const capErr = await checkDraftCapacity(userId, 1);
  if (capErr) {
    return { ok: false, error: capErr };
  }

  const draftMeta = src.draftMeta ?? Prisma.JsonNull;

  const created = await prisma.post.create({
    data: {
      userId,
      content: src.content,
      caption: src.caption,
      fileUrl: src.fileUrl,
      postType: src.postType,
      postKind: src.postKind,
      draftMeta,
      tags: src.tags,
      queueTypeId: src.queueTypeId,
      hashTagPresetId: src.hashTagPresetId,
      repost: src.repost,
      isQuotedPost: src.isQuotedPost,
      isRecyclable: src.isRecyclable,
      currentState: "DRAFT",
      status: src.status,
      manual_override: src.manual_override,
      signedEvent: Prisma.JsonNull,
      nostrEvent: Prisma.JsonNull,
      nostrEventId: null,
      scheduledAtUtc: null,
      nominalScheduledAtUtc: null,
      publishedAt: null,
      draftGroupId: null,
      threadGroupId: null,
      repostOfPostId: src.repostOfPostId,
      quoteOfPostId: src.quoteOfPostId,
      quoteOfLongFormPostId: src.quoteOfLongFormPostId,
      replyToEventId: src.replyToEventId,
      replyToPostId: src.replyToPostId,
    },
  });

  return { ok: true, postId: created.id };
}
