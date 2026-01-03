/**
 * Scheduled posts loader data preparation
 * Centralized data fetching for scheduled posts page
 */

import { getScheduledLongFormPosts } from "~/models/longformpost.server";
import { getScheduledPosts } from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

import { combineContent } from "../combined.server";
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
export async function loadScheduledData(userId: string, queueType: string) {
  const [posts, allLongformPosts, user, queueTypes, hashTagPresets] =
    await Promise.all([
      getScheduledPosts({ userId, queueType }),
      getScheduledLongFormPosts({ userId }),
      getUserById(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
    ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts = filterPostsByQueueType(allLongformPosts, queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
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
    const signedEventValue: LongFormPostData["signedEvent"] =
      post.signedEvent as LongFormPostData["signedEvent"];
    const nostrEventValue: LongFormPostData["nostrEvent"] =
      post.nostrEvent as LongFormPostData["nostrEvent"];
    const result: LongFormPostData = {
      ...post,
      queueType: convertPrismaQueueTypeToQueueType(
        "queueType" in post ? post.queueType : undefined,
      ),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    postsData,
    longformPostsData,
    "scheduledFor",
    "asc",
  );

  // Serialize Date objects to strings for Remix loader response
  const postsDTO: PostDTO[] = toPostDTOArray(postsData);
  const longformPostsDTO: LongFormPostDTO[] = toLongFormPostDTOArray(
    longformPostsData,
  );

  return {
    posts: postsDTO,
    longformPosts: longformPostsDTO,
    allContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    hashTagPresets,
  };
}
