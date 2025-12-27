/**
 * Drafts loader data preparation
 * Centralized data fetching for drafts page
 */

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import {
  getDraftLongFormPosts,
} from "~/models/longformpost.server";
import {
  getDraftPosts,
} from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
} from "~/models/user.server";

/**
 * Load drafts data
 */
export async function loadDraftsData(
  userId: string,
  queueType: string,
) {
  const [posts, allLongformPosts, user, queueTypes] = await Promise.all([
    getDraftPosts({ userId, queueType }),
    getDraftLongFormPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts =
    queueType === "all"
      ? allLongformPosts
      : allLongformPosts.filter((post) => post.queueType?.name === queueType);

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: PostData["signedEvent"] = post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] = post.nostrEvent as PostData["nostrEvent"];
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
    const signedEventValue: LongFormPostData["signedEvent"] = post.signedEvent as LongFormPostData["signedEvent"];
    const nostrEventValue: LongFormPostData["nostrEvent"] = post.nostrEvent as LongFormPostData["nostrEvent"];
    const result: LongFormPostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(postsData, longformPostsData, "createdAt", "desc");

  return {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  };
}




