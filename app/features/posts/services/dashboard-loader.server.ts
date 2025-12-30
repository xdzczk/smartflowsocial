/**
 * Dashboard loader data preparation
 * Centralized data fetching for dashboard index page
 */

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

import { combineContent } from "../combined.server";
import type { PostData, LongFormPostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

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
    const signedEventValue: PostData["signedEvent"] = post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] = post.nostrEvent as PostData["nostrEvent"];
    const convertedQueueType = convertPrismaQueueTypeToQueueType(queueType);
    const result: PostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformPosts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: LongFormPostData["signedEvent"] = post.signedEvent as LongFormPostData["signedEvent"];
    const nostrEventValue: LongFormPostData["nostrEvent"] = post.nostrEvent as LongFormPostData["nostrEvent"];
    const convertedQueueType = convertPrismaQueueTypeToQueueType(queueType);
    const result: LongFormPostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
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

