/**
 * Calendar loader data preparation
 * Centralized data fetching for calendar pages
 */

import { combineContent as _combineContent } from "~/features/posts/combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "~/features/posts/dtos";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import { filterPostsByQueueType } from "~/features/posts/services/post-filtering.server";
import type {
  PostData,
  LongFormPostData,
  QueueType,
} from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import { getUserById, getQueueTypes } from "~/features/user";
import { addDays, nowUTC, toPrismaDate } from "~/lib/temporal";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";
import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
} from "~/models/longformpost.server";
import { getScheduledPosts, getPastPosts } from "~/models/post.queries.server";

import type { PostType, Prisma } from "../../data/posts-prisma-types.server";

/** Max scheduled items to load for calendar (needs all, not just first page). */
const CALENDAR_SCHEDULED_LIMIT = 5000;

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
    getScheduledPosts({ userId, limit: CALENDAR_SCHEDULED_LIMIT }),
    getScheduledLongFormPosts({ userId, limit: CALENDAR_SCHEDULED_LIMIT }),
    getPastPosts({ userId, startDate: thirtyDaysAgo, endDate: now }),
    getPastLongFormPosts({ userId, startDate: thirtyDaysAgo, endDate: now }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Extract posts arrays and pagination from pagination results
  const scheduledPostsArray =
    "posts" in allScheduledPosts && Array.isArray(allScheduledPosts.posts)
      ? allScheduledPosts.posts
      : [];
  const scheduledPostsPagination =
    "pagination" in allScheduledPosts &&
    typeof allScheduledPosts.pagination === "object" &&
    "total" in allScheduledPosts.pagination
      ? allScheduledPosts.pagination
      : {
          total: scheduledPostsArray.length,
          pages: 1,
          currentPage: 1,
          limit: 20,
        };
  const scheduledLongFormPostsArray =
    "posts" in allScheduledLongFormPosts &&
    Array.isArray(allScheduledLongFormPosts.posts)
      ? allScheduledLongFormPosts.posts
      : [];
  const scheduledLongFormPostsPagination =
    "pagination" in allScheduledLongFormPosts &&
    typeof allScheduledLongFormPosts.pagination === "object" &&
    "total" in allScheduledLongFormPosts.pagination
      ? allScheduledLongFormPosts.pagination
      : {
          total: scheduledLongFormPostsArray.length,
          pages: 1,
          currentPage: 1,
          limit: 20,
        };
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

  // Helper: merge repost original media for display
  const mergeRepostMedia = (
    post: (typeof filteredScheduledPosts)[0]
  ): { fileUrl: string[]; postType: string | null | undefined } => {
    const raw = post as typeof post & {
      repostOf?: { fileUrl: string[]; postType: string | null } | null;
    };
    const isRepostWithNoMedia =
      (raw.repost || raw.postKind === "REPOST") &&
      raw.repostOf &&
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fileUrl can be empty at runtime for reposts */
      (!raw.fileUrl || raw.fileUrl.length === 0);
    return {
      fileUrl: isRepostWithNoMedia ? raw.repostOf!.fileUrl : raw.fileUrl,
      postType: isRepostWithNoMedia
        ? raw.repostOf!.postType
        : /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- postType from repost can be null at runtime */
          (raw.postType ?? undefined),
    };
  };

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const scheduledPostsData: PostData[] = filteredScheduledPosts.map((post) => {
    const {
      queueType,
      repostOf: _ro,
      ...rest
    } = post as typeof post & {
      repostOf?: { fileUrl: string[]; postType: string | null } | null;
    };
    const { fileUrl, postType } = mergeRepostMedia(post);
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue:
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined = queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: getQueueAccentHex(queueType.colorToken ?? null),
            colorToken: queueType.colorToken ?? undefined,
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: PostData = {
      ...rest,
      fileUrl,
      postType: (postType ?? rest.postType) as PostType,
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });
  const pastPostsData: PostData[] = filteredPastPosts.map((post) => {
    const {
      queueType,
      repostOf: _ro2,
      ...rest
    } = post as typeof post & {
      repostOf?: { fileUrl: string[]; postType: string | null } | null;
    };
    const { fileUrl, postType } = mergeRepostMedia(post);
    const convertedQueueType: QueueType | undefined = queueType
      ? ((): QueueType => {
          const scheduleTypeValue:
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined = queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: getQueueAccentHex(queueType.colorToken ?? null),
            colorToken: queueType.colorToken ?? undefined,
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: PostData = {
      ...rest,
      fileUrl,
      postType: (postType ?? rest.postType) as PostType,
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
        scheduleType?: "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS" | null;
        scheduleConfig?: unknown;
        isEnabled?: boolean | null;
        color?: string | null;
        colorToken?: string | null;
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
          const scheduleTypeValue:
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined = queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: getQueueAccentHex(queueType.colorToken ?? null),
            colorToken: queueType.colorToken ?? undefined,
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(
      post.signedEvent as Prisma.JsonValue
    );
    const nostrEventValue = validateNostrEvent(
      post.nostrEvent as Prisma.JsonValue
    );
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
        scheduleType?: "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS" | null;
        scheduleConfig?: unknown;
        isEnabled?: boolean | null;
        color?: string | null;
        colorToken?: string | null;
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
            const colorTokenValue: string | null | undefined =
              "colorToken" in queueType ? queueType.colorToken : undefined;
            const descriptionValue: string | null | undefined =
              "description" in queueType ? queueType.description : undefined;
            const scheduleTypeValue:
              | "INTERVAL"
              | "FIXED_SLOTS"
              | "WEEKLY_SLOTS"
              | undefined = (
              "scheduleType" in queueType ? queueType.scheduleType : undefined
            ) as "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS" | undefined;
            const isEnabledValue: boolean | undefined = (
              "isEnabled" in queueType ? queueType.isEnabled : undefined
            ) as boolean | undefined;
            const userIdValue: string | undefined = (
              "userId" in queueType ? queueType.userId : undefined
            ) as string | undefined;
            return {
              id: idValue,
              name: nameValue,
              color: getQueueAccentHex(colorTokenValue ?? null),
              colorToken: colorTokenValue ?? undefined,
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(
      post.signedEvent as Prisma.JsonValue
    );
    const nostrEventValue = validateNostrEvent(
      post.nostrEvent as Prisma.JsonValue
    );
    const result: LongFormPostData = {
      ...(post as unknown as LongFormPostData),
      queueType: convertedQueueType,
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
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
    // Pagination totals for display
    scheduledPostsPagination: {
      total:
        typeof scheduledPostsPagination.total === "number"
          ? scheduledPostsPagination.total
          : scheduledPostsArray.length,
      pages:
        typeof scheduledPostsPagination.pages === "number"
          ? scheduledPostsPagination.pages
          : 1,
      currentPage:
        typeof scheduledPostsPagination.currentPage === "number"
          ? scheduledPostsPagination.currentPage
          : 1,
      limit:
        typeof scheduledPostsPagination.limit === "number"
          ? scheduledPostsPagination.limit
          : 20,
    },
    scheduledLongFormPostsPagination: {
      total:
        typeof scheduledLongFormPostsPagination.total === "number"
          ? scheduledLongFormPostsPagination.total
          : scheduledLongFormPostsArray.length,
      pages:
        typeof scheduledLongFormPostsPagination.pages === "number"
          ? scheduledLongFormPostsPagination.pages
          : 1,
      currentPage:
        typeof scheduledLongFormPostsPagination.currentPage === "number"
          ? scheduledLongFormPostsPagination.currentPage
          : 1,
      limit:
        typeof scheduledLongFormPostsPagination.limit === "number"
          ? scheduledLongFormPostsPagination.limit
          : 20,
    },
  };
}

/**
 * Load calendar data for queue-specific calendar route
 * Simplified version for queue-specific views
 */
export async function loadCalendarQueueData(userId: string, queueType: string) {
  const [allScheduledPostsResult, user, queueTypes] = await Promise.all([
    getScheduledPosts({ userId, limit: CALENDAR_SCHEDULED_LIMIT }),
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
          const scheduleTypeValue:
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined = queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined;
          return {
            id: queueType.id,
            name: queueType.name,
            color: getQueueAccentHex(queueType.colorToken ?? null),
            colorToken: queueType.colorToken ?? undefined,
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
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
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
        const num = typeof interval === "string" ? Number(interval) : interval;
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
