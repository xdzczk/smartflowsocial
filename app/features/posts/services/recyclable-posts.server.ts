/**
 * Recyclable Posts Service
 *
 * Handles recyclable posts data loading and actions (repost, quote, delete)
 */

import { json } from "@remix-run/node";

import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById, getQueueTypes } from "~/features/user";
import {
  recyclableActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { deletePost } from "~/models/post.commands.server";
import {
  getRecyclablePosts,
  getPostsByIds,
} from "~/models/post.queries.server";

import {
  toPostDTOArray,
  type PostDTO,
} from "../dtos";
import { getPostStats } from "../stats.server";
import type { PostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";
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
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 50;
  const queueType = params.queueType ?? "all";

  const [{ posts, pagination }, userResult, queueTypesResult] =
    await Promise.all([
      getRecyclablePosts({
        userId,
        page,
        limit,
        queueType,
      }),
      getUserById(userId),
      getQueueTypes(userId),
    ]);

  if (!userResult) {
    throw new Error("User not found");
  }

  const user: UserWithHashTagPresets = userResult;
  const queueTypes = Array.isArray(queueTypesResult) ? queueTypesResult : [];

  // Get event IDs from signedEvent.id
  const eventIds = posts
    .map((post) => {
      const signedEvent = post.signedEvent;
      if (
        signedEvent &&
        typeof signedEvent === "object" &&
        "id" in signedEvent &&
        typeof signedEvent.id === "string"
      ) {
        return signedEvent.id;
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

  return {
    posts: postsDTO,
    pagination,
    stats,
    user,
    queueTypes: queueTypes.filter(
      (qt: unknown) =>
        typeof qt === "object" &&
        qt !== null &&
        "isEnabled" in qt &&
        qt.isEnabled !== false,
    ),
    selectedQueueType: queueType,
  };
}

/**
 * Handle recyclable post actions (delete, repost, quote)
 */
export async function handleRecyclablePostAction(
  formData: FormData,
  userId: string,
) {
  // Validate with Zod
  const result = validateFormDataOrRespond(formData, recyclableActionSchema);
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;

  // Handle delete action
  if (validatedData._action === "delete") {
    await deletePost({ id: validatedData.postId, userId });
    return json({ success: true });
  }

  // Handle bulk delete
  if (validatedData._action === "bulkDelete") {
    await Promise.all(
      validatedData.postIds.map((id: string) => deletePost({ id, userId })),
    );
    return json({ success: true });
  }

  // Handle bulk repost
  if (validatedData._action === "bulkRepost") {
    const postsData = await getPostsByIds({ ids: validatedData.postIds, userId });
    return json({ repostData: postsData });
  }

  // Handle bulk scheduled repost
  if (validatedData._action === "bulkScheduledRepost") {
    const postsData = await getPostsByIds({ ids: validatedData.postIds, userId });
    return json({ scheduledRepostData: postsData });
  }

  // Handle bulk quote
  if (validatedData._action === "bulkQuote") {
    const postsData = await getPostsByIds({ ids: validatedData.postIds, userId });

    // Transform posts data into quote post format
    const quotePostsData = postsData.map((post) => {
      const signedEvent = post.signedEvent;
      let eventId = "";
      let eventPubkey = "";

      if (
        signedEvent &&
        typeof signedEvent === "object" &&
        !Array.isArray(signedEvent)
      ) {
        if ("id" in signedEvent && typeof signedEvent.id === "string") {
          eventId = signedEvent.id;
        }
        if ("pubkey" in signedEvent && typeof signedEvent.pubkey === "string") {
          eventPubkey = signedEvent.pubkey;
        }
      }

      const fileUrl = Array.isArray(post.fileUrl)
        ? post.fileUrl
        : typeof post.fileUrl === "string"
          ? [post.fileUrl]
          : [];
      const caption = typeof post.caption === "string" ? post.caption : "";
      const queueTypeName =
        post.queueType &&
        typeof post.queueType === "object" &&
        "name" in post.queueType &&
        typeof post.queueType.name === "string"
          ? post.queueType.name
          : "unassigned";

      return {
        caption: "", // Empty caption - user can add content
        fileUrl: fileUrl.length > 0 ? (fileUrl[0] ?? "") : "",
        queueType: queueTypeName,
        scheduledFor: "",
        originalPostId: post.id,
        originalEventId: eventId,
        originalEventPubkey: eventPubkey,
        isQuotePost: true,
        originalCaption: caption,
      };
    });

    return json({ quotePostData: quotePostsData });
  }

  // Handle single repost
  if (validatedData._action === "repost") {
    try {
      // Type narrowing for repost action
      const repostData = validatedData._action === "repost" ? validatedData : null;
      if (!repostData) {
        return json({ error: "Invalid action" }, { status: 400 });
      }
      // Get the original post data
      const postsData = await getPostsByIds({ ids: [repostData.postId], userId });
      if (!postsData || postsData.length === 0) {
        const { NotFoundError } = await import("~/lib/errors");
        throw new NotFoundError("Post not found", { postId: repostData.postId, userId });
      }

      const originalPost = postsData[0];
      const originalEvent = originalPost.signedEvent;

      if (
        !originalEvent ||
        typeof originalEvent !== "object" ||
        !("id" in originalEvent) ||
        !("pubkey" in originalEvent)
      ) {
        return json({ error: "Invalid event data" }, { status: 400 });
      }

      const eventId =
        typeof originalEvent.id === "string"
          ? originalEvent.id
          : String(originalEvent.id);
      const eventPubkey =
        typeof originalEvent.pubkey === "string"
          ? originalEvent.pubkey
          : String(originalEvent.pubkey);

      // Create kind 6 repost event structure according to NIP-18
      const kind6EventData = {
        kind: 6,
        content: "", // Empty content as recommended by NIP-18
        tags: [
          // e tag with the id of the note being reposted and relay URL
          ["e", eventId, "wss://relay.primal.net"],
          // p tag with the pubkey of the event being reposted
          ["p", eventPubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      // Return the unsigned event data for client-side signing
      return json({
        repostEventData: kind6EventData,
        originalPost: originalPost,
      });
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }

  // Handle single quote
  if (validatedData._action === "quote") {
    try {
      // Type narrowing for quote action
      const quoteData = validatedData._action === "quote" ? validatedData : null;
      if (!quoteData) {
        return json({ error: "Invalid action" }, { status: 400 });
      }
      // Get the original post data
      const postsData = await getPostsByIds({ ids: [quoteData.postId], userId });
      if (!postsData || postsData.length === 0) {
        const { NotFoundError } = await import("~/lib/errors");
        throw new NotFoundError("Post not found", { postId: quoteData.postId, userId });
      }

      const originalPost = postsData[0];
      const originalEvent = originalPost.signedEvent;

      if (
        !originalEvent ||
        typeof originalEvent !== "object" ||
        !("id" in originalEvent) ||
        !("pubkey" in originalEvent)
      ) {
        return json({ error: "Invalid event data" }, { status: 400 });
      }

      const eventId =
        typeof originalEvent.id === "string"
          ? originalEvent.id
          : String(originalEvent.id);
      const eventPubkey =
        typeof originalEvent.pubkey === "string"
          ? originalEvent.pubkey
          : String(originalEvent.pubkey);

      // Create quote post data for bulk posts page
      const fileUrl =
        "fileUrl" in originalPost
          ? Array.isArray(originalPost.fileUrl)
            ? originalPost.fileUrl[0]
            : typeof originalPost.fileUrl === "string"
              ? originalPost.fileUrl
              : ""
          : "";
      const queueTypeName =
        originalPost.queueType &&
        typeof originalPost.queueType === "object" &&
        "name" in originalPost.queueType &&
        typeof originalPost.queueType.name === "string"
          ? originalPost.queueType.name
          : "unassigned";
      const caption =
        "caption" in originalPost && typeof originalPost.caption === "string"
          ? originalPost.caption
          : "";
      const originalPostId =
        "id" in originalPost && typeof originalPost.id === "string"
          ? originalPost.id
          : "";

      const quotePostData = {
        caption: "", // Empty caption - user can add content
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

  return json({ error: "Invalid action" }, { status: 400 });
}
