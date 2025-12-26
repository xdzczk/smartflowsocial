/**
 * Scheduled posts loader data preparation
 * Centralized data fetching for scheduled posts page
 */

import { combineContent } from "~/features/posts/combined.server";
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

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    posts,
    longformPosts,
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

