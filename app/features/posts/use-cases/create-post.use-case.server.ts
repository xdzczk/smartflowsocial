/**
 * Create Post Use Case
 *
 * Handles post creation with idempotency and optional scheduling.
 */

import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
import { createPostWithOutbox } from "~/models/post.commands.server";

import { resolveQueueTypeId } from "../services/queue-type-resolver.server";
import { PostStateMachine } from "../state-machine/post-state-machine.server";

import type { CreatePostInput, CreatePostResult } from "./types";

// Import applyHashtags from the action service (will be moved to utils later)
function applyHashtags(
  content: string,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean
): string {
  return showHashTagsinPosts && hashTagPresetTags
    ? `${content}\n${hashTagPresetTags}`
    : content;
}

export class CreatePostUseCase {
  private readonly stateMachine = new PostStateMachine();

  async execute(input: CreatePostInput): Promise<CreatePostResult> {
    // Get or create correlation ID for this operation
    const correlationId = getCorrelationId(input.correlationId);

    logInfo("CreatePostUseCase: Starting post creation", {
      userId: input.userId,
      postType: input.postType,
      scheduledFor: input.scheduledFor,
      correlationId,
    });

    // Resolve queue type
    const queueTypeId = await resolveQueueTypeId(
      input.userId,
      input.queueTypeId,
      input.queueType
    );

    // Apply hashtags if provided
    const content =
      input.hashTagPresetTags && input.showHashTagsinPosts
        ? applyHashtags(
            input.content,
            input.hashTagPresetTags,
            input.showHashTagsinPosts
          )
        : input.content;

    // Generate idempotency key
    const creationIdempotencyKey = generateCreationIdempotencyKey(
      input.userId,
      content,
      input.scheduledFor
    );

    // Check for existing post with same idempotency key
    const { prisma } = await import("~/lib/prisma.server");
    // Use findFirst instead of findUnique to handle cases where unique constraint might not exist
    const existing = await prisma.post.findFirst({
      where: { creationIdempotencyKey },
    });

    if (existing) {
      return {
        post: existing,
        needsScheduling: existing.isScheduled && !existing.isPosted,
      };
    }

    // Create post with outbox event in transaction
    const post = await createPostWithOutbox(
      {
        userId: input.userId,
        content,
        caption: input.caption ?? content,
        fileUrl: input.fileUrl,
        postType: input.postType,
        queueTypeId,
        hashTagPresetId: input.hashTagPresetId,
        isRecyclable: input.isRecyclable,
        signedEvent: input.signedEvent,
        nostrEvent: input.nostrEvent,
        isScheduled: !!input.scheduledFor,
        isPosted: false,
        scheduledFor: input.scheduledFor
          ? new Date(input.scheduledFor * 1000)
          : undefined,
        tags: input.tags ?? [],
        repost: input.repost ?? false,
        isQuotedPost: input.isQuotedPost ?? false,
        creationIdempotencyKey,
      },
      input.scheduledFor,
      correlationId
    );

    // Set initial state
    if (input.scheduledFor) {
      await this.stateMachine.transition(
        post.id,
        input.userId,
        "SCHEDULED",
        "Post created with schedule"
      );
      // Record metrics
      // TODO: Re-enable analytics when analytics.server module is available
      // recordPostCreated(input.postType, true);
      // recordPostScheduled(input.postType);
    } else {
      await this.stateMachine.transition(
        post.id,
        input.userId,
        "DRAFT",
        "Post created as draft"
      );
      // Record metrics
      // TODO: Re-enable analytics when analytics.server module is available
      // recordPostCreated(input.postType, false);
    }

    logInfo("CreatePostUseCase: Post created successfully", {
      postId: post.id,
      userId: input.userId,
      correlationId,
    });

    return {
      post,
      needsScheduling: !!input.scheduledFor,
    };
  }
}
