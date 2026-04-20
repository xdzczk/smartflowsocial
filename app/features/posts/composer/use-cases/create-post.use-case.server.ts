/**
 * Create Post Use Case
 *
 * Handles post creation with idempotency and optional scheduling.
 */

import { assertScheduleCapacity } from "~/features/payments/entitlements/schedule-cap-policy.server";
import { createPostWithOutbox } from "~/features/posts/server";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import {
  generateCreationIdempotencyKey,
  generateSubmissionIdempotencyKey,
} from "~/lib/idempotency.server";
import {
  recordPostCreated,
  recordPostScheduled,
} from "~/lib/metrics/business-metrics.server";
import { fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";

import type { Post } from "../../data/posts-prisma-types.server";
import { findPostByCreationIdempotencyKey } from "../../repositories/post-queries-data.server";
import { resolveQueueTypeId } from "../../services/queue-type-resolver.server";
import {
  deriveIsPublished,
  deriveIsScheduled,
} from "../../state-machine/post-state";
import { PostStateMachine } from "../../state-machine/post-state-machine.server";
import type { CreatePostInput, CreatePostResult } from "../../use-cases/types";

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
  creationIdempotencyKey: string | null
): Promise<{ existing: Post | null; columnExists: boolean }> {
  if (!creationIdempotencyKey) {
    return { existing: null, columnExists: true };
  }
  return findPostByCreationIdempotencyKey(creationIdempotencyKey);
}

async function enforceScheduleCapacityIfEnabled(
  input: CreatePostInput,
  scheduleSlotCount: number
): Promise<void> {
  if (input.skipScheduleCapacityCheck) return;
  await assertScheduleCapacity(input.userId, scheduleSlotCount);
}

function buildRepostList(input: CreatePostInput) {
  return Array.isArray(input.repostSchedules) &&
    input.repostSchedules.length > 0
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
}

function buildQuoteList(input: CreatePostInput) {
  return Array.isArray(input.quoteSchedules) && input.quoteSchedules.length > 0
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
}

