/**
 * Dashboard loader data preparation
 * Centralized data fetching for dashboard index page
 */

import {
  getScheduledLongFormPosts,
  getScheduledPosts,
  getPostStatistics,
} from "~/features/posts/server";
import { getUserById } from "~/features/user";
import {
  getQueueTypesCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";

import { combineContent as _combineContent } from "../combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import { shouldShowQueueInUi } from "../queue-status";
import type { PostData, LongFormPostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load dashboard data
 */
export async function loadDashboardData(
  userId: string,
  queueType: string,
  page = 1,
  limit = 20,
  since?: number // Unix timestamp in milliseconds for delta sync
) {
  const results = await Promise.allSettled([
    getScheduledPosts({ userId, queueType, page, limit, since }),
    getScheduledLongFormPosts({ userId, page, limit, since }),
    getPostStatistics({ userId }),
    getUserById(userId),
    getQueueTypesCached(userId),
    getHashTagPresetsCached(userId),
  ]);

  const [
    scheduledPostsResult,
    allLongformPostsResult,
    postStatisticsResult,
    userResult,
    queueTypesResult,
    hashTagPresetsResult,
  ] = results;

  // Extract posts and pagination from paginated result
  const scheduledPosts =
    scheduledPostsResult.status === "fulfilled"
      ? scheduledPostsResult.value.posts
      : [];
  const scheduledPostsPagination =
    scheduledPostsResult.status === "fulfilled"
      ? scheduledPostsResult.value.pagination
      : { total: 0, pages: 0, currentPage: 1, limit: 20 };
  // Extract posts and pagination from paginated result
  const allLongformPosts =
    allLongformPostsResult.status === "fulfilled"
      ? allLongformPostsResult.value.posts
      : [];
  const longformPostsPagination =
    allLongformPostsResult.status === "fulfilled"
      ? allLongformPostsResult.value.pagination
      : { total: 0, pages: 0, currentPage: 1, limit: 20 };
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
    queueTypes: queueTypes.filter((qt) => shouldShowQueueInUi(qt)),
    selectedQueueType: queueType,
    hashTagPresets,
    pagination: scheduledPostsPagination, // Use posts pagination as primary
    longformPagination: longformPostsPagination,
  };
}
