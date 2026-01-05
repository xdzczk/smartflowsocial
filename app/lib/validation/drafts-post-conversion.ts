/**
 * Conversion utilities for drafts Post type to PostData
 * Handles conversion between useDraftsState Post format and PostData
 * Client-safe version
 */

import type { PostData } from "~/features/posts/types";

/**
 * Post format used by useDraftsState hook
 */
export interface DraftsStatePost {
  id: string;
  caption?: string | null;
  createdAt: string; // ISO string
  [key: string]: unknown;
}

/**
 * Safely convert DraftsStatePost back to PostData
 * Attempts to find original PostData from posts array first
 * Falls back to creating a minimal PostData if original not found
 */
export function convertDraftsPostToPostData(
  draftsPost: DraftsStatePost,
  originalPosts: PostData[],
): PostData | null {
  // Try to find original PostData first
  const original = originalPosts.find((p) => p.id === draftsPost.id);
  if (original) {
    return original;
  }

  // If original not found, this is a fallback case
  // We can't safely reconstruct PostData from DraftsStatePost
  // as it's missing many required fields
  // Return null to indicate conversion failure
  return null;
}

/**
 * Convert array of DraftsStatePost to PostData[]
 * Filters out posts that can't be converted
 */
export function convertDraftsPostsToPostDataArray(
  draftsPosts: DraftsStatePost[],
  originalPosts: PostData[],
): PostData[] {
  return draftsPosts
    .map((post) => convertDraftsPostToPostData(post, originalPosts))
    .filter((post): post is PostData => post !== null);
}


