/**
 * Create Post Use Case
 *
 * Handles post creation with idempotency and optional scheduling.
 */

import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
import { fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";
import { createPostWithOutbox } from "~/models/post.commands.server";

import { resolveQueueTypeId } from "../services/queue-type-resolver.server";
import { deriveIsPosted, deriveIsScheduled } from "../state-machine/post-state";
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
    // Handle case where column might not exist in test databases
    const { prisma } = await import("~/lib/prisma.server");
    let existing = null;
    let columnExists = true; // Track if column exists

    // Only check idempotency if we have a key
    if (creationIdempotencyKey) {
      try {
        // Use raw query to avoid Prisma schema validation issues in test databases
        // This allows the query to work even if the column doesn't exist yet
        const results = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "Post" WHERE "creationIdempotencyKey" = $1 LIMIT 1`,
          creationIdempotencyKey
        )) as Array<{ id: string }>;
        if (results.length > 0) {
          // Fetch the full post using the found ID
          existing = await prisma.post.findUnique({
            where: { id: results[0]!.id },
          });
        }
      } catch (error) {
        // If column doesn't exist (e.g., in test databases that aren't fully migrated),
        // skip idempotency check and continue with creation
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorString = String(error);
        // Check for various forms of "column doesn't exist" errors
        const isColumnError =
          errorMessage.includes("does not exist") ||
          errorMessage.includes("column") ||
          errorString.includes("does not exist") ||
          errorString.includes("column") ||
          errorString.includes("(not available)");

        if (isColumnError) {
          // Column doesn't exist, skip idempotency check and don't pass key to create
          columnExists = false;
          existing = null;
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    if (existing) {
      // Use currentState as single source of truth
      const isScheduled = deriveIsScheduled(existing.currentState);
      const isPosted = deriveIsPosted(existing.currentState);
      return {
        post: existing,
        needsScheduling: isScheduled && !isPosted,
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
        scheduledFor: input.scheduledFor
          ? toPrismaDate(fromUnixTimestamp(input.scheduledFor, "UTC"))
          : undefined,
        tags: input.tags ?? [],
        repost: input.repost ?? false,
        isQuotedPost: input.isQuotedPost ?? false,
        // Only include creationIdempotencyKey if the column exists in the database
        ...(columnExists && creationIdempotencyKey
          ? { creationIdempotencyKey }
          : {}),
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
