/**
 * Posted Posts Service
 * 
 * Handles posted posts data loading
 */

import { combineContent } from "~/features/posts/combined.server";
import { getPostStats } from "~/features/posts/stats.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import { getPublishedLongFormPosts } from "~/models/longformpost.server";
import { getPostedPosts } from "~/models/post.queries.server";
import { getUserById, getQueueTypes } from "~/models/user.server";
/**
 * Get posted posts dashboard data
 */
export async function getPostedDashboardData({
  userId,
  params,
  url,
}: {
  userId: string;
  params: { queueType?: string };
  url: URL;
}) {
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;
  const queueType = params.queueType || "all";

  const [{ posts, pagination }, allLongformResult, user, queueTypes] =
    await Promise.all([
      getPostedPosts({
        userId,
        page,
        limit,
        queueType,
      }),
      getPublishedLongFormPosts({ userId, page, limit }),
      getUserById(userId),
      getQueueTypes(userId),
    ]);

  const longformResult = {
    ...allLongformResult,
    posts:
      queueType === "all"
        ? allLongformResult.posts
        : allLongformResult.posts.filter(
            (post) => {
              if ("queueType" in post && post.queueType && typeof post.queueType === "object" && "name" in post.queueType) {
                return post.queueType.name === queueType;
              }
              return false;
            },
          ),
  };

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    return {
      ...rest,
      queueType: ("queueType" in post && post.queueType) || undefined,
      signedEvent: post.signedEvent as PostData["signedEvent"],
      nostrEvent: post.nostrEvent as PostData["nostrEvent"],
    } as PostData;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformResult.posts.map((post) => {
    return {
      ...post,
      queueType: ("queueType" in post && post.queueType) || undefined,
      signedEvent: post.signedEvent as LongFormPostData["signedEvent"],
      nostrEvent: post.nostrEvent as LongFormPostData["nostrEvent"],
    } as LongFormPostData;
  });

  const allContent = combineContent(
    postsData,
    longformPostsData,
    "postedAt",
    "desc",
  );

  const eventIds = posts.map((post) => {
    const signedEvent = post.signedEvent;
    if (signedEvent && typeof signedEvent === "object" && "id" in signedEvent && typeof signedEvent.id === "string") {
      return signedEvent.id;
    }
    return "";
  }).filter((id) => id !== "");
  const stats = await getPostStats(eventIds);

  return {
    posts,
    longformPosts: longformResult.posts,
    allContent,
    longformPagination: longformResult.pagination,
    pagination,
    stats,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  };
}

