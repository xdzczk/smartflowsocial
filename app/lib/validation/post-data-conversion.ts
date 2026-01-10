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
  scheduledFor: string; // Unix timestamp as string
  fileUrl?: string[] | null;
  queueType?: { name: string; color?: string | null } | null;
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
  // Convert scheduledFor Date to unix timestamp string
  // PostData.scheduledFor can be Date | string | null | undefined
  let scheduledForString = "";
  if (post.scheduledFor) {
    const scheduledFor = post.scheduledFor as Date | string | null | undefined;
    if (scheduledFor instanceof Date) {
      scheduledForString = Math.floor(scheduledFor.getTime() / 1000).toString();
    } else if (typeof scheduledFor === "string") {
      scheduledForString = scheduledFor;
    } else if (typeof scheduledFor === "number") {
      scheduledForString = Math.floor(scheduledFor / 1000).toString();
    }
  }

  return {
    id: post.id,
    caption: post.caption,
    scheduledFor: scheduledForString,
    fileUrl: post.fileUrl,
    queueType: post.queueType
      ? {
          name: post.queueType.name,
          color: post.queueType.color ?? null,
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
