/**
 * Dashboard loader data preparation
 * Centralized data fetching for dashboard index page
 */

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  getScheduledLongFormPosts,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPostStatistics,
} from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load dashboard data
 */
export async function loadDashboardData(
  userId: string,
  queueType: string,
) {
  const [
    scheduledPosts,
    allLongformPosts,
    postStatistics,
    user,
    queueTypes,
    hashTagPresets,
  ] = await Promise.all([
    getScheduledPosts({ userId, queueType }),
    getScheduledLongFormPosts({ userId }),
    getPostStatistics({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const scheduledPostsData: PostData[] = scheduledPosts.map((post) => {
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
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    scheduledPostsData,
    longformPostsData,
    "scheduledFor",
    "asc",
  );

  return {
    scheduledPosts,
    longformPosts,
    allContent,
    postStatistics,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    hashTagPresets,
  };
}

