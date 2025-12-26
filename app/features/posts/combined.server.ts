/**
 * Utility functions for combining Post and LongFormPost data
 * Used by the "All" tab to display both types of content together
 */

import type { CombinedContent, PostData, LongFormPostData } from "~/features/posts/types";

// Re-export the type
export type { CombinedContent } from "~/features/posts/types";

/**
 * Converts a Post to CombinedContent format
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

export function postToCombinedContent(post: PostData): CombinedContent {
  return {
    id: post.id,
    type: "post",
    caption: nullToUndefined(post.caption),
    content: nullToUndefined(post.content),
    fileUrl: post.fileUrl,
    scheduledFor: nullToUndefined(post.scheduledFor),
    postedAt: nullToUndefined(post.postedAt),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    isScheduled: post.isScheduled,
    isPosted: post.isPosted,
    draft: post.draft,
    status: post.status,
    queueType: post.queueType ? {
      id: post.queueType.id,
      name: post.queueType.name,
      color: post.queueType.color || undefined,
    } : undefined,
    queueTypeId: nullToUndefined(post.queueTypeId),
    userId: post.userId,
    tags: post.tags,
    signedEvent: nullToUndefined(post.signedEvent),
    nostrEvent: nullToUndefined(post.nostrEvent),
    nostrEventId: nullToUndefined(post.nostrEventId),
    manual_override: post.manual_override,
    postType: post.postType,
    repost: post.repost,
    isQuotedPost: post.isQuotedPost,
    isRecyclable: post.isRecyclable,
    templateId: nullToUndefined(post.templateId),
    originalData: post,
  };
}

/**
 * Converts a LongFormPost to CombinedContent format
 */
export function longFormPostToCombinedContent(
  longFormPost: LongFormPostData,
): CombinedContent {
  return {
    id: longFormPost.id,
    type: "longform",
    title: nullToUndefined(longFormPost.title),
    content: nullToUndefined(longFormPost.content),
    summary: nullToUndefined(longFormPost.summary),
    image: nullToUndefined(longFormPost.image),
    scheduledFor: nullToUndefined(longFormPost.scheduledFor),
    publishedAt: nullToUndefined(longFormPost.publishedAt),
    postedAt: nullToUndefined(longFormPost.publishedAt), // Map publishedAt to postedAt for consistency
    createdAt: longFormPost.createdAt,
    updatedAt: longFormPost.updatedAt,
    isScheduled: longFormPost.isScheduled,
    isPublished: longFormPost.isPublished,
    isPosted: longFormPost.isPublished, // Map isPublished to isPosted for consistency
    draft: longFormPost.draft,
    status: longFormPost.status,
    queueType: longFormPost.queueType ? {
      id: longFormPost.queueType.id,
      name: longFormPost.queueType.name,
      color: longFormPost.queueType.color || undefined,
    } : undefined,
    queueTypeId: nullToUndefined(longFormPost.queueTypeId),
    userId: longFormPost.userId,
    tags: longFormPost.tags,
    signedEvent: nullToUndefined(longFormPost.signedEvent),
    nostrEvent: nullToUndefined(longFormPost.nostrEvent),
    nostrEventId: nullToUndefined(longFormPost.nostrEventId),
    originalData: longFormPost,
  };
}

/**
 * Combines posts and longform posts into a single sorted array
 */
export function combineContent(
  posts: PostData[] = [],
  longFormPosts: LongFormPostData[] = [],
  sortBy = "createdAt",
  sortDirection: "asc" | "desc" = "desc",
): CombinedContent[] {
  const combinedPosts = posts.map(postToCombinedContent);
  const combinedLongForm = longFormPosts.map(longFormPostToCombinedContent);
  const combined = [...combinedPosts, ...combinedLongForm];

  // Sort the combined array
  return combined.sort((a, b) => {
    let aValue, bValue;

    if (sortBy === "scheduledFor") {
      // Handle Unix timestamps for scheduledFor
      aValue = a.scheduledFor ? parseInt(a.scheduledFor) * 1000 : 0;
      bValue = b.scheduledFor ? parseInt(b.scheduledFor) * 1000 : 0;
    } else if (sortBy === "postedAt" || sortBy === "publishedAt") {
      // Handle dates for postedAt/publishedAt
      aValue = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      bValue = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    } else if (sortBy === "createdAt" || sortBy === "updatedAt") {
      // Handle dates for createdAt/updatedAt
      aValue = new Date(a[sortBy]).getTime();
      bValue = new Date(b[sortBy]).getTime();
    } else {
      // Handle other fields
      aValue = (a[sortBy as keyof CombinedContent] as string | number | Date | undefined) || "";
      bValue = (b[sortBy as keyof CombinedContent] as string | number | Date | undefined) || "";
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });
}

/**
 * Filters combined content by search term
 */
export function filterCombinedContent(
  content: CombinedContent[],
  searchTerm: string,
): CombinedContent[] {
  if (!searchTerm) return content;

  const searchLower = searchTerm.toLowerCase();
  return content.filter((item) => {
    return (
      item.caption?.toLowerCase().includes(searchLower) ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.content?.toLowerCase().includes(searchLower) ||
      item.summary?.toLowerCase().includes(searchLower)
    );
  });
}
