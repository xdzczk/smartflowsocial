/**
 * Service layer for fetching post data
 * Used by API routes to avoid direct model imports
 */

import { getLongFormPost, getPostById } from "~/features/posts/server";

export async function getPostDataForModal(postId: string, userId: string) {
  // Try to fetch as regular post first
  const post = await getPostById({ id: postId, userId });

  if (post) {
    return {
      post: {
        id: post.id,
        publishAttemptId: post.publishAttemptId,
        currentState: post.currentState,
        scheduledAtUtc: post.scheduledAtUtc,
      },
      longFormPost: null,
    };
  }

  // Try to fetch as longform post
  const longFormPost = await getLongFormPost({ id: postId, userId });

  if (longFormPost) {
    return {
      post: null,
      longFormPost: {
        id: longFormPost.id,
        publishAttemptId: longFormPost.publishAttemptId,
        currentState: longFormPost.currentState,
        scheduledAtUtc: longFormPost.scheduledAtUtc,
      },
    };
  }

  return null;
}
