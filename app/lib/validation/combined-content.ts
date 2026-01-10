/**
 * Type guards for CombinedContent.originalData
 * Provides safe type narrowing for CombinedContent.originalData field
 * Client-safe version
 */

import type {
  PostData,
  LongFormPostData,
  CombinedContent,
} from "~/features/posts/types";

/**
 * Type guard to check if CombinedContent.originalData is PostData
 */
export function isPostData(
  originalData: CombinedContent["originalData"]
): originalData is PostData {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check needed: typeof null === "object" in JavaScript
  if (typeof originalData !== "object" || originalData === null) {
    return false;
  }

  // PostData has specific fields that distinguish it from LongFormPostData
  // PostData doesn't have 'title' or 'summary' fields
  // LongFormPostData has 'title' and 'summary' fields
  return !("title" in originalData) && !("summary" in originalData);
}

/**
 * Type guard to check if CombinedContent.originalData is LongFormPostData
 */
export function isLongFormPostData(
  originalData: CombinedContent["originalData"]
): originalData is LongFormPostData {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check needed: typeof null === "object" in JavaScript
  if (typeof originalData !== "object" || originalData === null) {
    return false;
  }

  // LongFormPostData has 'title' or 'summary' fields
  return "title" in originalData || "summary" in originalData;
}

/**
 * Safely extract PostData from CombinedContent
 * Returns null if originalData is not PostData
 */
export function extractPostData(content: CombinedContent): PostData | null {
  return isPostData(content.originalData) ? content.originalData : null;
}

/**
 * Safely extract LongFormPostData from CombinedContent
 * Returns null if originalData is not LongFormPostData
 */
export function extractLongFormPostData(
  content: CombinedContent
): LongFormPostData | null {
  return isLongFormPostData(content.originalData) ? content.originalData : null;
}
