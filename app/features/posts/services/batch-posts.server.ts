/**
 * Batch posts service layer
 * Handles batch post fetching operations
 */

import { createSuccessResponse } from "~/lib/error-handler.server";
import { ValidationError, DatabaseError } from "~/lib/errors";
import { getPostsByIds } from "~/models/post.queries.server";

/**
 * Get posts by IDs in batch
 */
export async function getBatchPosts(
  userId: string,
  postIds: string[],
) {
  if (!Array.isArray(postIds)) {
    throw new ValidationError("postIds must be an array", {
      postIdsType: typeof postIds,
      isArray: Array.isArray(postIds),
    });
  }

  let posts;
  try {
    posts = await getPostsByIds({ ids: postIds, userId });
  } catch (error) {
    throw new DatabaseError("Failed to fetch posts", {
      userId,
      postIdsCount: postIds.length,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  return createSuccessResponse(posts);
}

/**
 * Parse batch posts request body
 */
export function parseBatchPostsRequest(body: unknown): {
  postIds: string[];
} {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object", {
      bodyType: typeof body,
    });
  }

  const requestBody = body as { postIds?: unknown };

  if (!Array.isArray(requestBody.postIds)) {
    throw new ValidationError("postIds must be an array", {
      postIdsType: typeof requestBody.postIds,
      isArray: Array.isArray(requestBody.postIds),
    });
  }

  return {
    postIds: requestBody.postIds as string[],
  };
}

