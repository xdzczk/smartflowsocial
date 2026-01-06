/**
 * Utility functions for combining Post and LongFormPost data
 * Used by the "All" tab to display both types of content together
 */

import type { CombinedContent, PostData, LongFormPostData } from "./types";
// Re-export the type
export type { CombinedContent } from "~/features/posts/types";

/**
 * Converts a Post to CombinedContent format
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

export function postToCombinedContent(post: PostData): CombinedContent {
  const result: CombinedContent = {
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
    queueType:
      post.queueType &&
      typeof post.queueType === "object" &&
      "name" in post.queueType
        ? {
            id:
              "id" in post.queueType && post.queueType.id
                ? typeof post.queueType.id === "string"
                  ? post.queueType.id
                  : String(post.queueType.id)
                : "",
            name:
              typeof post.queueType.name === "string"
                ? post.queueType.name
                : String(post.queueType.name ?? ""),
            ...("color" in post.queueType && post.queueType.color
              ? {
                  color:
                    typeof post.queueType.color === "string"
                      ? post.queueType.color
                      : String(post.queueType.color),
                }
              : {}),
          }
        : undefined,
    queueTypeId: nullToUndefined(post.queueTypeId),
    userId: post.userId,
    tags: post.tags,
    signedEvent: nullToUndefined(post.signedEvent),
    nostrEvent: nullToUndefined(post.nostrEvent),
    manual_override: post.manual_override,
    postType: post.postType,
    repost: post.repost,
    isQuotedPost: post.isQuotedPost,
    isRecyclable: post.isRecyclable,
    templateId: post.templateId ?? undefined,
    originalData: post,
  };

  // Only include nostrEventId if it exists in the post
  if (post.nostrEventId !== null && post.nostrEventId !== undefined) {
    result.nostrEventId = post.nostrEventId;
  }

  return result;
}

/**
 * Converts a LongFormPost to CombinedContent format
 */
export function longFormPostToCombinedContent(
  longFormPost: LongFormPostData
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
    queueType: longFormPost.queueType
      ? {
          id: longFormPost.queueType.id,
          name: longFormPost.queueType.name,
          color: longFormPost.queueType.color ?? undefined,
        }
      : undefined,
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
  sortDirection: "asc" | "desc" = "desc"
): CombinedContent[] {
  const combinedPosts = posts.map((post) => postToCombinedContent(post));
  const combinedLongForm = longFormPosts.map((post) =>
    longFormPostToCombinedContent(post)
  );
  const combined = [...combinedPosts, ...combinedLongForm];

  // Sort the combined array
  return combined.sort((a, b) => {
    let aValue = 0;
    let bValue = 0;

    if (sortBy === "scheduledFor") {
      // Handle Unix timestamps for scheduledFor
      const aScheduled = a.scheduledFor;
      const bScheduled = b.scheduledFor;
      aValue = aScheduled
        ? (typeof aScheduled === "string"
            ? parseInt(aScheduled, 10)
            : typeof aScheduled === "number"
              ? aScheduled
              : 0) * 1000
        : 0;
      bValue = bScheduled
        ? (typeof bScheduled === "string"
            ? parseInt(bScheduled, 10)
            : typeof bScheduled === "number"
              ? bScheduled
              : 0) * 1000
        : 0;
    } else if (sortBy === "postedAt" || sortBy === "publishedAt") {
      // Handle dates for postedAt/publishedAt
      const aPosted = a.postedAt;
      const bPosted = b.postedAt;
      aValue = aPosted ? new Date(aPosted).getTime() : 0;
      bValue = bPosted ? new Date(bPosted).getTime() : 0;
    } else if (sortBy === "createdAt" || sortBy === "updatedAt") {
      // Handle dates for createdAt/updatedAt
      const aDate = a[sortBy];
      const bDate = b[sortBy];
      aValue = aDate ? new Date(aDate).getTime() : 0;
      bValue = bDate ? new Date(bDate).getTime() : 0;
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
  searchTerm: string
): CombinedContent[] {
  if (!searchTerm) return content;

  const searchLower = searchTerm.toLowerCase();
  return content.filter((item) => {
    return (
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.caption?.toLowerCase().includes(searchLower) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.title?.toLowerCase().includes(searchLower) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      item.content?.toLowerCase().includes(searchLower) ||
      item.summary?.toLowerCase().includes(searchLower)
    );
  });
}
