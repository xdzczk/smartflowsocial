/**
 * Client-side utility functions for combining Post and LongFormPost data
 * Reconstructs CombinedContent from DTOs on the client side
 */

import type { CombinedContent, PostData, LongFormPostData } from "./types";
import {
  postToCombinedContent,
  longFormPostToCombinedContent,
} from "./combined.server";

/**
 * Combines posts and longform posts into a single sorted array
 * Client-side version that works with deserialized PostData/LongFormPostData
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

