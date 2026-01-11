/**
 * Scheduled Posts Service
 *
 * Handles scheduled posts data loading and actions
 */

import type { Prisma } from "@prisma/client";
import { json } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { cancelPostJob as cancelScheduledPost } from "~/infra/queue";
import { logError } from "~/lib/error-logger.server";
import {
  getScheduledLongFormPosts,
  deleteLongFormPost,
  updateLongFormPost,
  getLongFormPost as getLongFormPostModel,
} from "~/models/longformpost.server";
import {
  deletePost,
  reschedulePost,
  updatePost,
} from "~/models/post.commands.server";
import { getScheduledPosts, getPostById } from "~/models/post.queries.server";

const ERROR_POST_NOT_FOUND = "Post not found";
const ERROR_LONGFORM_POST_NOT_FOUND = "Longform post not found";
const ERROR_PARSING_SIGNED_EVENTS = "Error parsing signed events";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future use
const QUEUE_SCHEDULED_POSTS = "scheduled-posts";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future use
const QUEUE_SCHEDULED_LONGFORM_POSTS = "scheduled-longform-posts";

import { combineContent } from "../combined.server";
import { convertPrismaQueueTypeToQueueType } from "../types";
import type { PostData, LongFormPostData } from "../types";
import { ScheduleLongFormPostUseCase } from "../use-cases/schedule-longform-post.use-case.server";
import { SchedulePostUseCase } from "../use-cases/schedule-post.use-case.server";

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
  const [posts, allLongformPosts, user, queueTypesRaw, hashTagPresetsRaw] =
    await Promise.all([
      getScheduledPosts({ userId, queueType }),
      getScheduledLongFormPosts({ userId }),
      getUserById(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
    ]);

  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];
  const hashTagPresets = Array.isArray(hashTagPresetsRaw)
    ? hashTagPresetsRaw
    : [];

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts =
    queueType === "all"
      ? allLongformPosts
      : allLongformPosts.filter((post) => post.queueType?.name === queueType);

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
    queueTypes: queueTypes.filter(
      (qt: unknown) =>
        typeof qt === "object" &&
        qt !== null &&
        "isEnabled" in qt &&
        qt.isEnabled !== false
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
  await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
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
      return deletePost({ id: item.id, userId });
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

  await cancelScheduledPost(postId);

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  const updatedPost = await reschedulePost({
    id: postId,
    userId,
    newScheduledFor: newTime,
    overrideQueue,
    queueTypeId,
    signedEvent: parsedSignedEvent as unknown as SignedEvent | undefined,
    nostrEvent: parsedNostrEvent as unknown as NostrEvent | undefined,
  });

  if (parsedSignedEvent && parsedNostrEvent) {
    // Use SchedulePostUseCase for rescheduling
    const schedulePostUseCase = new SchedulePostUseCase();
    const scheduledAtUtc = new Date(parseInt(newTime) * 1000);
    await schedulePostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: parsedSignedEvent as SignedEvent,
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
    const scheduledAtUtc = new Date(parseInt(newTime) * 1000);
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
      publishedAt: scheduledAtUtc,
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
    publishedAt: new Date(parseInt(newTime) * 1000),
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

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  const parsedFileUrl = parseFileUrl(fileUrl, userId, postId);

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
      scheduledFor: scheduledFor ? String(Number(scheduledFor)) : undefined,
      signedEvent: parsedSignedEvent ?? undefined,
      nostrEvent: parsedNostrEvent ?? undefined,
      hashTagPresetId,
    },
  });

  if (scheduledFor && parsedSignedEvent) {
    await cancelScheduledPost(postId);
    // Use SchedulePostUseCase for rescheduling
    const schedulePostUseCase = new SchedulePostUseCase();
    const scheduledAtUtc = new Date(Number(scheduledFor) * 1000);
    await schedulePostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc,
      signedEvent: parsedSignedEvent as SignedEvent,
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

  const { signedEvent: parsedSignedEvent, nostrEvent: parsedNostrEvent } =
    parseSignedEvents(signedEventStr, nostrEventStr, userId, postId);

  const updated = await updateLongFormPost({
    id: postId,
    userId,
    title,
    summary,
    content,
    image,
    publishedAt: scheduledFor
      ? new Date(Number(scheduledFor) * 1000)
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
