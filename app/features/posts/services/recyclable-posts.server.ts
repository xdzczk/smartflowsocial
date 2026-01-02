/**
 * Recyclable Posts Service
 *
 * Handles recyclable posts data loading and actions (repost, quote, delete)
 */

import { json } from "@remix-run/node";

import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById, getQueueTypes } from "~/features/user";
import { deletePost } from "~/models/post.commands.server";
import {
  getRecyclablePosts,
  getPostsByIds,
} from "~/models/post.queries.server";

import { getPostStats } from "../stats.server";
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

  return {
    posts,
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
  const postId = formData.get("postId") as string;
  const _action = formData.get("_action");

  if (_action === "delete") {
    await deletePost({ id: postId, userId });
    return json({ success: true });
  }

  if (_action === "bulkDelete") {
    const postIdsValue = formData.get("postIds");
    const postIdsStr = postIdsValue ? String(postIdsValue) : "[]";
    let postIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(postIdsStr);
      postIds = Array.isArray(parsed)
        ? parsed.filter((id: unknown): id is string => typeof id === "string")
        : [];
    } catch {
      postIds = [];
    }
    await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
    return json({ success: true });
  }

  if (_action === "bulkRepost") {
    const postIdsValue = formData.get("postIds");
    const postIdsStr = postIdsValue ? String(postIdsValue) : "[]";
    let postIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(postIdsStr);
      postIds = Array.isArray(parsed)
        ? parsed.filter((id: unknown): id is string => typeof id === "string")
        : [];
    } catch {
      postIds = [];
    }
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ repostData: postsData });
  }

  if (_action === "bulkScheduledRepost") {
    const postIdsValue = formData.get("postIds");
    const postIdsStr = postIdsValue ? String(postIdsValue) : "[]";
    let postIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(postIdsStr);
      postIds = Array.isArray(parsed)
        ? parsed.filter((id: unknown): id is string => typeof id === "string")
        : [];
    } catch {
      postIds = [];
    }
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ scheduledRepostData: postsData });
  }

  if (_action === "bulkQuote") {
    const postIdsValue = formData.get("postIds");
    const postIdsStr = postIdsValue ? String(postIdsValue) : "[]";
    let postIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(postIdsStr);
      postIds = Array.isArray(parsed)
        ? parsed.filter((id: unknown): id is string => typeof id === "string")
        : [];
    } catch {
      postIds = [];
    }
    const postsData = await getPostsByIds({ ids: postIds, userId });

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

  if (_action === "repost") {
    try {
      // Get the original post data
      const postsData = await getPostsByIds({ ids: [postId], userId });
      if (!postsData || postsData.length === 0) {
        const { NotFoundError } = await import("~/lib/errors");
        throw new NotFoundError("Post not found", { postId, userId });
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

  if (_action === "quote") {
    try {
      // Get the origin?? post data
      const postsData = await getPostsByIds({ ids: [postId], userId });
      if (!postsData || postsData.length === 0) {
        const { NotFoundError } = await import("~/lib/errors");
        throw new NotFoundError("Post not found", { postId, userId });
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
