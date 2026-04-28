/**
 * Scheduled Posts Service
 *
 * Handles scheduled posts data loading and actions
 */

import { json } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { assertScheduleCapacity } from "~/features/payments/entitlements/schedule-cap-policy.server";
import { combineContent } from "~/features/posts/combined.server";
import { ScheduleLongFormPostUseCase } from "~/features/posts/longform/index.server";
import { shouldShowQueueInUi } from "~/features/posts/queue-status";
import {
  getScheduledLongFormPosts,
  deleteLongFormPost,
  updateLongFormPost,
  getLongFormPost as getLongFormPostModel,
  deletePost,
  reschedulePost,
  updatePost,
  getScheduledPosts,
  getPostById,
} from "~/features/posts/server";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { fromUnixTimestamp, toDate, toPrismaDate } from "~/lib/temporal";

import type { Prisma } from "../../data/posts-prisma-types.server";
import { SchedulePostUseCase } from "../use-cases/schedule-post.use-case.server";

import {
  cascadeAttachedReschedule,
  cascadeDeleteAttachedFollowups,
  resyncAttachedChildrenAfterParentMutation,
} from "./attached-followups.server";

const ERROR_POST_NOT_FOUND = "Post not found";
const ERROR_LONGFORM_POST_NOT_FOUND = "Article not found";
const ERROR_PARSING_SIGNED_EVENTS = "Error parsing signed events";

/**
 * Get scheduled posts dashboard data
 */
