/**
 * Scheduled posts loader data preparation
 * Centralized data fetching for scheduled posts page
 */

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  getScheduledLongFormPosts,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
} from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load scheduled dashboard data
 */
export async function loadScheduledData(
  userId: string,
  queueType: string,
) {
  const [posts, allLongformPosts, user, queueTypes, hashTagPresets] =
    await Promise.all([
      getScheduledPosts({ userId, queueType }),
      getScheduledLongFormPosts({ userId }),
      getUserById(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
    ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

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