function getSignedEventId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("id" in value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Compute the canonical creationIdempotencyKey for a create-post call.
 *
 * Prefers the client-supplied `submissionId` (UUID minted at the publish
 * click) because it is the only key with cross-session uniqueness for two
 * unrelated publish clicks of the same content — fixing the cold-restart
 * "duplicate idempotency collision" that silently dropped fresh signed
 * events into a historic PUBLISHED row.
 *
 * Falls back to the legacy content-hash key for older clients that
 * haven't been redeployed yet (transitional safety).
 */
function resolveCreationIdempotencyKey(
  input: CreatePostInput,
  content: string
): string {
  const mediaKey =
    input.fileUrl.length > 0 ? [...input.fileUrl].sort().join("\0") : undefined;
  return input.submissionId
    ? generateSubmissionIdempotencyKey(input.submissionId)
    : generateCreationIdempotencyKey(
        input.userId,
        content,
        input.scheduledFor,
        mediaKey
      );
}

interface CreateAttachableContext {
  input: CreatePostInput;
  parentPostId: string;
  parentSignedEvent: unknown;
  queueTypeId: string | null | undefined;
  isAttachableParent: boolean;
  correlationId: string | undefined;
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

    const repostListEarly = buildRepostList(input);
    const quoteListEarly = buildQuoteList(input);
    const scheduleSlotCount =
      (input.scheduledFor ? 1 : 0) +
      repostListEarly.length +
      quoteListEarly.length;
    await enforceScheduleCapacityIfEnabled(input, scheduleSlotCount);

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

    const creationIdempotencyKey = resolveCreationIdempotencyKey(
      input,
      content
    );

    const { existing, columnExists } = await findExistingByIdempotency(
      creationIdempotencyKey
    );

    if (existing) {
      // Use currentState as single source of truth
      const isScheduled = deriveIsScheduled(existing.currentState);
      const isPosted = deriveIsPublished(existing.currentState);
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
        scheduledAtUtc: input.scheduledFor
          ? (toPrismaDate(fromUnixTimestamp(input.scheduledFor, "UTC")) ??
            new Date(input.scheduledFor * 1000))
          : undefined,
        nominalScheduledAtUtc:
          input.nominalScheduledFor != null
            ? (toPrismaDate(
                fromUnixTimestamp(input.nominalScheduledFor, "UTC")
              ) ?? null)
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
        dependencyMode: "standalone",
        targetMode: "direct",
        signingState: input.signedEvent ? "signed" : "unsigned",
        signedChildEventId: getSignedEventId(input.signedEvent) ?? undefined,
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

    const ctx: CreateAttachableContext = {
      input,
      parentPostId: post.id,
      parentSignedEvent: post.signedEvent,
      queueTypeId,
      isAttachableParent: input.scheduledFor != null,
      correlationId,
    };

    await this.createReposts(repostListEarly, ctx);
    await this.createQuotes(quoteListEarly, ctx);

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

  private buildAttachableExtras(
    item: { scheduledFor: number },
    ctx: CreateAttachableContext
  ) {
    if (!ctx.isAttachableParent) {
      return {
        dependencyMode: "standalone" as const,
        targetMode: "direct" as const,
      };
    }
    return {
      parentScheduledActionId: ctx.parentPostId,
      rootScheduledActionId: ctx.parentPostId,
      targetScheduledActionId: ctx.parentPostId,
      dependencyMode: "attached" as const,
      targetMode: "scheduled_parent" as const,
      followUpTimingMode: "offset_from_parent" as const,
      followUpOffsetSeconds:
        ctx.input.scheduledFor != null
          ? Math.max(0, item.scheduledFor - ctx.input.scheduledFor)
          : null,
      expectedParentEventId:
        getSignedEventId(ctx.parentSignedEvent) ?? undefined,
    };
  }

  private async createReposts(
    repostList: ReturnType<typeof buildRepostList>,
    ctx: CreateAttachableContext
  ): Promise<void> {
    for (const item of repostList) {
      const scheduledAtUtc =
        toPrismaDate(fromUnixTimestamp(item.scheduledFor, "UTC")) ??
        new Date(item.scheduledFor * 1000);
      const repostConditions =
        item.repostConditions && Object.keys(item.repostConditions).length > 0
          ? item.repostConditions
          : null;
      const repostPost = await createPostWithOutbox(
        {
          userId: ctx.input.userId,
          content: "",
          caption: "",
          fileUrl: [],
          postType: ctx.input.postType,
          queueTypeId: ctx.queueTypeId,
          hashTagPresetId: ctx.input.hashTagPresetId,
          isRecyclable: ctx.input.isRecyclable,
          signedEvent: item.signedEvent,
          nostrEvent: undefined,
          scheduledAtUtc,
          tags: [],
          repost: true,
          isQuotedPost: false,
          repostOfPostId: ctx.parentPostId,
          postKind: "REPOST",
          ...this.buildAttachableExtras(item, ctx),
          signedChildEventId: getSignedEventId(item.signedEvent) ?? undefined,
          signingState: "signed",
          ...(repostConditions && { repostConditions }),
        },
        item.scheduledFor,
        ctx.correlationId
      );
      await this.stateMachine.transition(
        repostPost.id,
        ctx.input.userId,
        "SCHEDULED",
        "Repost created with schedule"
      );
      recordPostScheduled(ctx.input.postType);
    }
  }

  private async createQuotes(
    quoteList: ReturnType<typeof buildQuoteList>,
    ctx: CreateAttachableContext
  ): Promise<void> {
    for (const item of quoteList) {
      const scheduledAtUtc =
        toPrismaDate(fromUnixTimestamp(item.scheduledFor, "UTC")) ??
        new Date(item.scheduledFor * 1000);
      const quoteCaption = item.caption ?? "";
      const quotePost = await createPostWithOutbox(
        {
          userId: ctx.input.userId,
          content: quoteCaption,
          caption: quoteCaption,
          fileUrl: [],
          postType: ctx.input.postType,
          queueTypeId: ctx.queueTypeId,
          hashTagPresetId: ctx.input.hashTagPresetId,
          isRecyclable: ctx.input.isRecyclable,
          signedEvent: item.signedEvent,
          nostrEvent: undefined,
          scheduledAtUtc,
          tags: [],
          repost: false,
          isQuotedPost: true,
          quoteOfPostId: ctx.parentPostId,
          postKind: "QUOTE",
          ...this.buildAttachableExtras(item, ctx),
          signedChildEventId: getSignedEventId(item.signedEvent) ?? undefined,
          signingState: "signed",
        },
        item.scheduledFor,
        ctx.correlationId
      );
      await this.stateMachine.transition(
        quotePost.id,
        ctx.input.userId,
        "SCHEDULED",
        "Quote post created with schedule"
      );
      recordPostScheduled(ctx.input.postType);
    }
  }
}