export async function getScheduledDashboardData({
  userId,
  queueType,
}: {
  userId: string;
  queueType: string;
}) {
  const [
    postsResult,
    allLongformPostsResult,
    user,
    queueTypesRaw,
    hashTagPresetsRaw,
  ] = await Promise.all([
    getScheduledPosts({ userId, queueType }),
    getScheduledLongFormPosts({ userId, queueType }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  // Extract posts arrays from pagination results
  const posts =
    "posts" in postsResult && Array.isArray(postsResult.posts)
      ? postsResult.posts
      : [];
  const longformPosts =
    "posts" in allLongformPostsResult &&
    Array.isArray(allLongformPostsResult.posts)
      ? allLongformPostsResult.posts
      : [];

  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];
  const hashTagPresets = Array.isArray(hashTagPresetsRaw)
    ? hashTagPresetsRaw
    : [];

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const postData: PostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return postData;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformPosts.map((post) => {
    const signedEventValue: LongFormPostData["signedEvent"] =
      post.signedEvent as LongFormPostData["signedEvent"];
    const nostrEventValue: LongFormPostData["nostrEvent"] =
      post.nostrEvent as LongFormPostData["nostrEvent"];
    const longformPostData: LongFormPostData = {
      ...post,
      queueType: convertPrismaQueueTypeToQueueType(
        "queueType" in post ? post.queueType : undefined
      ),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return longformPostData;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    postsData,
    longformPostsData,
    "scheduledFor",
    "asc"
  );

  return {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes: queueTypes.filter((qt: unknown) =>
      typeof qt === "object" && qt !== null ? shouldShowQueueInUi(qt) : false
    ),
    selectedQueueType: queueType,
    hashTagPresets,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ParsedSignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig: string;
}

interface ParsedNostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}

function parseSignedEvents(
  signedEventStr: string | null,
  nostrEventStr: string | null,
  userId: string,
  postId: string
): {
  signedEvent: ParsedSignedEvent | null;
  nostrEvent: ParsedNostrEvent | null;
} {
  if (!signedEventStr || !nostrEventStr) {
    return { signedEvent: null, nostrEvent: null };
  }

  try {
    const parsedSigned: unknown = JSON.parse(signedEventStr);
    const parsedNostr: unknown = JSON.parse(nostrEventStr);
    const signedEvent =
      typeof parsedSigned === "object" && parsedSigned !== null
        ? (parsedSigned as ParsedSignedEvent)
        : null;
    const nostrEvent =
      typeof parsedNostr === "object" && parsedNostr !== null
        ? (parsedNostr as ParsedNostrEvent)
        : null;
    return { signedEvent, nostrEvent };
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), {
      userId,
      postId,
      message: ERROR_PARSING_SIGNED_EVENTS,
    });
    return { signedEvent: null, nostrEvent: null };
  }
}

function parsePostIds(postIdsValue: FormDataEntryValue | null): string[] {
  const postIdsStr = postIdsValue ? String(postIdsValue) : "[]";
  try {
    const parsed: unknown = JSON.parse(postIdsStr);
    return Array.isArray(parsed)
      ? parsed.filter((id: unknown): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function parseItemData(
  itemDataValue: FormDataEntryValue | null
): Array<{ id: string; type: string }> {
  const itemDataStr = itemDataValue ? String(itemDataValue) : "[]";
  try {
    const parsed: unknown = JSON.parse(itemDataStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item: unknown): item is { id: string; type: string } =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "type" in item &&
          typeof (item as { id: unknown; type: unknown }).id === "string" &&
          typeof (item as { id: unknown; type: unknown }).type === "string"
      );
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function parseFileUrl(
  fileUrl: string | null,
  userId: string,
  postId: string
): string[] {
  if (!fileUrl) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(fileUrl);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item: unknown): item is string => typeof item === "string"
        )
      : [];
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), {
      userId,
      postId,
      fileUrl,
      message: "Error parsing fileUrl",
    });
    return [];
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleDelete(postId: string, userId: string) {
  await cascadeDeleteAttachedFollowups({ rootPostId: postId, userId });
  await deletePost({ id: postId, userId });
  return json({ success: true });
}

async function handleDeleteLongForm(postId: string, userId: string) {
  await deleteLongFormPost({ id: postId, userId });
  return json({ success: true });
}

async function handleBulkDelete(formData: FormData, userId: string) {
  const postIdsValue = formData.get("postIds");
  const postIds = parsePostIds(postIdsValue);
  await Promise.all(
    postIds.map(async (id: string) => {
      await cascadeDeleteAttachedFollowups({ rootPostId: id, userId });
      await deletePost({ id, userId });
    })
  );
  return json({ success: true });
}

async function handleBulkDeleteLongForm(formData: FormData, userId: string) {
  const postIdsValue = formData.get("postIds");
  const postIds = parsePostIds(postIdsValue);
  await Promise.all(
    postIds.map((id: string) => deleteLongFormPost({ id, userId }))
  );
  return json({ success: true });
}

async function handleBulkDeleteMixed(formData: FormData, userId: string) {
  const itemDataValue = formData.get("itemData");
  const itemData = parseItemData(itemDataValue);
  const promises = itemData.map((item: { id: string; type: string }) => {
    if (item.type === "post") {
      return (async () => {
        await cascadeDeleteAttachedFollowups({ rootPostId: item.id, userId });
        return deletePost({ id: item.id, userId });
      })();
    } else {
      return deleteLongFormPost({ id: item.id, userId });
    }
  });
  await Promise.all(promises);
  return json({ success: true });
}

async function handleReschedule(formData: FormData, userId: string) {
  const postId = formData.get("postId") as string;
  const newTime = formData.get("newTime") as string;
  const overrideQueue = formData.get("overrideQueue") === "true";
  const signedEventStr = formData.get("signedEvent") as string;
  const nostrEventStr = formData.get("nostrEvent") as string;
  const queueTypeId = formData.get("queueTypeId") as string;

  if (!postId || !newTime) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  const originalPost = await getPostById({ id: postId, userId });
  if (!originalPost) {
    return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
  }

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  if (originalPost.parentScheduledActionId && newTime) {
    const parent = await getPostById({
      id: originalPost.parentScheduledActionId,
      userId,
    });
    if (parent?.scheduledAtUtc) {
      const parentUnix = Math.floor(parent.scheduledAtUtc.getTime() / 1000);
      if (Number(newTime) < parentUnix) {
        return json(
          { error: "Follow-up must be scheduled at or after the parent post." },
          { status: 400 }
        );
      }
    }
  }

  const updatedPost = await reschedulePost({
    id: postId,
    userId,
    scheduledAtUtc: parseInt(newTime, 10),
    overrideQueue,
    queueTypeId,
    signedEvent: parsedSignedEvent as unknown as SignedEvent | undefined,
    nostrEvent: parsedNostrEvent as unknown as NostrEvent | undefined,
  });
  const parentScheduleDate =
    updatedPost.scheduledAtUtc ?? new Date(parseInt(newTime, 10) * 1000);
  await cascadeAttachedReschedule({
    rootPostId: postId,
    userId,
    parentScheduledAtUtc: parentScheduleDate,
  });

  if (parsedSignedEvent && parsedNostrEvent) {
    // Use SchedulePostUseCase for rescheduling
    const schedulePostUseCase = new SchedulePostUseCase();
    // Convert Unix timestamp (seconds) to Temporal ZonedDateTime
    const scheduledAtUtc = fromUnixTimestamp(parseInt(newTime), "UTC");
    await schedulePostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: parsedSignedEvent as SignedEvent,
    });
    await resyncAttachedChildrenAfterParentMutation({
      parentPostId: postId,
      userId,
      parentPredictedEventId: parsedSignedEvent.id,
    });
    return json({ success: true, post: updatedPost, signed: true });
  }

  return json({ success: true, post: updatedPost, needsSigning: true });
}

async function handleRescheduleLongform(formData: FormData, userId: string) {
  const postId = formData.get("postId") as string;
  const newTime = formData.get("newTime") as string;
  const signedEventStr = formData.get("signedEvent") as string;
  const nostrEventStr = formData.get("nostrEvent") as string;

  if (!postId || !newTime) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  const originalPost = await getLongFormPostModel({ id: postId, userId });
  if (!originalPost) {
    return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
  }

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  if (parsedSignedEvent) {
    // Use ScheduleLongFormPostUseCase for rescheduling
    const scheduleLongFormPostUseCase = new ScheduleLongFormPostUseCase();
    // Convert Unix timestamp (seconds) to Temporal ZonedDateTime
    const scheduledAtUtc = fromUnixTimestamp(parseInt(newTime), "UTC");
    await scheduleLongFormPostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: parsedSignedEvent as SignedEvent,
    });

    // Also update the post with other fields
    const updatedPost = await updateLongFormPost({
      id: postId,
      userId,
      publishedAt: toPrismaDate(scheduledAtUtc),
      status: "SCHEDULED",
      signedEvent: JSON.parse(
        JSON.stringify(parsedSignedEvent)
      ) as Prisma.JsonValue,
      nostrEvent: parsedNostrEvent
        ? (JSON.parse(JSON.stringify(parsedNostrEvent)) as Prisma.JsonValue)
        : undefined,
    });

    return json({
      success: true,
      post: updatedPost,
      signed: true,
    });
  }

  // If no signed event, just update the post
  const updatedPost = await updateLongFormPost({
    id: postId,
    userId,
    publishedAt: toDate(fromUnixTimestamp(parseInt(newTime), "UTC")), // Keep as Date for Prisma
    status: "SCHEDULED",
  });

  return json({
    success: true,
    post: updatedPost,
    signed: false,
    needsSigning: true,
  });
}

