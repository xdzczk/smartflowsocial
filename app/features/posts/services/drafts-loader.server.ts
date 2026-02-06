/**
 * Drafts loader data preparation
 * Centralized data fetching for drafts page
 */

import { getUserById, getQueueTypes } from "~/features/user";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";
import { getDraftLongFormPosts } from "~/models/longformpost.server";
import { getDraftPosts } from "~/models/post.queries.server";

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
 * Load drafts data
 */
export async function loadDraftsData(
  userId: string,
  queueType: string,
  page = 1,
  limit = 20
) {
  const [postsResult, allLongformPostsResult, user, queueTypes] =
    await Promise.all([
      getDraftPosts({ userId, queueType, page, limit }),
      getDraftLongFormPosts({ userId, page, limit }),
      getUserById(userId),
      getQueueTypes(userId),
    ]);

  // Extract posts and pagination from paginated result
  const posts = postsResult.posts;
  const postsPagination = postsResult.pagination;
  // Extract posts and pagination from paginated result
  const allLongformPosts = allLongformPostsResult.posts;
  const longformPostsPagination = allLongformPostsResult.pagination;

  // Filter longform posts by queue type (includes "unassigned" = no queue)
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    // Validate Prisma JsonValue with Zod schemas
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
    const { queueType, ...rest } = post;
    // Validate Prisma JsonValue with Zod schemas
    const signedEventValue = validateSignedEvent(post.signedEvent);
    const nostrEventValue = validateNostrEvent(post.nostrEvent);
    const result: LongFormPostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
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

  return {
    posts: postsDTO,
    longformPosts: longformPostsDTO,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    pagination: postsPagination, // Use posts pagination as primary
    longformPagination: longformPostsPagination,
  };
}
