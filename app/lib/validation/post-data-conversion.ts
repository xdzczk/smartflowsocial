/**
 * Conversion utilities for PostData to component-specific formats
 * Handles type conversions between PostData and component Post interfaces
 * Client-safe version
 */

import type { PostData } from "~/features/posts/types";

/**
 * Post format expected by ScheduledPostsTable component
 */
export interface ScheduledPostTablePost {
  id: string;
  caption?: string | null;
  scheduledAtUtc: Date | null;
  fileUrl?: string[] | null;
  queueType?: {
    name: string;
    color?: string | null;
    colorToken?: string | null;
  } | null;
  repost?: boolean;
  isQuotedPost?: boolean;
  isPostSigned?: boolean;
}

/**
 * Convert PostData[] to ScheduledPostTablePost[]
 * Converts Date scheduledFor to unix timestamp string
 */
export function convertPostDataToScheduledTablePost(
  post: PostData
): ScheduledPostTablePost {
  return {
    id: post.id,
    caption: post.caption,
    scheduledAtUtc: post.scheduledAtUtc ?? null,
    fileUrl: post.fileUrl,
    queueType: post.queueType
      ? {
          name: post.queueType.name,
          color: post.queueType.color ?? null,
          colorToken:
            (post.queueType as { colorToken?: string | null }).colorToken ??
            null,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- repost is optional and may be undefined
    repost: post.repost ?? false,
    isQuotedPost: post.isQuotedPost,
    isPostSigned: post.signedEvent ? true : false,
  };
}

/**
 * Convert PostData[] array to ScheduledPostTablePost[] array
 */
export function convertPostDataArrayToScheduledTablePosts(
  posts: PostData[]
): ScheduledPostTablePost[] {
  return posts.map((post) => convertPostDataToScheduledTablePost(post));
}
