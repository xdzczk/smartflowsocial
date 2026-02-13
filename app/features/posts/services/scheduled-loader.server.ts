/**
 * Scheduled posts loader data preparation
 * Centralized data fetching for scheduled posts page
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
  getScheduledRepostsCount,
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
 * Load scheduled dashboard data
 */
export async function loadScheduledData(
  userId: string,
  queueType: string,
  page = 1,
  limit = 20
) {
  const [
    postsResult,
    allLongformPostsResult,
    user,
    queueTypes,
    hashTagPresets,
    repostsCount,
  ] = await Promise.all([
    getScheduledPosts({ userId, queueType, page, limit }),
    getScheduledLongFormPosts({ userId, page, limit }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    getScheduledRepostsCount({ userId, queueType }),
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
    const { queueType, ...rest } = post;
    // Validate Prisma JsonValue with Zod schemas (prevents DbNull / invalid-shape issues)
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: PostData = {
      ...rest,
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
