/**
 * Utility functions for combining Post and LongFormPost data
 * Works in both server and client contexts
 * Reconstructs CombinedContent from DTOs
 */

import type { CombinedContent, PostData, LongFormPostData } from "./types";

/**
 * Helper to convert null to undefined
 */
function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

/**
 * Converts a Post to CombinedContent format
 * Client-side version (duplicated from server to avoid importing .server.ts)
 */
function postToCombinedContent(post: PostData): CombinedContent {
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
                : String(post.queueType.name),
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
    templateId: nullToUndefined(post.templateId),
    originalData: post,
  };

  // Only include nostrEventId if it exists in the post
  if (post.nostrEventId != null) {
    result.nostrEventId = post.nostrEventId;
  }

  return result;
}

/**
 * Converts a LongFormPost to CombinedContent format
 * Client-side version (duplicated from server to avoid importing .server.ts)
 */
function longFormPostToCombinedContent(
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
          color: nullToUndefined(longFormPost.queueType.color),
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

// ============================================================================
// Sorting Helper Functions
// ============================================================================

function parseScheduledFor(value: unknown): number {
  if (!value) {
    return 0;
  }
  if (typeof value === "string") {
    return parseInt(value, 10) * 1000;
  }
  if (typeof value === "number") {
    return value * 1000;
  }
  return 0;
}

function getSortValue(item: CombinedContent, sortBy: string): number {
  if (sortBy === "scheduledFor") {
    return parseScheduledFor(item.scheduledFor);
  }
  if (sortBy === "postedAt" || sortBy === "publishedAt") {
    return item.postedAt ? new Date(item.postedAt).getTime() : 0;
  }
  if (sortBy === "createdAt" || sortBy === "updatedAt") {
    const dateValue = item[sortBy];
    return new Date(dateValue).getTime();
  }
  return 0;
}

function compareValues(
  aValue: number,
  bValue: number,
  sortDirection: "asc" | "desc"
): number {
  if (sortDirection === "asc") {
    return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
  }
  return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
}

/**
 * Combines posts and longform posts into a single sorted array
 * Client-side version that works with deserialized PostData/LongFormPostData
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

  return combined.sort((a, b) => {
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);
    return compareValues(aValue, bValue, sortDirection);
  });
}