async function handleEditPost(formData: FormData, userId: string) {
  const postId = formData.get("postId") as string;
  const caption = (formData.get("caption") ?? "") as string;
  const fileUrl = (formData.get("fileUrl") ?? "") as string;
  const hashtags = (formData.get("hashtags") ?? "") as string;
  const signedEventStr = formData.get("signedEvent") as string;
  const nostrEventStr = formData.get("nostrEvent") as string;
  const queueTypeId = (formData.get("queueTypeId") as string | null) ?? null;
  const scheduledFor = (formData.get("scheduledFor") as string | null) ?? null;
  const hashTagPresetId =
    (formData.get("hashTagPresetId") as string | null) ?? null;

  if (!postId) {
    return json({ error: "Missing postId" }, { status: 400 });
  }

  const originalPost = await getPostById({ id: postId, userId });
  if (!originalPost) {
    return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
  }

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  const parsedFileUrl = parseFileUrl(fileUrl, userId, postId);

  if (scheduledFor && parsedSignedEvent) {
    const now = new Date();
    let additionalSlots = 1;
    if (
      originalPost.currentState === "SCHEDULED" &&
      originalPost.scheduledAtUtc &&
      originalPost.scheduledAtUtc > now
    ) {
      additionalSlots = 0;
    }
    await assertScheduleCapacity(userId, additionalSlots);
  }
  if (scheduledFor) {
    await cascadeAttachedReschedule({
      rootPostId: postId,
      userId,
      parentScheduledAtUtc: new Date(Number(scheduledFor) * 1000),
    });
  }

  const updated = await updatePost({
    id: postId,
    userId,
    data: {
      caption,
      fileUrl: parsedFileUrl,
      tags: hashtags
        ? hashtags
            .toString()
            .split(" ")
            .filter((tag) => tag.trim())
        : [],
      queueTypeId,
      scheduledAtUtc: scheduledFor
        ? parseInt(String(scheduledFor), 10)
        : undefined,
      signedEvent: parsedSignedEvent ?? undefined,
      nostrEvent: parsedNostrEvent ?? undefined,
      hashTagPresetId,
    },
  });

  if (scheduledFor && parsedSignedEvent) {
    // Use SchedulePostUseCase for rescheduling
    const schedulePostUseCase = new SchedulePostUseCase();
    // Convert Unix timestamp (seconds) to Temporal ZonedDateTime
    const scheduledAtUtc = fromUnixTimestamp(Number(scheduledFor), "UTC");
    await schedulePostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: parsedSignedEvent as SignedEvent,
    });
  }
  if (parsedSignedEvent) {
    await resyncAttachedChildrenAfterParentMutation({
      parentPostId: postId,
      userId,
      parentPredictedEventId: parsedSignedEvent.id,
    });
  } else {
    await resyncAttachedChildrenAfterParentMutation({
      parentPostId: postId,
      userId,
      parentPredictedEventId: null,
    });
  }

  return json({
    success: true,
    post: updated,
    signed: !!parsedSignedEvent,
  });
}

