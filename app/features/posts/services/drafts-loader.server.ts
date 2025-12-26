/**
 * Drafts loader data preparation
 * Centralized data fetching for drafts page
 */

import { combineContent } from "~/features/posts/combined.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
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
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as PostData["signedEvent"],
      nostrEvent: post.nostrEvent as PostData["nostrEvent"],
    } as PostData;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformPosts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: queueType || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
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




