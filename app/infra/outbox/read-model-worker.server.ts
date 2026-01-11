/**
 * Read Model Worker
 *
 * Updates denormalized read models based on outbox events.
 * This provides fast dashboard queries without impacting write performance.
 */

import { logError, logInfo } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import type { OutboxEventType } from "./outbox.server";

interface OutboxEvent {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  aggregateType: string;
  payload: unknown;
  correlationId?: string | null;
}

/**
 * Update read models based on outbox event
 */
export async function updateReadModels(event: OutboxEvent): Promise<void> {
  try {
    switch (event.eventType) {
      case "POST_CREATED":
      case "POST_UPDATED": {
        await updateScheduledPostRead(event.aggregateId);
        break;
      }

      case "POST_PUBLISHED": {
        await movePostToPublishedRead(event.aggregateId);
        break;
      }

      case "POST_DELETED": {
        await deletePostFromReadModels(event.aggregateId);
        break;
      }

      case "LONGFORM_CREATED":
      case "LONGFORM_UPDATED": {
        // Longform posts can be handled similarly if needed
        // For now, we'll focus on regular posts
        logInfo("Longform post read model update skipped", {
          postId: event.aggregateId,
          eventType: event.eventType,
        });
        break;
      }

      case "LONGFORM_PUBLISHED":
      case "LONGFORM_DELETED": {
        // Longform posts can be handled similarly if needed
        logInfo("Longform post read model update skipped", {
          postId: event.aggregateId,
          eventType: event.eventType,
        });
        break;
      }

      // Ignore job-related events (handled by outbox-worker)
      case "POST_SCHEDULED":
      case "LONGFORM_SCHEDULED":
      case "POST_CANCELLED":
      case "LONGFORM_CANCELLED":
        // These are handled by the main outbox worker
        break;

      default:
        logInfo("Unknown event type for read model update", {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
        });
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId ?? undefined,
      message: "Failed to update read models",
    });
    // Don't throw - we don't want read model failures to block event processing
  }
}

/**
 * Update scheduled post read model
 */
async function updateScheduledPostRead(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      queueType: true,
    },
  });

  if (!post) {
    logInfo("Post not found for read model update", { postId });
    return;
  }

  // Only update if post is scheduled
  if (!post.isScheduled || !post.scheduledAtUtc) {
    // Remove from scheduled read model if it exists
    await prisma.scheduledPostRead.deleteMany({
      where: { postId: post.id },
    });
    return;
  }

  // Upsert scheduled post read model
  await prisma.scheduledPostRead.upsert({
    where: { postId: post.id },
    create: {
      id: post.id,
      userId: post.userId,
      postId: post.id,
      caption: post.caption,
      scheduledAtUtc: post.scheduledAtUtc,
      queueTypeName: post.queueType?.name ?? "unassigned",
      queueTypeColor: post.queueType?.color ?? null,
      hashTagPresetId: post.hashTagPresetId,
      templateId: post.templateId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
    update: {
      caption: post.caption,
      scheduledAtUtc: post.scheduledAtUtc,
      queueTypeName: post.queueType?.name ?? "unassigned",
      queueTypeColor: post.queueType?.color ?? null,
      hashTagPresetId: post.hashTagPresetId,
      templateId: post.templateId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Move post from scheduled to published read model
 */
async function movePostToPublishedRead(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      queueType: true,
    },
  });

  if (!post) {
    logInfo("Post not found for read model update", { postId });
    return;
  }

  if (!post.isPosted || !post.postedAt) {
    logInfo("Post not published, skipping published read model update", {
      postId,
    });
    return;
  }

  // Remove from scheduled read model
  await prisma.scheduledPostRead.deleteMany({
    where: { postId: post.id },
  });

  // Add to published read model
  await prisma.publishedPostRead.upsert({
    where: { postId: post.id },
    create: {
      id: post.id,
      userId: post.userId,
      postId: post.id,
      caption: post.caption,
      postedAt: post.postedAt,
      queueTypeName: post.queueType?.name ?? "unassigned",
      queueTypeColor: post.queueType?.color ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
    update: {
      postedAt: post.postedAt,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete post from all read models
 */
async function deletePostFromReadModels(postId: string): Promise<void> {
  await Promise.all([
    prisma.scheduledPostRead.deleteMany({
      where: { postId },
    }),
    prisma.publishedPostRead.deleteMany({
      where: { postId },
    }),
  ]);
}

/**
 * Process read model updates for processed outbox events
 * This should be called after the main outbox worker processes events
 */
export async function processReadModelUpdates(limit = 50): Promise<{
  processed: number;
  errors: number;
}> {
  // Get recently processed events that might need read model updates
  const events = await prisma.outboxEvent.findMany({
    where: {
      processedAt: { not: null },
      eventType: {
        in: [
          "POST_CREATED",
          "POST_UPDATED",
          "POST_PUBLISHED",
          "POST_DELETED",
          "LONGFORM_CREATED",
          "LONGFORM_UPDATED",
          "LONGFORM_PUBLISHED",
          "LONGFORM_DELETED",
        ],
      },
      // Only process events that haven't been handled by read model worker yet
      // We'll use a marker in the payload or a separate field
      // For now, we'll process all read model events
    },
    take: limit,
    orderBy: { processedAt: "asc" },
  });

  let processed = 0;
  let errors = 0;

  for (const event of events) {
    try {
      await updateReadModels({
        id: event.id,
        eventType: event.eventType as OutboxEventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: event.payload,
        correlationId: event.correlationId,
      });
      processed++;
    } catch (error) {
      errors++;
      logError(error instanceof Error ? error : new Error(String(error)), {
        eventId: event.id,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        message: "Failed to process read model update",
      });
    }
  }

  return { processed, errors };
}