async function handleEditLongform(formData: FormData, userId: string) {
  const postId = formData.get("postId") as string;
  const title = (formData.get("title") ?? "") as string;
  const summary = (formData.get("summary") ?? "") as string;
  const content = (formData.get("content") ?? "") as string;
  const image = (formData.get("image") ?? "") as string;
  const signedEventStr = formData.get("signedEvent") as string;
  const nostrEventStr = formData.get("nostrEvent") as string;
  const scheduledFor = (formData.get("scheduledFor") as string | null) ?? null;

  if (!postId) {
    return json({ error: "Missing postId" }, { status: 400 });
  }

  const originalLongform = await getLongFormPostModel({ id: postId, userId });
  if (!originalLongform) {
    return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
  }

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  if (scheduledFor) {
    const now = new Date();
    let additionalSlots = 1;
    if (
      originalLongform.currentState === "SCHEDULED" &&
      originalLongform.scheduledAtUtc &&
      originalLongform.scheduledAtUtc > now
    ) {
      additionalSlots = 0;
    }
    await assertScheduleCapacity(userId, additionalSlots);
  }

  const updated = await updateLongFormPost({
    id: postId,
    userId,
    title,
    summary,
    content,
    image,
    publishedAt: scheduledFor
      ? toDate(fromUnixTimestamp(Number(scheduledFor), "UTC"))
      : undefined,
    status: "SCHEDULED",
    signedEvent: parsedSignedEvent
      ? (JSON.parse(JSON.stringify(parsedSignedEvent)) as Prisma.JsonValue)
      : undefined,
    nostrEvent: parsedNostrEvent
      ? (JSON.parse(JSON.stringify(parsedNostrEvent)) as Prisma.JsonValue)
      : undefined,
  });

  return json({
    success: true,
    post: updated,
    signed: !!parsedSignedEvent,
  });
}

// ============================================================================
// Main Action Router
// ============================================================================

/**
 * Handle scheduled post actions (delete, reschedule, edit)
 */
export async function handleScheduledPostAction(
  formData: FormData,
  userId: string
) {
  const postId = formData.get("postId") as string;
  const _action = formData.get("_action");

  const actionHandlers: Record<
    string,
    (formData: FormData, userId: string) => Promise<ReturnType<typeof json>>
  > = {
    delete: () => handleDelete(postId, userId),
    deleteLongForm: () => handleDeleteLongForm(postId, userId),
    bulkDelete: () => handleBulkDelete(formData, userId),
    bulkDeleteLongForm: () => handleBulkDeleteLongForm(formData, userId),
    bulkDeleteMixed: () => handleBulkDeleteMixed(formData, userId),
    reschedule: () => handleReschedule(formData, userId),
    rescheduleLongform: () => handleRescheduleLongform(formData, userId),
    editPost: () => handleEditPost(formData, userId),
    editLongform: () => handleEditLongform(formData, userId),
  };

  const handler =
    _action && typeof _action === "string"
      ? actionHandlers[_action]
      : undefined;

  if (handler) {
    return await handler(formData, userId);
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
