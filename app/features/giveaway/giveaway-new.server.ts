/**
 * Giveaway "new" page: data for custom create form (recent posts, etc.).
 * Routes use this instead of importing from feature data layers directly.
 */

import { getRecentPublishedPosts } from "~/features/posts/server";

const DEFAULT_RECENT_POSTS_LIMIT = 50;

export interface RecentPostOption {
  id: string;
  caption: string | null;
  publishedAt: string;
  fileUrl: string[];
  postType: string;
}

export async function getRecentPostsForGiveawaySelector(
  userId: string,
  limit = DEFAULT_RECENT_POSTS_LIMIT
): Promise<RecentPostOption[]> {
  const posts = await getRecentPublishedPosts({ userId, days: 90 });
  return posts.slice(0, limit).map((p) => ({
    id: p.id,
    caption: p.caption ?? null,
    publishedAt:
      p.publishedAt instanceof Date ? p.publishedAt.toISOString() : "",
    fileUrl: p.fileUrl,
    postType: p.postType,
  }));
}
