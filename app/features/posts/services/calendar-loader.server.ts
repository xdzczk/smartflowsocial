/**
 * Calendar loader data preparation
 * Centralized data fetching for calendar pages
 */

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPastPosts,
} from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
} from "~/models/user.server";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load calendar data for main calendar route
 * Includes scheduled and past posts (90 days back)
 */
export async function loadCalendarData(
  userId: string,
  queueType: string,
) {
  // Calculate date range for past posts (90 days back for better history)
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    allScheduledPosts,
    allScheduledLongFormPosts,
    allPastPosts,
    allPastLongFormPosts,
    user,
    queueTypes,
  ] = await Promise.all([
    getScheduledPosts({ userId }),
    getScheduledLongFormPosts({ userId }),
    getPastPosts({ userId, startDate: ninetyDaysAgo, endDate: now }),
    getPastLongFormPosts({ userId, startDate: ninetyDaysAgo, endDate: now }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter posts by queue type if specific queue is selected
  const filteredScheduledPosts = filterPostsByQueueType(allScheduledPosts, queueType);
  const filteredScheduledLongFormPosts = filterPostsByQueueType(allScheduledLongFormPosts as Array<{ queueType?: { name?: string | null } | null }>, queueType) as typeof allScheduledLongFormPosts;
  const filteredPastPosts = filterPostsByQueueType(allPastPosts, queueType);
  const filteredPastLongFormPosts = filterPostsByQueueType(allPastLongFormPosts as Array<{ queueType?: { name?: string | null } | null }>, queueType) as typeof allPastLongFormPosts;

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const scheduledPostsData: PostData[] = filteredScheduledPosts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as PostData["signedEvent"],
      nostrEvent: post.nostrEvent as PostData["nostrEvent"],
    } as PostData;
  });
  const pastPostsData: PostData[] = filteredPastPosts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as PostData["signedEvent"],
      nostrEvent: post.nostrEvent as PostData["nostrEvent"],
    } as PostData;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const scheduledLongFormPostsData: LongFormPostData[] = filteredScheduledLongFormPosts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
  });
  const pastLongFormPostsData: LongFormPostData[] = filteredPastLongFormPosts.map((post) => {
    return {
      ...post,
      queueType: ("queueType" in post && post.queueType) || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    scheduledPostsData,
    scheduledLongFormPostsData,
    "scheduledFor",
    "asc",
  );
  const allPastContent = combineContent(
    pastPostsData,
    pastLongFormPostsData,
    "postedAt",
    "desc",
  );

  return {
    scheduledPosts: filteredScheduledPosts,
    scheduledLongFormPosts: filteredScheduledLongFormPosts,
    pastPosts: filteredPastPosts,
    pastLongFormPosts: filteredPastLongFormPosts,
    allContent,
    allPastContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval || [],
  };
}

/**
 * Load calendar data for queue-specific calendar route
 * Simplified version for queue-specific views
 */
export async function loadCalendarQueueData(
  userId: string,
  queueType: string,
) {
  const [allScheduledPosts, user, queueTypes] = await Promise.all([
    getScheduledPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter posts by queue type if specific queue is selected
  const scheduledPosts = filterPostsByQueueType(allScheduledPosts, queueType);

  return {
    scheduledPosts,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval || [],
  };
}

