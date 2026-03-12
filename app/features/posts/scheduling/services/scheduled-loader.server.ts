/**
 * Scheduled posts loader data preparation
 * Centralized data fetching for scheduled posts page
 */

import { combineContent as _combineContent } from "~/features/posts/combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "~/features/posts/dtos";
import {
  getScheduledLongFormPosts,
  getScheduledPosts,
  getScheduledRepostsCount,
} from "~/features/posts/server";
import { filterPostsByQueueType } from "~/features/posts/services/post-filtering.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { parseDateRangeInTimezone } from "~/lib/date-range.server";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";

import type { PostType } from "../../data/posts-prisma-types.server";

/**
 * Load scheduled dashboard data
 * @param dateFrom - Optional YYYY-MM-DD (inclusive start)
 * @param dateTo - Optional YYYY-MM-DD (inclusive end)
 */
export async function loadScheduledData(
  userId: string,
  queueType: string,
  page = 1,
  limit = 20,
  dateFrom?: string | null,
  dateTo?: string | null
) {
  const user = await getUserById(userId);
  const timezone = user?.timezone?.trim() ?? "UTC";
  const dateRange = parseDateRangeInTimezone(dateFrom, dateTo, timezone);
  const scheduledFromUtc = dateRange?.fromUtc;
  const scheduledToUtc = dateRange?.toUtc;

  const [
    postsResult,
    allLongformPostsResult,
    queueTypes,
    hashTagPresets,
    repostsCount,
  ] = await Promise.all([
    getScheduledPosts({
      userId,
      queueType,
      page,
      limit,
      scheduledFromUtc,
      scheduledToUtc,
    }),
    getScheduledLongFormPosts({
      userId,
      page,
      limit,
      scheduledFromUtc,
      scheduledToUtc,
    }),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    getScheduledRepostsCount({
      userId,
      queueType,
      scheduledFromUtc,
      scheduledToUtc,
    }),
  ]);

  // Extract posts and pagination from paginated result
  const posts = postsResult.posts;
  const postsPagination = postsResult.pagination;
  // Extract posts and pagination from paginated result
  const allLongformPosts = allLongformPostsResult.posts;
  const longformPostsPagination = allLongformPostsResult.pagination;

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, repostOf, ...rest } = post as typeof post & {
      repostOf?: { fileUrl: string[]; postType: string | null } | null;
    };
    // For reposts with no media, use original post's fileUrl/postType for display
    const isRepostWithNoMedia =
      (post.repost || post.postKind === "REPOST") &&
      repostOf &&
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fileUrl can be empty at runtime for reposts */
      (!post.fileUrl || post.fileUrl.length === 0);
    const fileUrl = isRepostWithNoMedia ? repostOf.fileUrl : post.fileUrl;
    const postType = isRepostWithNoMedia ? repostOf.postType : post.postType;
    // Validate Prisma JsonValue with Zod schemas (prevents DbNull / invalid-shape issues)
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: PostData = {
      ...rest,
      fileUrl,
      postType: (postType ?? rest.postType) as PostType,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformPosts.map((post) => {
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: LongFormPostData = {
      ...post,
      queueType: convertPrismaQueueTypeToQueueType(
        "queueType" in post ? post.queueType : undefined
      ),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Serialize Date objects to strings for Remix loader response
  // Note: allContent is removed - reconstruct on client from posts/longformPosts
  const postsDTO: PostDTO[] = toPostDTOArray(postsData);
  const longformPostsDTO: LongFormPostDTO[] =
    toLongFormPostDTOArray(longformPostsData);

  const totalPosts = postsPagination.total;
  const totalLongform =
    typeof longformPostsPagination.total === "number"
      ? longformPostsPagination.total
      : 0;

  return {
    posts: postsDTO,
    longformPosts: longformPostsDTO,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    hashTagPresets,
    pagination: postsPagination,
    longformPagination: longformPostsPagination,
    totalPostsCount: totalPosts - repostsCount,
    totalRepostsCount: repostsCount,
    totalLongformCount: totalLongform,
    totalContentCount: totalPosts + totalLongform,
  };
}
