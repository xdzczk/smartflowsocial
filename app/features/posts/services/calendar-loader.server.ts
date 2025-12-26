/**
 * Calendar loader data preparation
 * Centralized data fetching for calendar pages
 */

import { combineContent } from "~/features/posts/combined.server";
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

import { filterPostsArraysByQueueType } from "./post-filtering.server";

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
  const {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
  } = filterPostsArraysByQueueType({
    scheduledPosts: allScheduledPosts,
    scheduledLongFormPosts: allScheduledLongFormPosts,
    pastPosts: allPastPosts,
    pastLongFormPosts: allPastLongFormPosts,
    queueType,
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    scheduledPosts,
    scheduledLongFormPosts,
    "scheduledFor",
    "asc",
  );
  const allPastContent = combineContent(
    pastPosts,
    pastLongFormPosts,
    "postedAt",
    "desc",
  );

  return {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
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
  const { scheduledPosts } = filterPostsArraysByQueueType({
    scheduledPosts: allScheduledPosts,
    scheduledLongFormPosts: [],
    pastPosts: [],
    pastLongFormPosts: [],
    queueType,
  });

  return {
    scheduledPosts,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval || [],
  };
}

