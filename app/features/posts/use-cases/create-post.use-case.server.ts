/**
 * Create Post Use Case
 *
 * Handles post creation with idempotency and optional scheduling.
 */

import type { Post } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
import {
  recordPostCreated,
  recordPostScheduled,
} from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";
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

async function findExistingByIdempotency(
  prismaClient: typeof prisma,
  creationIdempotencyKey: string | null
): Promise<{ existing: Post | null; columnExists: boolean }> {
  let existing: Post | null = null;
  let columnExists = true;
  if (!creationIdempotencyKey) {
    return { existing, columnExists };
  }
  try {
    const rawResults = await prismaClient.$queryRawUnsafe(
      `SELECT id FROM "Post" WHERE "creationIdempotencyKey" = $1 LIMIT 1`,
      creationIdempotencyKey
    );
    const results = rawResults as Array<{ id: string }>;
    if (results.length > 0) {
      const first = results[0];
      if (first) {
        existing = await prismaClient.post.findUnique({
          where: { id: first.id },
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = String(error);
    const isColumnError =
      errorMessage.includes("does not exist") ||
      errorMessage.includes("column") ||
      errorString.includes("does not exist") ||
      errorString.includes("column") ||
      errorString.includes("(not available)");
    if (isColumnError) {
      columnExists = false;
      existing = null;
    } else {
      throw error;
    }
  }
  return { existing, columnExists };
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

    const { existing, columnExists } = await findExistingByIdempotency(
      prisma,
      creationIdempotencyKey
    );

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
        repostOfPostId: input.repostOfPostId ?? undefined,
        quoteOfPostId: input.quoteOfPostId ?? undefined,
        postKind: input.postKind ?? "POST",
        ...(input.threadGroupId != null && {
          threadGroupId: input.threadGroupId,
        }),
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
      recordPostCreated(input.postType, true);
      recordPostScheduled(input.postType);
    } else {
      await this.stateMachine.transition(
        post.id,
        input.userId,
        "DRAFT",
        "Post created as draft"
      );
      // Record metrics
      recordPostCreated(input.postType, false);
    }

    // Normalize to arrays: support both single (legacy) and multiple repost/quote
    const repostList: Array<{
      scheduledFor: number;
      signedEvent: SignedEvent;
    }> =
      Array.isArray(input.repostSchedules) && input.repostSchedules.length > 0
        ? input.repostSchedules
        : input.alsoScheduleRepost &&
            input.repostScheduledFor != null &&
            input.repostSignedEvent
          ? [
              {
                scheduledFor: input.repostScheduledFor,
                signedEvent: input.repostSignedEvent,
              },
            ]
          : [];
    const quoteList: Array<{
      scheduledFor: number;
      signedEvent: SignedEvent;
      caption?: string;
    }> =
      Array.isArray(input.quoteSchedules) && input.quoteSchedules.length > 0
        ? input.quoteSchedules
        : input.alsoScheduleQuote &&
            input.quoteScheduledFor != null &&
            input.quoteSignedEvent
          ? [
              {
                scheduledFor: input.quoteScheduledFor,
                signedEvent: input.quoteSignedEvent,
                caption: input.quoteCaption ?? "",
              },
            ]
          : [];

    for (const item of repostList) {
      const repostScheduledForDate = toPrismaDate(
        fromUnixTimestamp(item.scheduledFor, "UTC")
      );

      const repostSignedEv = item.signedEvent;
      const repostPost = await createPostWithOutbox(
        {
          userId: input.userId,
          content: "",
          caption: "",
          fileUrl: [],
          postType: input.postType,
          queueTypeId,
          hashTagPresetId: input.hashTagPresetId,
          isRecyclable: input.isRecyclable,

          signedEvent: repostSignedEv,
          nostrEvent: undefined,
          scheduledFor: repostScheduledForDate,
          tags: [],
          repost: true,
          isQuotedPost: false,
          repostOfPostId: post.id,
          postKind: "REPOST",
        },
        item.scheduledFor,
        correlationId
      );
      await this.stateMachine.transition(
        repostPost.id,
        input.userId,
        "SCHEDULED",
        "Repost created with schedule"
      );
      recordPostScheduled(input.postType);
    }

    for (const item of quoteList) {
      const quoteScheduledForDate = toPrismaDate(
        fromUnixTimestamp(item.scheduledFor, "UTC")
      );
      const quoteCaption = item.caption ?? "";

      const quoteSignedEv = item.signedEvent;
      const quotePost = await createPostWithOutbox(
        {
          userId: input.userId,
          content: quoteCaption,
          caption: quoteCaption,
          fileUrl: [],
          postType: input.postType,
          queueTypeId,
          hashTagPresetId: input.hashTagPresetId,
          isRecyclable: input.isRecyclable,

          signedEvent: quoteSignedEv,
          nostrEvent: undefined,
          scheduledFor: quoteScheduledForDate,
          tags: [],
          repost: false,
          isQuotedPost: true,
          quoteOfPostId: post.id,
          postKind: "QUOTE",
        },
        item.scheduledFor,
        correlationId
      );
      await this.stateMachine.transition(
        quotePost.id,
        input.userId,
        "SCHEDULED",
        "Quote post created with schedule"
      );
      recordPostScheduled(input.postType);
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
