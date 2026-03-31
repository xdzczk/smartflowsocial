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
import {
  createPostWithOutbox,
  deleteLongFormPost,
  deletePost,
  getPostById,
} from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import {
  scheduledActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { MoveScheduledToDraftUseCase } from "../use-cases/move-scheduled-to-draft.use-case.server";

const REPOST_CHAIN_BLOCKED_ERROR = "Cannot repost or quote a repost.";

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
    const deletedPost = await deletePost({ id: result.data.postId, userId });
    // Return success even if post was already deleted (idempotent operation)
    return { success: true, deleted: deletedPost !== null };
  }

  if (_action === "deleteLongForm") {
    const deletedPost = await deleteLongFormPost({
      id: result.data.postId,
      userId,
    });
    // Return success even if post was already deleted (idempotent operation)
    return { success: true, deleted: deletedPost !== null };
  }

  if (_action === "bulkDelete") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) => deletePost({ id, userId }))
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  if (_action === "bulkDeleteLongForm") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) =>
        deleteLongFormPost({ id, userId })
      )
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  // TypeScript guarantees this is "bulkDeleteMixed" after previous checks
  const promises = result.data.itemData.map((item) => {
    if (item.type === "post") {
      return deletePost({ id: item.id, userId });
    } else {
      return deleteLongFormPost({ id: item.id, userId });
    }
  });
  const results = await Promise.all(promises);
  const deletedCount = results.filter((post) => post !== null).length;
  return { success: true, deletedCount };
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
