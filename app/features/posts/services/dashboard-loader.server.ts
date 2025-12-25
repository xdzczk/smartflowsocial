/**
 * Dashboard loader data preparation
 * Centralized data fetching for dashboard index page
 */

import { combineContent } from "~/features/posts/combined.server";
import {
  getScheduledLongFormPosts,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPostStatistics,
} from "~/models/post.server";
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

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    scheduledPosts,
    longformPosts,
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

