/**
 * Scheduled posts action handlers
 * Centralized action processing for scheduled posts page
 */

import { json } from "@remix-run/node";

import {
  assertScheduleCapacity,
  ScheduleCapExceededError,
} from "~/features/payments/entitlements/schedule-cap-policy.server";
import { MoveScheduledLongFormToDraftUseCase } from "~/features/posts/longform/index.server";
import { findPostByCreationIdempotencyKey } from "~/features/posts/repositories/post-queries-data.server";
import { cascadeDeleteStandaloneScheduledDependents } from "~/features/posts/repositories/scheduled-standalone-dependents-cascade.server";
import {
  createPostWithOutbox,
  deleteLongFormPost,
  deletePost,
  getPostById,
} from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import { generateCreationIdempotencyKey } from "~/lib/idempotency.server";
import {
  scheduledActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { MoveScheduledToDraftUseCase } from "../use-cases/move-scheduled-to-draft.use-case.server";

import { cascadeDeleteAttachedFollowups } from "./attached-followups.server";

const REPOST_CHAIN_BLOCKED_ERROR = "Cannot repost or quote a repost.";
const PARENT_SIGNING_REQUIRED_ERROR =
  "Parent scheduled post must be signed before scheduling attached follow-ups.";

async function getExistingScheduledPostByIdempotency(
  creationIdempotencyKey: string
) {
  const { existing, columnExists } = await findPostByCreationIdempotencyKey(
    creationIdempotencyKey
  );
  return { existing, columnExists };
}

export async function handleScheduledAction(
  formData: FormData,
  userId: string
): Promise<
  | ReturnType<typeof json>
  | {
      success: boolean;
      deleted?: boolean;
      deletedCount?: number;
      postId?: string;
      moved?: boolean;
      cascadeDeletedIds?: string[];
    }
> {
  const result = validateFormDataOrRespond(formData, scheduledActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "scheduleRepost") {
    return handleScheduleRepost(result.data, userId);
  }

  if (_action === "scheduleQuote") {
    return handleScheduleQuote(result.data, userId);
  }

  if (_action === "moveToDraft") {
    const moveUseCase =
      result.data.type === "longform"
        ? new MoveScheduledLongFormToDraftUseCase()
        : new MoveScheduledToDraftUseCase();
    const { moved } = await moveUseCase.execute({
      postId: result.data.postId,
      userId,
    });
    return { success: true, moved };
  }

  if (_action === "delete") {
    const attachedIds = await cascadeDeleteAttachedFollowups({
      rootPostId: result.data.postId,
      userId,
    });
    const standaloneIds = await cascadeDeleteStandaloneScheduledDependents(
      result.data.postId,
      userId
    );
    const deletedPost = await deletePost({ id: result.data.postId, userId });
    return {
      success: true,
      deleted: deletedPost !== null,
      cascadeDeletedIds: [...attachedIds, ...standaloneIds],
    };
  }

  if (_action === "deleteLongForm") {
    const standaloneIds = await cascadeDeleteStandaloneScheduledDependents(
      result.data.postId,
      userId
    );
    const deletedPost = await deleteLongFormPost({
      id: result.data.postId,
      userId,
    });
    return {
      success: true,
      deleted: deletedPost !== null,
      cascadeDeletedIds: standaloneIds,
    };
  }

  if (_action === "bulkDelete") {
    const allCascadeIds: string[] = [];
    const results = await Promise.all(
      result.data.postIds.map(async (id: string) => {
        const a = await cascadeDeleteAttachedFollowups({
          rootPostId: id,
          userId,
        });
        const s = await cascadeDeleteStandaloneScheduledDependents(id, userId);
        allCascadeIds.push(...a, ...s);
        return deletePost({ id, userId });
      })
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount, cascadeDeletedIds: allCascadeIds };
  }

  if (_action === "bulkDeleteLongForm") {
    const allCascadeIds: string[] = [];
    const results = await Promise.all(
      result.data.postIds.map(async (id: string) => {
        const s = await cascadeDeleteStandaloneScheduledDependents(id, userId);
        allCascadeIds.push(...s);
        return deleteLongFormPost({ id, userId });
      })
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount, cascadeDeletedIds: allCascadeIds };
  }

  // TypeScript guarantees this is "bulkDeleteMixed" after previous checks
  const allCascadeIds: string[] = [];
  const promises = result.data.itemData.map((item) => {
    return (async () => {
      const s = await cascadeDeleteStandaloneScheduledDependents(
        item.id,
        userId
      );
      allCascadeIds.push(...s);
      if (item.type === "post") {
        const a = await cascadeDeleteAttachedFollowups({
          rootPostId: item.id,
          userId,
        });
        allCascadeIds.push(...a);
        return deletePost({ id: item.id, userId });
      } else {
        return deleteLongFormPost({ id: item.id, userId });
      }
    })();
  });
  const results = await Promise.all(promises);
  const deletedCount = results.filter((post) => post !== null).length;
  return { success: true, deletedCount, cascadeDeletedIds: allCascadeIds };
}

function buildRepostConditionsFromData(data: {
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
}): {
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
} | null {
  const conditions: Record<string, number> = {};
  const minReactions = data["minReactions"];
  const minZaps = data["minZaps"];
  const minComments = data["minComments"];
  const minReposts = data["minReposts"];
  const minSats = data["minSats"];
  if (minReactions != null && minReactions >= 0)
    conditions["minReactions"] = minReactions;
  if (minZaps != null && minZaps >= 0) conditions["minZaps"] = minZaps;
  if (minComments != null && minComments >= 0)
    conditions["minComments"] = minComments;
  if (minReposts != null && minReposts >= 0)
    conditions["minReposts"] = minReposts;
  if (minSats != null && minSats >= 0) conditions["minSats"] = minSats;
  return Object.keys(conditions).length > 0 ? conditions : null;
}

function getSignedEventIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("id" in value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function handleScheduleRepost(
  data: {
    postId?: string;
    sourceSignedEvent?: string;
    scheduledFor: string;
    signedEvent: string;
    minReactions?: number;
    minZaps?: number;
    minComments?: number;
    minReposts?: number;
    minSats?: number;
  },
  userId: string
) {
  const signedEvent = parseSignedEvent(data.signedEvent);
  if (!signedEvent) {
    return json({ error: "Invalid signed event" }, { status: 400 });
  }
  const scheduledForUnix = parseInt(data.scheduledFor, 10);
  if (Number.isNaN(scheduledForUnix)) {
    return json({ error: "Invalid scheduled time" }, { status: 400 });
  }
  const scheduledAtUtc = new Date(scheduledForUnix * 1000);
  const creationIdempotencyKey = generateCreationIdempotencyKey(
    userId,
    `scheduleRepost:${signedEvent.id}`,
    scheduledForUnix
  );
  const { existing, columnExists } =
    await getExistingScheduledPostByIdempotency(creationIdempotencyKey);
  if (existing) {
    return { success: true, postId: existing.id };
  }
  const repostConditions = buildRepostConditionsFromData(data);
  try {
    await assertScheduleCapacity(userId, 1);
  } catch (e) {
    if (e instanceof ScheduleCapExceededError) {
      return json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  const postId = data.postId?.trim();
  if (postId) {
    const sourcePost = await getPostById({ id: postId, userId });
    if (!sourcePost) {
      return json({ error: "Post not found" }, { status: 404 });
    }
    if (isPureRepostSourcePost(sourcePost)) {
      return json({ error: REPOST_CHAIN_BLOCKED_ERROR }, { status: 400 });
    }
    const isAttachedFollowUp =
      sourcePost.currentState === "SCHEDULED" &&
      sourcePost.nostrEventId == null;
    const expectedParentEventId =
      sourcePost.nostrEventId ??
      getSignedEventIdFromUnknown(sourcePost.signedEvent);
    if (isAttachedFollowUp && !expectedParentEventId) {
      return json({ error: PARENT_SIGNING_REQUIRED_ERROR }, { status: 400 });
    }
    const post = await createPostWithOutbox(
      {
        userId,
        content: "",
        caption: "",
        fileUrl: [],
        postType: sourcePost.postType,
        queueTypeId: sourcePost.queueTypeId,
        scheduledAtUtc,
        tags: [],
        repost: true,
        isQuotedPost: false,
        repostOfPostId: sourcePost.id,
        postKind: "REPOST",
        signedEvent,
        signedChildEventId: signedEvent.id,
        signingState: "signed",
        ...(isAttachedFollowUp
          ? {
              parentScheduledActionId: sourcePost.id,
              rootScheduledActionId:
                sourcePost.rootScheduledActionId ?? sourcePost.id,
              targetScheduledActionId: sourcePost.id,
              dependencyMode: "attached" as const,
              targetMode: "scheduled_parent" as const,
              followUpTimingMode: "fixed_datetime" as const,
              expectedParentEventId: expectedParentEventId ?? undefined,
            }
          : {
              dependencyMode: "standalone" as const,
              targetMode: "direct" as const,
            }),
        ...(columnExists ? { creationIdempotencyKey } : {}),
        ...(repostConditions && { repostConditions }),
      },
      scheduledForUnix
    );
    const stateMachine = new PostStateMachine();
    await stateMachine.transition(
      post.id,
      userId,
      "SCHEDULED",
      "Repost created with schedule"
    );
    return { success: true, postId: post.id };
  }

  const sourceEv = parseSourceSignedEvent(data.sourceSignedEvent);
  if (!sourceEv) {
    return json({ error: "Invalid source event" }, { status: 400 });
  }
  if (sourceEv.kind === 6) {
    return json({ error: REPOST_CHAIN_BLOCKED_ERROR }, { status: 400 });
  }
  const queueTypeId = await resolveQueueTypeId(userId, null, null);
  const post = await createPostWithOutbox(
    {
      userId,
      content: "",
      caption: "",
      fileUrl: [],
      postType: "TEXT",
      queueTypeId,
      scheduledAtUtc,
      tags: [],
      repost: true,
      isQuotedPost: false,
      postKind: "REPOST",
      signedEvent,
      signedChildEventId: signedEvent.id,
      signingState: "signed",
      dependencyMode: "standalone",
      targetMode: "direct",
      ...(columnExists ? { creationIdempotencyKey } : {}),
      ...(repostConditions && { repostConditions }),
    },
    scheduledForUnix
  );
  const stateMachine = new PostStateMachine();
  await stateMachine.transition(
    post.id,
    userId,
    "SCHEDULED",
    "Repost created with schedule"
  );
  return { success: true, postId: post.id };
}

async function handleScheduleQuote(
  data: {
    postId?: string;
    sourceSignedEvent?: string;
    scheduledFor: string;
    signedEvent: string;
    quoteCaption?: string;
  },
  userId: string
) {
  const signedEvent = parseSignedEvent(data.signedEvent);
  if (!signedEvent) {
    return json({ error: "Invalid signed event" }, { status: 400 });
  }
  const scheduledForUnix = parseInt(data.scheduledFor, 10);
  if (Number.isNaN(scheduledForUnix)) {
    return json({ error: "Invalid scheduled time" }, { status: 400 });
  }
  const scheduledAtUtc = new Date(scheduledForUnix * 1000);
  const creationIdempotencyKey = generateCreationIdempotencyKey(
    userId,
    `scheduleQuote:${signedEvent.id}`,
    scheduledForUnix
  );
  const { existing, columnExists } =
    await getExistingScheduledPostByIdempotency(creationIdempotencyKey);
  if (existing) {
    return { success: true, postId: existing.id };
  }
  const quoteCaption = data.quoteCaption ?? "";
  try {
    await assertScheduleCapacity(userId, 1);
  } catch (e) {
    if (e instanceof ScheduleCapExceededError) {
      return json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  const postId = data.postId?.trim();
  if (postId) {
    const sourcePost = await getPostById({ id: postId, userId });
    if (!sourcePost) {
      return json({ error: "Post not found" }, { status: 404 });
    }
    if (isPureRepostSourcePost(sourcePost)) {
      return json({ error: REPOST_CHAIN_BLOCKED_ERROR }, { status: 400 });
    }
    const isAttachedFollowUp =
      sourcePost.currentState === "SCHEDULED" &&
      sourcePost.nostrEventId == null;
    const expectedParentEventId =
      sourcePost.nostrEventId ??
      getSignedEventIdFromUnknown(sourcePost.signedEvent);
    if (isAttachedFollowUp && !expectedParentEventId) {
      return json({ error: PARENT_SIGNING_REQUIRED_ERROR }, { status: 400 });
    }
    const post = await createPostWithOutbox(
      {
        userId,
        content: quoteCaption,
        caption: quoteCaption,
        fileUrl: [],
        postType: sourcePost.postType,
        queueTypeId: sourcePost.queueTypeId,
        scheduledAtUtc,
        tags: [],
        repost: false,
        isQuotedPost: true,
        quoteOfPostId: sourcePost.id,
        postKind: "QUOTE",
        signedEvent,
        signedChildEventId: signedEvent.id,
        signingState: "signed",
        ...(isAttachedFollowUp
          ? {
              parentScheduledActionId: sourcePost.id,
              rootScheduledActionId:
                sourcePost.rootScheduledActionId ?? sourcePost.id,
              targetScheduledActionId: sourcePost.id,
              dependencyMode: "attached" as const,
              targetMode: "scheduled_parent" as const,
              followUpTimingMode: "fixed_datetime" as const,
              expectedParentEventId: expectedParentEventId ?? undefined,
            }
          : {
              dependencyMode: "standalone" as const,
              targetMode: "direct" as const,
            }),
        ...(columnExists ? { creationIdempotencyKey } : {}),
      },
      scheduledForUnix
    );
    const stateMachine = new PostStateMachine();
    await stateMachine.transition(
      post.id,
      userId,
      "SCHEDULED",
      "Quote post created with schedule"
    );
    return { success: true, postId: post.id };
  }

  const sourceEv = parseSourceSignedEvent(data.sourceSignedEvent);
  if (!sourceEv) {
    return json({ error: "Invalid source event" }, { status: 400 });
  }
  if (sourceEv.kind === 6) {
    return json({ error: REPOST_CHAIN_BLOCKED_ERROR }, { status: 400 });
  }
  const queueTypeId = await resolveQueueTypeId(userId, null, null);
  const post = await createPostWithOutbox(
    {
      userId,
      content: quoteCaption,
      caption: quoteCaption,
      fileUrl: [],
      postType: "TEXT",
      queueTypeId,
      scheduledAtUtc,
      tags: [],
      repost: false,
      isQuotedPost: true,
      postKind: "QUOTE",
      signedEvent,
      signedChildEventId: signedEvent.id,
      signingState: "signed",
      dependencyMode: "standalone",
      targetMode: "direct",
      ...(columnExists ? { creationIdempotencyKey } : {}),
    },
    scheduledForUnix
  );
  const stateMachine = new PostStateMachine();
  await stateMachine.transition(
    post.id,
    userId,
    "SCHEDULED",
    "Quote post created with schedule"
  );
  return { success: true, postId: post.id };
}

/** Source note from lookup (may omit sig); used only for validation. */
function parseSourceSignedEvent(raw: string | undefined): {
  kind: number;
} | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("kind" in parsed)) {
      return null;
    }
    const kind = Number((parsed as { kind?: unknown }).kind);
    if (Number.isNaN(kind)) return null;
    return { kind };
  } catch {
    return null;
  }
}

function parseSignedEvent(raw: string): {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
} | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      !("pubkey" in parsed) ||
      !("created_at" in parsed) ||
      !("kind" in parsed) ||
      !("tags" in parsed) ||
      !("content" in parsed) ||
      !("sig" in parsed)
    ) {
      return null;
    }
    return parsed as {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    };
  } catch {
    return null;
  }
}
