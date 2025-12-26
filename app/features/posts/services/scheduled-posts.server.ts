/**
 * Scheduled Posts Service
 * 
 * Handles scheduled posts data loading and actions
 */

import { json } from "@remix-run/node";

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  enqueuePostJob as schedulePost,
  cancelPostJob as cancelScheduledPost,
} from "~/infra/queue";
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
import {
  getScheduledPosts,
  getPostById,
} from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

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
  const [posts, allLongformPosts, user, queueTypes, hashTagPresets] =
    await Promise.all([
      getScheduledPosts({ userId, queueType }),
      getScheduledLongFormPosts({ userId }),
      getUserById(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
    ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts =
    queueType === "all"
      ? allLongformPosts
      : allLongformPosts.filter((post) => post.queueType?.name === queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as PostData["signedEvent"],
      nostrEvent: post.nostrEvent as PostData["nostrEvent"],
    } as PostData;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformPosts.map((post) => {
    return {
      ...post,
      queueType: ("queueType" in post && post.queueType) || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    postsData,
    longformPostsData,
    "scheduledFor",
    "asc",
  );

  return {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    hashTagPresets,
  };
}

/**
 * Handle scheduled post actions (delete, reschedule, edit)
 */
export async function handleScheduledPostAction(
  formData: FormData,
  userId: string,
) {
  const postId = formData.get("postId") as string;
  const _action = formData.get("_action");

  if (_action === "delete") {
    await deletePost({ id: postId, userId });
    return json({ success: true });
  }

  if (_action === "deleteLongForm") {
    await deleteLongFormPost({ id: postId, userId });
    return json({ success: true });
  }

  if (_action === "bulkDelete") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
    return json({ success: true });
  }

  if (_action === "bulkDeleteLongForm") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(
      postIds.map((id: string) => deleteLongFormPost({ id, userId })),
    );
    return json({ success: true });
  }

  if (_action === "bulkDeleteMixed") {
    const itemData = JSON.parse(formData.get("itemData") as string);
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

  // Reschedule a regular post (with optional re-signed event)
  if (_action === "reschedule") {
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
      return json({ error: "Post not found" }, { status: 404 });
    }

    await cancelScheduledPost(postId);

    let parsedSignedEvent = null;
    let parsedNostrEvent = null;
    if (signedEventStr && nostrEventStr) {
      try {
        parsedSignedEvent = JSON.parse(signedEventStr);
        parsedNostrEvent = JSON.parse(nostrEventStr);
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          userId,
          postId,
          message: "Error parsing signed events",
        });
      }
    }

    const updatedPost = await reschedulePost({
      id: postId,
      userId,
      newScheduledFor: newTime,
      overrideQueue,
      queueTypeId,
      signedEvent: parsedSignedEvent || undefined,
      nostrEvent: parsedNostrEvent || undefined,
    });

    if (parsedSignedEvent && parsedNostrEvent) {
      await schedulePost(postId, userId, parsedSignedEvent, parseInt(newTime));
      return json({ success: true, post: updatedPost, signed: true });
    }

    return json({ success: true, post: updatedPost, needsSigning: true });
  }

  // Reschedule a longform post (with optional re-signed event)
  if (_action === "rescheduleLongform") {
    const newTime = formData.get("newTime") as string;
    const signedEventStr = formData.get("signedEvent") as string;
    const nostrEventStr = formData.get("nostrEvent") as string;

    if (!postId || !newTime) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const originalPost = await getLongFormPostModel({ id: postId, userId });
    if (!originalPost) {
      return json({ error: "Longform post not found" }, { status: 404 });
    }

    let parsedSignedEvent = null;
    let parsedNostrEvent = null;
    if (signedEventStr && nostrEventStr) {
      try {
        parsedSignedEvent = JSON.parse(signedEventStr);
        parsedNostrEvent = JSON.parse(nostrEventStr);
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          userId,
          postId,
          message: "Error parsing signed events",
        });
      }
    }

    const updatedPost = await updateLongFormPost({
      id: postId,
      userId,
      publishedAt: new Date(parseInt(newTime) * 1000),
      status: "SCHEDULED",
      signedEvent: parsedSignedEvent || undefined,
      nostrEvent: parsedNostrEvent || undefined,
    });

    return json({
      success: true,
      post: updatedPost,
      signed: !!parsedSignedEvent,
    });
  }

  // Edit a regular post's content/media/hashtags and re-sign
  if (_action === "editPost") {
    const caption = (formData.get("caption") ?? "") as string;
    const fileUrl = (formData.get("fileUrl") ?? "") as string;
    const hashtags = (formData.get("hashtags") ?? "") as string;
    const signedEventStr = formData.get("signedEvent") as string;
    const nostrEventStr = formData.get("nostrEvent") as string;
    const queueTypeId = (formData.get("queueTypeId") as string) || null;
    const scheduledFor = (formData.get("scheduledFor") as string) || null;
    const hashTagPresetId =
      (formData.get("hashTagPresetId") as string) || null;

    if (!postId) {
      return json({ error: "Missing postId" }, { status: 400 });
    }

    let parsedSignedEvent = null;
    let parsedNostrEvent = null;
    if (signedEventStr && nostrEventStr) {
      try {
        parsedSignedEvent = JSON.parse(signedEventStr);
        parsedNostrEvent = JSON.parse(nostrEventStr);
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          userId,
          postId,
          message: "Error parsing signed events",
        });
      }
    }

    let parsedFileUrl = [];
    if (fileUrl) {
      try {
        parsedFileUrl = JSON.parse(fileUrl);
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          userId,
          postId,
          fileUrl,
          message: "Error parsing fileUrl",
        });
        parsedFileUrl = [];
      }
    }

    const updated = await updatePost({
      id: postId,
      userId,
      data: {
        caption,
        fileUrl: parsedFileUrl,
        tags: hashtags
          ? hashtags.toString().split(" ").filter((tag) => tag.trim())
          : [],
        queueTypeId,
        scheduledFor: scheduledFor ? String(Number(scheduledFor)) : undefined,
        signedEvent: parsedSignedEvent || undefined,
        nostrEvent: parsedNostrEvent || undefined,
        hashTagPresetId,
      },
    });

    if (scheduledFor && parsedSignedEvent) {
      await cancelScheduledPost(postId);
      await schedulePost(
        postId,
        userId,
        parsedSignedEvent,
        Number(scheduledFor),
      );
    }

    return json({
      success: true,
      post: updated,
      signed: !!parsedSignedEvent,
    });
  }

  // Edit a longform post's content and re-sign
  if (_action === "editLongform") {
    const title = (formData.get("title") ?? "") as string;
    const summary = (formData.get("summary") ?? "") as string;
    const content = (formData.get("content") ?? "") as string;
    const image = (formData.get("image") ?? "") as string;
    const signedEventStr = formData.get("signedEvent") as string;
    const nostrEventStr = formData.get("nostrEvent") as string;
    const scheduledFor = (formData.get("scheduledFor") as string) || null;

    if (!postId) {
      return json({ error: "Missing postId" }, { status: 400 });
    }

    let parsedSignedEvent = null;
    let parsedNostrEvent = null;
    if (signedEventStr && nostrEventStr) {
      try {
        parsedSignedEvent = JSON.parse(signedEventStr);
        parsedNostrEvent = JSON.parse(nostrEventStr);
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          userId,
          postId,
          message: "Error parsing signed events",
        });
      }
    }

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
      signedEvent: parsedSignedEvent || undefined,
      nostrEvent: parsedNostrEvent || undefined,
    });

    return json({
      success: true,
      post: updated,
      signed: !!parsedSignedEvent,
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

