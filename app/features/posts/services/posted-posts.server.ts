/**
 * Posted Posts Service
 * 
 * Handles posted posts data loading
 */

import { combineContent } from "~/features/posts/combined.server";
import { getPostStats } from "~/features/posts/stats.server";
import { getPublishedLongFormPosts } from "~/models/longformpost.server";
import { getPostedPosts } from "~/models/post.server";
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
            (post) => post.queueType?.name === queueType,
          ),
  };

  const allContent = combineContent(
    posts,
    longformResult.posts,
    "postedAt",
    "desc",
  );

  const eventIds = posts.map(
    (post) => (post.signedEvent as { id: string }).id,
  );
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

