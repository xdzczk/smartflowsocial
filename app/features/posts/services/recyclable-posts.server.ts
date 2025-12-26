/**
 * Recyclable Posts Service
 * 
 * Handles recyclable posts data loading and actions (repost, quote, delete)
 */

import { json } from "@remix-run/node";
import { getPostStats } from "~/features/posts/stats.server";
import { getRecyclablePosts, getPostsByIds } from "~/models/post.queries.server";
import { deletePost } from "~/models/post.commands.server";
import { getUserById, getQueueTypes } from "~/models/user.server";

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
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;
  const queueType = params.queueType || "all";

  const [{ posts, pagination }, user, queueTypes] = await Promise.all([
    getRecyclablePosts({
      userId,
      page,
      limit,
      queueType,
    }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Get event IDs from signedEvent.id
  const eventIds = posts.map((post) => post.signedEvent.id);

  // Use the extracted stats fetching logic
  const stats = await getPostStats(eventIds);

  return {
    posts,
    pagination,
    stats,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
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
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
    return json({ success: true });
  }

  if (_action === "bulkRepost") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ repostData: postsData });
  }

  if (_action === "bulkScheduledRepost") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ scheduledRepostData: postsData });
  }

  if (_action === "bulkQuote") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });

    // Transform posts data into quote post format
    const quotePostsData = postsData.map((post) => ({
      caption: "", // Empty caption - user can add content
      fileUrl: post.fileUrl || "",
      queueType: post.queueType?.name || "unassigned",
      scheduledFor: "",
      originalPostId: post.id,
      originalEventId: post.signedEvent?.id,
      originalEventPubkey: post.signedEvent?.pubkey,
      isQuotePost: true,
      originalCaption: post.caption || "",
    }));

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

      // Create kind 6 repost event structure according to NIP-18
      const kind6EventData = {
        kind: 6,
        content: "", // Empty content as recommended by NIP-18
        tags: [
          // e tag with the id of the note being reposted and relay URL
          ["e", originalEvent.id, "wss://relay.primal.net"],
          // p tag with the pubkey of the event being reposted
          ["p", originalEvent.pubkey],
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
      // Get the original post data
      const postsData = await getPostsByIds({ ids: [postId], userId });
      if (!postsData || postsData.length === 0) {
        const { NotFoundError } = await import("~/lib/errors");
        throw new NotFoundError("Post not found", { postId, userId });
      }

      const originalPost = postsData[0];
      const originalEvent = originalPost.signedEvent;

      // Create quote post data for bulk posts page
      const quotePostData = {
        caption: "", // Empty caption - user can add content
        fileUrl: originalPost.fileUrl || "",
        queueType: originalPost.queueType?.name || "unassigned",
        scheduledFor: "",
        originalPostId: originalPost.id,
        originalEventId: originalEvent.id,
        originalEventPubkey: originalEvent.pubkey,
        isQuotePost: true,
        originalCaption: originalPost.caption || "",
      };

      return json({ quotePostData: [quotePostData] });
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

