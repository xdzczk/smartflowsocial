/**
 * Utility functions for combining Post and LongFormPost data
 * Works in both server and client contexts
 * Reconstructs CombinedContent from DTOs
 */

import { fromDate, fromISOString } from "~/lib/temporal";

import { getQueueAccentHex } from "./queue-colors";
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
export function postToCombinedContent(post: PostData): CombinedContent {
  const result: CombinedContent = {
    id: post.id,
    type: "post",
    caption: nullToUndefined(post.caption),
    content: nullToUndefined(post.content),
    fileUrl: post.fileUrl,
    scheduledAtUtc: nullToUndefined(post.scheduledAtUtc),
    publishedAt: nullToUndefined(post.publishedAt),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    status: post.status,
    currentState: post.currentState, // Include state machine state
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
            color: getQueueAccentHex(
              (post.queueType as { colorToken?: string | null }).colorToken ??
                null
            ),
            colorToken: nullToUndefined(
              (post.queueType as { colorToken?: string | null }).colorToken
            ),
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
    originalData: post,
  };

  // Only include nostrEventId if it exists in the post
  if (post.nostrEventId != null) {
    result.nostrEventId = post.nostrEventId;
  }
  result.postKind = post.postKind;
  result.threadGroupId = post.threadGroupId ?? undefined;
  result.replyToEventId = post.replyToEventId ?? undefined;
  result.replyToPostId = post.replyToPostId ?? undefined;
  result.dependencyMode = post.dependencyMode;

  return result;
}

/**
 * Converts a LongFormPost to CombinedContent format
 * Client-side version (duplicated from server to avoid importing .server.ts)
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
    scheduledAtUtc: nullToUndefined(longFormPost.scheduledAtUtc),
    publishedAt: nullToUndefined(longFormPost.publishedAt),
    createdAt: longFormPost.createdAt,
    updatedAt: longFormPost.updatedAt,
    status: longFormPost.status,
    currentState: longFormPost.currentState, // Include state machine state
    queueType: longFormPost.queueType
      ? {
          id: longFormPost.queueType.id,
          name: longFormPost.queueType.name,
          color: getQueueAccentHex(
            (longFormPost.queueType as { colorToken?: string | null })
              .colorToken ?? null
          ),
          colorToken: nullToUndefined(
            (longFormPost.queueType as { colorToken?: string | null })
              .colorToken
          ),
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

function parseScheduledAtUtc(value: unknown): number {
  if (!value) return 0;
  try {
    const dateObj = value instanceof Date ? value : new Date(String(value));
    if (isNaN(dateObj.getTime())) return 0;
    return Number(fromDate(dateObj, "UTC").epochMilliseconds);
  } catch {
    try {
      return Number(fromISOString(String(value), "UTC").epochMilliseconds);
    } catch {
      const dateObj = new Date(String(value));
      return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
    }
  }
}

function getSortValue(item: CombinedContent, sortBy: string): number {
  if (sortBy === "scheduledAtUtc" || sortBy === "scheduledFor") {
    return parseScheduledAtUtc(item.scheduledAtUtc);
  }
  if (sortBy === "publishedAt") {
    try {
      return item.publishedAt
        ? Number(fromDate(new Date(item.publishedAt), "UTC").epochMilliseconds)
        : 0;
    } catch {
      // Fallback - still use Temporal for 100% consistency
      try {
        return item.publishedAt
          ? Number(
              fromISOString(
                item.publishedAt instanceof Date
                  ? item.publishedAt.toISOString()
                  : String(item.publishedAt),
                "UTC"
              ).epochMilliseconds
            )
          : 0;
      } catch {
        return item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
      }
    }
  }
  if (sortBy === "createdAt" || sortBy === "updatedAt") {
    const dateValue = item[sortBy];
    try {
      return Number(fromISOString(String(dateValue), "UTC").epochMilliseconds);
    } catch {
      // Fallback - still use Temporal
      try {
        return Number(fromDate(new Date(dateValue), "UTC").epochMilliseconds);
      } catch {
        return new Date(dateValue).getTime();
      }
    }
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
