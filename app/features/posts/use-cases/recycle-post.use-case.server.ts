/**
 * Recycle Post Use Case
 *
 * Creates a new post from a recyclable published post and schedules it for future publication.
 * Marks the original post as non-recyclable to prevent duplicate recycling.
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logError } from "~/lib/error-logger.server";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
import { recordPostRecycled } from "~/lib/metrics/business-metrics.server";
import {
  fromUnixTimestamp,
  formatForDisplay,
  toPrismaDate,
} from "~/lib/temporal";
import {
  createPostWithOutbox,
  updatePost,
} from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

import { resolveQueueTypeId } from "../services/queue-type-resolver.server";
import {
  deriveIsPublished,
  deriveIsScheduled,
} from "../state-machine/post-state";
import { PostStateMachine } from "../state-machine/post-state-machine.server";

export interface RecyclePostInput {
  originalPostId: string;
  userId: string;
  scheduledFor?: number; // Unix timestamp in seconds
  queueTypeId?: string | null;
  queueType?: string; // Queue type name for resolution
  correlationId?: string;
}

export interface RecyclePostResult {
  newPostId: string;
  scheduled: boolean;
}

export class RecyclePostUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: RecyclePostInput): Promise<RecyclePostResult> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo("RecyclePostUseCase: Starting post recycling", {
      originalPostId: input.originalPostId,
      userId: input.userId,
      scheduledFor: input.scheduledFor,
      correlationId,
    });

    // Get the original post
    const originalPost = await getPostById({
      id: input.originalPostId,
      userId: input.userId,
    });

    if (!originalPost) {
      throw new Error(
        `Post ${input.originalPostId} not found for user ${input.userId}`
      );
    }

    // Generate idempotency key for the recycled post
    const creationIdempotencyKey = generateCreationIdempotencyKey(
      input.userId,
      originalPost.caption ?? originalPost.content ?? "",
      input.scheduledFor
    );

    // Verify post is recyclable and published
    // We validate first to catch invalid recycle attempts early
    // Use currentState as single source of truth
    const isOriginalPosted = deriveIsPublished(originalPost.currentState);
    if (!isOriginalPosted) {
      throw new Error(
        `Post ${input.originalPostId} must be published before recycling`
      );
    }

    // Check idempotency AFTER validating published status
    // This allows idempotent retries for valid posts
    // Exclude the original post from the search (only look for recycled posts)
    const { prisma } = await import("~/lib/prisma.server");
    const existing = await prisma.post.findFirst({
      where: {
        creationIdempotencyKey,
        id: { not: input.originalPostId }, // Exclude the original post
      },
    });

    if (existing) {
      // Found existing recycled post - this is an idempotent retry
      // If original post is now non-recyclable, it means we already recycled it (valid idempotent retry)
      // If original post is still recyclable, it means we found a recycled post from a different original
      // with the same content. In that case, we should still validate and potentially create a new recycled post.
      // But for idempotency, if we found an existing post, we can return it regardless of original's recyclable status
      // because the idempotency key ensures it's the same recycle operation.
      logInfo(
        "RecyclePostUseCase: Recycled post already exists (idempotency)",
        {
          originalPostId: input.originalPostId,
          newPostId: existing.id,
          userId: input.userId,
          correlationId,
        }
      );
      return {
        newPostId: existing.id,
        // Use currentState as single source of truth
        scheduled:
          deriveIsScheduled(existing.currentState) &&
          !deriveIsPublished(existing.currentState),
      };
    }

    // Verify post is recyclable (for new recycle attempts or when existing post is from different original)
    if (!originalPost.isRecyclable) {
      throw new Error(
        `Post ${input.originalPostId} is not marked as recyclable`
      );
    }

    // Resolve queue type (use original post's queue type if not specified)
    const queueTypeId = await resolveQueueTypeId(
      input.userId,
      input.queueTypeId ?? originalPost.queueTypeId,
      input.queueType
    );

    // Create new post from original (recycled copy)
    const newPost = await createPostWithOutbox(
      {
        userId: input.userId,
        content: originalPost.content ?? "",
        caption: originalPost.caption ?? "",
        fileUrl: originalPost.fileUrl,
        postType: originalPost.postType,
        queueTypeId,
        hashTagPresetId: originalPost.hashTagPresetId,
        isRecyclable: originalPost.isRecyclable, // Inherit recyclable status
        signedEvent: originalPost.signedEvent as unknown as
          | SignedEvent
          | undefined,
        nostrEvent: originalPost.nostrEvent as unknown as
          | NostrEvent
          | undefined,
        scheduledFor: input.scheduledFor
          ? toPrismaDate(fromUnixTimestamp(input.scheduledFor, "UTC"))
          : undefined,
        tags: originalPost.tags,
        repost: originalPost.repost,
        isQuotedPost: originalPost.isQuotedPost,
        postKind: originalPost.postKind, // Preserve kind when recycling
        creationIdempotencyKey,
      },
      input.scheduledFor,
      correlationId
    );

    // Mark original post as non-recyclable to prevent duplicate recycling
    try {
      await updatePost({
        id: input.originalPostId,
        userId: input.userId,
        data: { isRecyclable: false },
      });
    } catch (error) {
      // Log but don't throw - marking as non-recyclable is non-critical
      logError(error instanceof Error ? error : new Error(String(error)), {
        originalPostId: input.originalPostId,
        newPostId: newPost.id,
        userId: input.userId,
        correlationId,
        message: "Failed to mark original post as non-recyclable",
      });
    }

    // Set initial state
    if (input.scheduledFor) {
      await this.stateMachine.transition(
        newPost.id,
        input.userId,
        "SCHEDULED",
        `Post recycled and scheduled for ${formatForDisplay(fromUnixTimestamp(input.scheduledFor, "UTC"), "UTC")}`
      );
    } else {
      await this.stateMachine.transition(
        newPost.id,
        input.userId,
        "DRAFT",
        "Post recycled as draft"
      );
    }

    // Record metrics
    recordPostRecycled(originalPost.postType);

    logInfo("RecyclePostUseCase: Post recycled successfully", {
      originalPostId: input.originalPostId,
      newPostId: newPost.id,
      userId: input.userId,
      scheduled: !!input.scheduledFor,
      correlationId,
    });

    return {
      newPostId: newPost.id,
      scheduled: !!input.scheduledFor,
    };
  }
}
