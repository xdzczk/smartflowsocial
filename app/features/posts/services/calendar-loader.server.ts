/**
 * Calendar loader data preparation
 * Centralized data fetching for calendar pages
 */

import { getUserById, getQueueTypes } from "~/features/user";
import { addDays, nowUTC, toPrismaDate } from "~/lib/temporal";
import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
} from "~/models/longformpost.server";
import { getScheduledPosts, getPastPosts } from "~/models/post.queries.server";

import { combineContent as _combineContent } from "../combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import type { PostData, LongFormPostData, QueueType } from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

import { filterPostsByQueueType } from "./post-filtering.server";

/**
 * Load calendar data for main calendar route
 * Includes scheduled and past posts (30 days back)
 */
export async function loadCalendarData(userId: string, queueType: string) {
  // Calculate date range for past posts (30 days back for better performance)
  // Use Temporal for date arithmetic
  const nowZoned = nowUTC();
  const thirtyDaysAgoZoned = addDays(nowZoned, -30);
  const now = toPrismaDate(nowZoned);
  const thirtyDaysAgo = toPrismaDate(thirtyDaysAgoZoned);

  if (!now || !thirtyDaysAgo) {
    throw new Error("Failed to convert Temporal dates to Date");
  }

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
    getPastPosts({ userId, startDate: thirtyDaysAgo, endDate: now }),
    getPastLongFormPosts({ userId, startDate: thirtyDaysAgo, endDate: now }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Extract posts arrays from pagination results
  const scheduledPostsArray =
    "posts" in allScheduledPosts && Array.isArray(allScheduledPosts.posts)
      ? allScheduledPosts.posts
      : [];
  const scheduledLongFormPostsArray =
    "posts" in allScheduledLongFormPosts &&
    Array.isArray(allScheduledLongFormPosts.posts)
      ? allScheduledLongFormPosts.posts
      : [];
  // getPastPosts and getPastLongFormPosts return arrays directly, not paginated objects
  const pastPostsArray = Array.isArray(allPastPosts) ? allPastPosts : [];
  const pastLongFormPostsArray = Array.isArray(allPastLongFormPosts)
    ? allPastLongFormPosts
    : [];

  // Filter posts by queue type if specific queue is selected
  const filteredScheduledPosts = filterPostsByQueueType(
    scheduledPostsArray,
    queueType
  );
  const filteredScheduledLongFormPosts = filterPostsByQueueType(
    scheduledLongFormPostsArray as Array<{
      queueType?: { name?: string | null } | null;
    }>,
    queueType
  ) as typeof scheduledLongFormPostsArray;
  const filteredPastPosts = filterPostsByQueueType(pastPostsArray, queueType);
  const filteredPastLongFormPosts = filterPostsByQueueType(
    pastLongFormPostsArray as Array<{
      queueType?: { name?: string | null } | null;
    }>,
    queueType
  ) as typeof pastLongFormPostsArray;

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const scheduledPostsData: PostData[] = filteredScheduledPosts.map((post) => {
    const { queueType, ...rest } = post;
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined =
            queueType.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: queueType.color,
            description: queueType.description,
            scheduleType: scheduleTypeValue,
            scheduleConfig: convertJsonValueToScheduleConfig(
              queueType.scheduleConfig
            ),
            isEnabled: queueType.isEnabled,
            userId: queueType.userId,
          };
        })()
      : undefined;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const result: PostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });
  const pastPostsData: PostData[] = filteredPastPosts.map((post) => {
    const { queueType, ...rest } = post;
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined =
            queueType.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: queueType.color,
            description: queueType.description,
            scheduleType: scheduleTypeValue,
            scheduleConfig: convertJsonValueToScheduleConfig(
              queueType.scheduleConfig
            ),
            isEnabled: queueType.isEnabled,
            userId: queueType.userId,
          };
        })()
      : undefined;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const result: PostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const scheduledLongFormPostsData: LongFormPostData[] = (
    filteredScheduledLongFormPosts as Array<{
      queueType?: {
        id: string;
        name: string;
        scheduleType?: "INTERVAL" | "FIXED_SLOTS" | null;
        scheduleConfig?: unknown;
        isEnabled?: boolean | null;
        color?: string | null;
        description?: string | null;
        userId?: string | null;
      } | null;
      signedEvent?: unknown;
      nostrEvent?: unknown;
      [key: string]: unknown;
    }>
  ).map((post) => {
    const queueType = post.queueType;
    const { queueType: _queueType, ...rest } = post;
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined =
            queueType.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: queueType.color ?? null,
            description: queueType.description ?? null,
            scheduleType: scheduleTypeValue,
            scheduleConfig: convertJsonValueToScheduleConfig(
              queueType.scheduleConfig
            ),
            isEnabled: queueType.isEnabled ?? false,
            userId: queueType.userId ?? "",
          };
        })()
      : undefined;
    const signedEventValue: LongFormPostData["signedEvent"] =
      post.signedEvent as LongFormPostData["signedEvent"];
    const nostrEventValue: LongFormPostData["nostrEvent"] =
      post.nostrEvent as LongFormPostData["nostrEvent"];
    const result: LongFormPostData = {
      ...(rest as unknown as LongFormPostData),
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });
  const pastLongFormPostsData: LongFormPostData[] = (
    filteredPastLongFormPosts as Array<{
      queueType?: {
        id: string;
        name: string;
        scheduleType?: "INTERVAL" | "FIXED_SLOTS" | null;
        scheduleConfig?: unknown;
        isEnabled?: boolean | null;
        color?: string | null;
        description?: string | null;
        userId?: string | null;
      } | null;
      signedEvent?: unknown;
      nostrEvent?: unknown;
      [key: string]: unknown;
    }>
  ).map((post) => {
    const queueType = post.queueType;
    const convertedQueueType: QueueType | undefined =
      queueType &&
      typeof queueType === "object" &&
      "id" in queueType &&
      "name" in queueType
        ? ((): QueueType => {
            const idValue: string = queueType.id;
            const nameValue: string = queueType.name;
            const colorValue: string | null | undefined =
              "color" in queueType ? queueType.color : undefined;
            const descriptionValue: string | null | undefined =
              "description" in queueType ? queueType.description : undefined;
            const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined = (
              "scheduleType" in queueType ? queueType.scheduleType : undefined
            ) as "INTERVAL" | "FIXED_SLOTS" | undefined;
            const isEnabledValue: boolean | undefined = (
              "isEnabled" in queueType ? queueType.isEnabled : undefined
            ) as boolean | undefined;
            const userIdValue: string | undefined = (
              "userId" in queueType ? queueType.userId : undefined
            ) as string | undefined;
            return {
              id: idValue,
              name: nameValue,
              color: colorValue ?? null,
              description: descriptionValue ?? null,
              scheduleType: scheduleTypeValue,
              scheduleConfig: convertJsonValueToScheduleConfig(
                "scheduleConfig" in queueType
                  ? queueType.scheduleConfig
                  : undefined
              ),
              isEnabled: isEnabledValue ?? false,
              userId: userIdValue ?? "",
            };
          })()
        : undefined;
    const result: LongFormPostData = {
      ...(post as unknown as LongFormPostData),
      queueType: convertedQueueType,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    };
    return result;
  });

  // Serialize Date objects to strings for Remix loader response
  // Note: allContent/allPastContent are removed - reconstruct on client from posts
  const scheduledPostsDTO: PostDTO[] = toPostDTOArray(scheduledPostsData);
  const scheduledLongFormPostsDTO: LongFormPostDTO[] = toLongFormPostDTOArray(
    scheduledLongFormPostsData
  );
  const pastPostsDTO: PostDTO[] = toPostDTOArray(pastPostsData);
  const pastLongFormPostsDTO: LongFormPostDTO[] = toLongFormPostDTOArray(
    pastLongFormPostsData
  );

  return {
    scheduledPosts: scheduledPostsDTO,
    scheduledLongFormPosts: scheduledLongFormPostsDTO,
    pastPosts: pastPostsDTO,
    pastLongFormPosts: pastLongFormPostsDTO,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval ?? [],
  };
}

