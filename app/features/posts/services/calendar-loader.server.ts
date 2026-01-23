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

  // Filter posts by queue type if specific queue is selected
  const filteredScheduledPosts = filterPostsByQueueType(
    allScheduledPosts,
    queueType
  );
  const filteredScheduledLongFormPosts = filterPostsByQueueType(
    allScheduledLongFormPosts as Array<{
      queueType?: { name?: string | null } | null;
    }>,
    queueType
  ) as typeof allScheduledLongFormPosts;
  const filteredPastPosts = filterPostsByQueueType(allPastPosts, queueType);
  const filteredPastLongFormPosts = filterPostsByQueueType(
    allPastLongFormPosts as Array<{
      queueType?: { name?: string | null } | null;
    }>,
    queueType
  ) as typeof allPastLongFormPosts;

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
  const scheduledLongFormPostsData: LongFormPostData[] =
    filteredScheduledLongFormPosts.map((post) => {
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
      const signedEventValue: LongFormPostData["signedEvent"] =
        post.signedEvent as LongFormPostData["signedEvent"];
      const nostrEventValue: LongFormPostData["nostrEvent"] =
        post.nostrEvent as LongFormPostData["nostrEvent"];
      const result: LongFormPostData = {
        ...rest,
        queueType: convertedQueueType,
        signedEvent: signedEventValue,
        nostrEvent: nostrEventValue,
      };
      return result;
    });
  const pastLongFormPostsData: LongFormPostData[] =
    filteredPastLongFormPosts.map((post) => {
      const convertedQueueType: QueueType | undefined =
        "queueType" in post &&
        post.queueType &&
        typeof post.queueType === "object" &&
        "id" in post.queueType &&
        "name" in post.queueType
          ? ((): QueueType => {
              const idValue: string = post.queueType.id as string;
              const nameValue: string = post.queueType.name as string;
              const colorValue: string | null | undefined = (
                "color" in post.queueType ? post.queueType.color : undefined
              ) as string | null | undefined;
              const descriptionValue: string | null | undefined = (
                "description" in post.queueType
                  ? post.queueType.description
                  : undefined
              ) as string | null | undefined;
              const scheduleTypeValue: "INTERVAL" | "FIXED_SLOTS" | undefined =
                (
                  "scheduleType" in post.queueType
                    ? post.queueType.scheduleType
                    : undefined
                ) as "INTERVAL" | "FIXED_SLOTS" | undefined;
              const isEnabledValue: boolean | undefined = (
                "isEnabled" in post.queueType
                  ? post.queueType.isEnabled
                  : undefined
              ) as boolean | undefined;
              const userIdValue: string | undefined = (
                "userId" in post.queueType ? post.queueType.userId : undefined
              ) as string | undefined;
              return {
                id: idValue,
                name: nameValue,
                color: colorValue,
                description: descriptionValue,
                scheduleType: scheduleTypeValue,
                scheduleConfig: convertJsonValueToScheduleConfig(
                  "scheduleConfig" in post.queueType
                    ? post.queueType.scheduleConfig
                    : undefined
                ),
                isEnabled: isEnabledValue,
                userId: userIdValue,
              };
            })()
          : undefined;
      const result: LongFormPostData = {
        ...post,
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
  const [allScheduledPosts, user, queueTypes] = await Promise.all([
    getScheduledPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter posts by queue type if specific queue is selected
  const scheduledPosts = filterPostsByQueueType(allScheduledPosts, queueType);

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
