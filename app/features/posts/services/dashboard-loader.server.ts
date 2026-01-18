/**
 * Dashboard loader data preparation
 * Centralized data fetching for dashboard index page
 */

import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";
import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPostStatistics,
} from "~/models/post.queries.server";

import { combineContent as _combineContent } from "../combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import type { PostData, LongFormPostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load dashboard data
 */
export async function loadDashboardData(userId: string, queueType: string) {
  const results = await Promise.allSettled([
    getScheduledPosts({ userId, queueType }),
    getScheduledLongFormPosts({ userId }),
    getPostStatistics({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  const [
    scheduledPostsResult,
    allLongformPostsResult,
    postStatisticsResult,
    userResult,
    queueTypesResult,
    hashTagPresetsResult,
  ] = results;

  const scheduledPosts =
    scheduledPostsResult.status === "fulfilled"
      ? scheduledPostsResult.value
      : [];
  const allLongformPosts =
    allLongformPostsResult.status === "fulfilled"
      ? allLongformPostsResult.value
      : [];
  const postStatistics =
    postStatisticsResult.status === "fulfilled"
      ? postStatisticsResult.value
      : { scheduledCount: 0, successCount: 0 };
  const user = userResult.status === "fulfilled" ? userResult.value : null;
  const queueTypes =
    queueTypesResult.status === "fulfilled" ? queueTypesResult.value : [];
  const hashTagPresets =
    hashTagPresetsResult.status === "fulfilled"
      ? hashTagPresetsResult.value
      : [];

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const scheduledPostsData: PostData[] = scheduledPosts.map((post) => {
    const { queueType, ...rest } = post;
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const convertedQueueType = convertPrismaQueueTypeToQueueType(queueType);
    const result: LongFormPostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Serialize Date objects to strings for Remix loader response
  // Note: allContent is removed - reconstruct on client from scheduledPosts/longformPosts
  const scheduledPostsDTO: PostDTO[] = toPostDTOArray(scheduledPostsData);
  const longformPostsDTO: LongFormPostDTO[] =
    toLongFormPostDTOArray(longformPostsData);

  return {
    scheduledPosts: scheduledPostsDTO,
    longformPosts: longformPostsDTO,
    postStatistics,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    hashTagPresets,
  };
}