/**
 * Load calendar data for queue-specific calendar route
 * Simplified version for queue-specific views
 */
export async function loadCalendarQueueData(userId: string, queueType: string) {
  const [allScheduledPostsResult, user, queueTypes] = await Promise.all([
    getScheduledPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Extract posts array from pagination result
  const allScheduledPostsArray =
    "posts" in allScheduledPostsResult &&
    Array.isArray(allScheduledPostsResult.posts)
      ? allScheduledPostsResult.posts
      : [];

  // Filter posts by queue type if specific queue is selected
  const scheduledPosts = filterPostsByQueueType(
    allScheduledPostsArray,
    queueType
  );

  // Convert PostWithQueueType[] to PostData[] and serialize
  const scheduledPostsData: PostData[] = scheduledPosts.map((post) => {
    const { queueType, ...rest } = post;
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined =
            queueType.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: queueType.color,
            description: queueType.description,
            scheduleType: scheduleTypeValue,
            scheduleConfig: convertJsonValueToScheduleConfig(
              queueType.scheduleConfig
            ),
            isEnabled: queueType.isEnabled,
            userId: queueType.userId,
          };
        })()
      : undefined;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const result: PostData = {
      ...rest,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  const scheduledPostsDTO: PostDTO[] = toPostDTOArray(scheduledPostsData);

  // Convert scheduleInterval strings to numbers for schema compliance
  const scheduleIntervals = user?.scheduleInterval
    ? user.scheduleInterval.map((interval) => {
        const num =
          typeof interval === "string" ? parseInt(interval, 10) : interval;
        return isNaN(num) ? 0 : num;
      })
    : [];

  return {
    scheduledPosts: scheduledPostsDTO,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals,
  };
}
