/**
 * Published Posts Service
 *
 * Handles published posts data loading
 */

import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "~/features/posts/dtos";
import {
  getPublishedLongFormPosts,
  getPublishedPosts,
  getPublishedRepostsCount,
} from "~/features/posts/server";
import type { PostStats } from "~/features/posts/stats.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import { getUserById } from "~/features/user";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import { parseDateRangeInTimezone } from "~/lib/date-range.server";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";

import type { PostType, Prisma } from "../../data/posts-prisma-types.server";

/**
 * Get published posts dashboard data
 */
export async function getPublishedDashboardData({
  userId,
  params,
  url,
}: {
  userId: string;
  params: { queueType?: string };
  url: URL;
}) {
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const hasDateRange = Boolean(dateFrom ?? dateTo);
  const page = hasDateRange ? 1 : parseInt(url.searchParams.get("page") ?? "1");
  const limit = hasDateRange ? 5000 : 50;
  const queueType =
    params.queueType ?? url.searchParams.get("queueType") ?? "all";

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const timezone = user.timezone?.trim() ?? "UTC";
  const dateRange = parseDateRangeInTimezone(dateFrom, dateTo, timezone);
  const publishedFromUtc = dateRange?.fromUtc;
  const publishedToUtc = dateRange?.toUtc;

  const [
    { posts, pagination },
    allLongformResultRaw,
    queueTypesRaw,
    repostsCount,
  ] = await Promise.all([
    getPublishedPosts({
      userId,
      page,
      limit,
      queueType,
      publishedFromUtc,
      publishedToUtc,
    }),
    getPublishedLongFormPosts({
      userId,
      page,
      limit,
      publishedFromUtc,
      publishedToUtc,
    }),
    getQueueTypesCached(userId),
    getPublishedRepostsCount({
      userId,
      queueType,
      publishedFromUtc,
      publishedToUtc,
    }),
  ]);

  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
  const allLongformResult =
    typeof allLongformResultRaw === "object" &&
    allLongformResultRaw !== null &&
    !Array.isArray(allLongformResultRaw) &&
    "posts" in allLongformResultRaw &&
    "pagination" in allLongformResultRaw
      ? (allLongformResultRaw as { posts: unknown[]; pagination: unknown })
      : { posts: [], pagination: { total: 0, pages: 0, currentPage: 1 } };
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];

  const allLongformPosts = Array.isArray(allLongformResult.posts)
    ? allLongformResult.posts
    : [];
  const longformResult = {
    ...allLongformResult,
    posts:
      queueType === "all"
        ? allLongformPosts
        : allLongformPosts.filter((post: unknown) => {
            if (
              typeof post === "object" &&
              post !== null &&
              "queueType" in post &&
              post.queueType &&
              typeof post.queueType === "object" &&
              "name" in post.queueType &&
              typeof post.queueType.name === "string"
            ) {
              return post.queueType.name === queueType;
            }
            return false;
          }),
  };

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const rawPost = post as typeof post & {
      repostOf?: { fileUrl: string[]; postType: string | null } | null;
    };
    const { queueType, repostOf, ...rest } = rawPost;
    // For reposts with no media, use original post's fileUrl/postType for display
    const isRepostWithNoMedia =
      (rawPost.repost || rawPost.postKind === "REPOST") &&
      repostOf &&
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fileUrl can be empty at runtime for reposts */
      (!rawPost.fileUrl || rawPost.fileUrl.length === 0);
    const fileUrl = isRepostWithNoMedia ? repostOf.fileUrl : rawPost.fileUrl;
    const postType = isRepostWithNoMedia ? repostOf.postType : rawPost.postType;
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: PostData = {
      ...rest,
      fileUrl,
      postType: (postType ?? rest.postType) as PostType,
      queueType: convertPrismaQueueTypeToQueueType(
        "queueType" in post ? post.queueType : undefined
      ),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformResult.posts.map(
    (post: unknown) => {
      const postObj =
        typeof post === "object" && post !== null
          ? (post as Record<string, unknown>)
          : {};
      // Validate Prisma JsonValue with Zod schemas
      const signedEventValue = validateSignedEvent(
        ("signedEvent" in postObj ? postObj["signedEvent"] : undefined) as
          | Prisma.JsonValue
          | null
          | undefined
      );
      const nostrEventValue = validateNostrEvent(
        ("nostrEvent" in postObj ? postObj["nostrEvent"] : undefined) as
          | Prisma.JsonValue
          | null
          | undefined
      );
      const queueTypeValue =
        "queueType" in postObj &&
        postObj["queueType"] &&
        typeof postObj["queueType"] === "object" &&
        "id" in postObj["queueType"] &&
        "name" in postObj["queueType"] &&
        typeof (postObj["queueType"] as { id: unknown; name: unknown })[
          "id"
        ] === "string" &&
        typeof (postObj["queueType"] as { id: unknown; name: unknown })[
          "name"
        ] === "string"
          ? (postObj["queueType"] as {
              id: string;
              name: string;
              scheduleConfig?: unknown;
              color?: string | null;
              description?: string | null;
              scheduleType?: string | null;
              isEnabled?: boolean | null;
              userId: string;
              [key: string]: unknown;
            })
          : undefined;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for Prisma query result with spread operator
      return {
        ...postObj,
        queueType: convertPrismaQueueTypeToQueueType(
          queueTypeValue as unknown as Parameters<
            typeof convertPrismaQueueTypeToQueueType
          >[0]
        ),
        signedEvent: signedEventValue,
        nostrEvent: nostrEventValue,
      } as LongFormPostData;
    }
  );

  // Stats are loaded client-side via usePostStatsQuery to avoid blocking the loader
  // on Primal/Redis (which can timeout and cause 15+ second responses for some pages).
  const stats: Record<string, PostStats> = {};

  // Serialize Date objects to strings for Remix loader response
  // Note: allContent is removed - reconstruct on client from posts/longformPosts
  const postsDTO: PostDTO[] = toPostDTOArray(postsData);
  const longformPostsDTO: LongFormPostDTO[] =
    toLongFormPostDTOArray(longformPostsData);

  const longformPaginationObj = longformResult.pagination as
    | { total?: number }
    | undefined;
  const totalLongform =
    longformPaginationObj && typeof longformPaginationObj.total === "number"
      ? longformPaginationObj.total
      : 0;
  const totalPosts =
    typeof pagination.total === "number" ? pagination.total : 0;

  const outPagination = hasDateRange ? { ...pagination, pages: 1 } : pagination;
  const outLongformPagination =
    hasDateRange && longformResult.pagination
      ? { ...longformResult.pagination, pages: 1 }
      : longformResult.pagination;

  return {
    posts: postsDTO,
    longformPosts: longformPostsDTO,
    longformPagination: outLongformPagination,
    pagination: outPagination,
    stats,
    user,
    queueTypes: queueTypes.filter(
      (qt: unknown) =>
        typeof qt === "object" &&
        qt !== null &&
        "isEnabled" in qt &&
        qt.isEnabled !== false
    ),
    selectedQueueType: queueType,
    totalPostsCount: totalPosts - repostsCount,
    totalRepostsCount: repostsCount,
    totalLongformCount: totalLongform,
    totalContentCount: totalPosts + totalLongform,
  };
}
