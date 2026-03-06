/**
 * Recyclable Posts Service
 *
 * Handles recyclable posts data loading and actions (repost, quote, delete)
 */

import { json } from "@remix-run/node";

import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById } from "~/features/user";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import { nowSeconds } from "~/lib/temporal";
import {
  recyclableActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { deletePost } from "~/models/post.commands.server";
import {
  getRecyclablePosts,
  getPostsByIds,
} from "~/models/post.queries.server";

import { toPostDTOArray, type PostDTO } from "../dtos";
import { getPostStats } from "../stats.server";
import type { PostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

const ERROR_POST_NOT_FOUND = "Post not found";

/**
 * Get recyclable posts dashboard data
 */
export async function getRecyclableDashboardData({
  userId,
  params,
  url,
}: {
  userId: string;
  params: { queueType?: string };
  url: URL;
}) {
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const hasDateRange = Boolean(dateFrom ?? dateTo);
  const page = hasDateRange ? 1 : parseInt(url.searchParams.get("page") ?? "1");
  const limit = hasDateRange ? 5000 : 20;
  const queueType = params.queueType ?? "all";

  const userResult = await getUserById(userId);
  if (!userResult) throw new Error("User not found");
  const user: UserWithHashTagPresets = userResult;
  const timezone = user.timezone?.trim() ?? "UTC";

  const [{ posts, pagination }, queueTypesResult] = await Promise.all([
    getRecyclablePosts({
      userId,
      page,
      limit,
      queueType,
      dateFrom,
      dateTo,
      timezone,
    }),
    getQueueTypesCached(userId),
  ]);
  const queueTypes = Array.isArray(queueTypesResult) ? queueTypesResult : [];

  // Get event IDs from signedEvent.id
  const eventIds = posts
    .map((post) => {
      const signedEvent = post.signedEvent;
      if (
        signedEvent &&
        typeof signedEvent === "object" &&
        "id" in signedEvent &&
        typeof signedEvent["id"] === "string"
      ) {
        return signedEvent["id"];
      }
      return "";
    })
    .filter((id) => id !== "");

  // Use the extracted stats fetching logic
  const stats = await getPostStats(eventIds);

  // Convert PostWithQueueType[] to PostData[] and serialize to DTOs
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const result: PostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  const postsDTO: PostDTO[] = toPostDTOArray(postsData);

  const outPagination = hasDateRange ? { ...pagination, pages: 1 } : pagination;

  return {
    posts: postsDTO,
    pagination: outPagination,
    stats,
    user,
    queueTypes: queueTypes.filter(
      (qt: unknown) =>
        typeof qt === "object" &&
        qt !== null &&
        "isEnabled" in qt &&
        qt.isEnabled !== false
    ),
    selectedQueueType: queueType,
  };
}

// ============================================================================
// Action Handler Helpers
// ============================================================================

async function handleDeleteAction(
  postId: string,
  userId: string
): Promise<Response> {
  await deletePost({ id: postId, userId });
  return json({ success: true });
}

async function handleBulkDeleteAction(
  postIds: string[],
  userId: string
): Promise<Response> {
  await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
  return json({ success: true });
}

async function handleBulkRepostAction(
  postIds: string[],
  userId: string
): Promise<Response> {
  const postsData = await getPostsByIds({
    ids: postIds,
    userId,
  });
  return json({ repostData: postsData });
}

async function handleBulkScheduledRepostAction(
  postIds: string[],
  userId: string
): Promise<Response> {
  const postsData = await getPostsByIds({
    ids: postIds,
    userId,
  });
  return json({ scheduledRepostData: postsData });
}

function extractEventData(signedEvent: unknown): {
  eventId: string;
  eventPubkey: string;
} {
  let eventId = "";
  let eventPubkey = "";

  if (
    signedEvent &&
    typeof signedEvent === "object" &&
    !Array.isArray(signedEvent)
  ) {
    if ("id" in signedEvent && typeof signedEvent["id"] === "string") {
      eventId = signedEvent["id"];
    }
    if ("pubkey" in signedEvent && typeof signedEvent["pubkey"] === "string") {
      eventPubkey = signedEvent["pubkey"];
    }
  }

  return { eventId, eventPubkey };
}

function getQueueTypeName(post: PostData): string {
  if (
    post.queueType &&
    typeof post.queueType === "object" &&
    "name" in post.queueType &&
    typeof post.queueType.name === "string"
  ) {
    return post.queueType.name;
  }
  return "unassigned";
}

function transformPostToQuoteFormat(post: PostData): {
  caption: string;
  fileUrl: string;
  queueType: string;
  scheduledFor: string;
  originalPostId: string;
  originalEventId: string;
  originalEventPubkey: string;
  isQuotePost: boolean;
  originalCaption: string;
} {
  const { eventId, eventPubkey } = extractEventData(post.signedEvent);

  const fileUrl = Array.isArray(post.fileUrl)
    ? post.fileUrl
    : typeof post.fileUrl === "string"
      ? [post.fileUrl]
      : [];
  const caption = typeof post.caption === "string" ? post.caption : "";

  return {
    caption: "", // Empty caption - user can add content
    fileUrl: fileUrl.length > 0 ? (fileUrl[0] ?? "") : "",
    queueType: getQueueTypeName(post),
    scheduledFor: "",
    originalPostId: post.id,
    originalEventId: eventId,
    originalEventPubkey: eventPubkey,
    isQuotePost: true,
    originalCaption: caption,
  };
}

async function handleBulkQuoteAction(
  postIds: string[],
  userId: string
): Promise<Response> {
  const postsData = await getPostsByIds({
    ids: postIds,
    userId,
  });

  const quotePostsData = postsData.map((post) =>
    transformPostToQuoteFormat(post as PostData)
  );
  return json({ quotePostData: quotePostsData });
}

async function handleSingleRepostAction(
  repostData: { postId: string },
  userId: string
): Promise<Response> {
  try {
    const postsData = await getPostsByIds({
      ids: [repostData.postId],
      userId,
    });
    if (postsData.length === 0) {
      const { NotFoundError } = await import("~/lib/errors");
      throw new NotFoundError(ERROR_POST_NOT_FOUND, {
        postId: repostData.postId,
        userId,
      });
    }

    const originalPost = postsData[0];
    if (!originalPost) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json({ error: "Invalid event data" }, { status: 400 });
    }

    const { eventId, eventPubkey } = extractEventData(originalEvent);

    const kind6EventData = {
      kind: 6,
      content: "",
      tags: [
        ["e", eventId, "wss://relay.primal.net"],
        ["p", eventPubkey],
      ],
      created_at: nowSeconds(),
    };

    return json({
      repostEventData: kind6EventData,
      originalPost: originalPost,
    });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

function extractQuotePostData(originalPost: PostData): {
  fileUrl: string;
  queueTypeName: string;
  caption: string;
  originalPostId: string;
} {
  const fileUrl =
    "fileUrl" in originalPost
      ? Array.isArray(originalPost.fileUrl)
        ? originalPost.fileUrl[0]
        : typeof originalPost.fileUrl === "string"
          ? originalPost.fileUrl
          : ""
      : "";
  const queueTypeName = getQueueTypeName(originalPost);
  const caption =
    "caption" in originalPost && typeof originalPost.caption === "string"
      ? originalPost.caption
      : "";
  const originalPostId =
    "id" in originalPost && typeof originalPost.id === "string"
      ? originalPost.id
      : "";
  const fileUrlString = typeof fileUrl === "string" ? fileUrl : "";

  return { fileUrl: fileUrlString, queueTypeName, caption, originalPostId };
}

async function handleSingleQuoteAction(
  quoteData: { postId: string },
  userId: string
): Promise<Response> {
  try {
    const postsData = await getPostsByIds({
      ids: [quoteData.postId],
      userId,
    });
    if (postsData.length === 0) {
      const { NotFoundError } = await import("~/lib/errors");
      throw new NotFoundError(ERROR_POST_NOT_FOUND, {
        postId: quoteData.postId,
        userId,
      });
    }

    const originalPost = postsData[0];
    if (!originalPost) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json({ error: "Invalid event data" }, { status: 400 });
    }

    const { eventId, eventPubkey } = extractEventData(originalEvent);
    const { fileUrl, queueTypeName, caption, originalPostId } =
      extractQuotePostData(originalPost as PostData);

    const quotePostData = {
      caption: "",
      fileUrl,
      queueType: queueTypeName,
      scheduledFor: "",
      originalPostId: originalPostId,
      originalEventId: eventId,
      originalEventPubkey: eventPubkey,
      isQuotePost: true,
      originalCaption: caption,
    };

    return json({ quotePostData: [quotePostData] });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

/**
 * Handle recyclable post actions (delete, repost, quote)
 */
export async function handleRecyclablePostAction(
  formData: FormData,
  userId: string
) {
  // Validate with Zod
  const result = validateFormDataOrRespond(formData, recyclableActionSchema);
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;

  // Handle delete action
  if (validatedData._action === "delete") {
    return handleDeleteAction(validatedData.postId, userId);
  }

  // Handle bulk delete
  if (validatedData._action === "bulkDelete") {
    return handleBulkDeleteAction(validatedData.postIds, userId);
  }

  // Handle bulk repost
  if (validatedData._action === "bulkRepost") {
    return handleBulkRepostAction(validatedData.postIds, userId);
  }

  // Handle bulk scheduled repost
  if (validatedData._action === "bulkScheduledRepost") {
    return handleBulkScheduledRepostAction(validatedData.postIds, userId);
  }

  // Handle bulk quote
  if (validatedData._action === "bulkQuote") {
    return handleBulkQuoteAction(validatedData.postIds, userId);
  }

  // Handle single repost
  if (validatedData._action === "repost") {
    return handleSingleRepostAction(validatedData, userId);
  }

  // Handle recycle action
  if (validatedData._action === "recycle") {
    return handleRecycleAction(
      {
        postId: validatedData.postId,
        scheduledFor: validatedData.scheduledFor,
        queueTypeId: validatedData.queueTypeId ?? undefined,
        queueType: validatedData.queueType,
      },
      userId
    );
  }

  // Handle single quote
  return handleSingleQuoteAction(validatedData, userId);
}

async function handleRecycleAction(
  recycleData: {
    postId: string;
    scheduledFor?: string;
    queueTypeId?: string;
    queueType?: string;
  },
  userId: string
): Promise<Response> {
  try {
    const { RecyclePostUseCase } =
      await import("~/features/posts/use-cases/recycle-post.use-case.server");
    const recycleUseCase = new RecyclePostUseCase();
    const scheduledFor = recycleData.scheduledFor
      ? parseInt(recycleData.scheduledFor, 10)
      : undefined;
    const result = await recycleUseCase.execute({
      originalPostId: recycleData.postId,
      userId,
      scheduledFor,
      queueTypeId: recycleData.queueTypeId,
      queueType: recycleData.queueType,
    });
    return json({
      success: true,
      newPostId: result.newPostId,
      scheduled: result.scheduled,
    });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
