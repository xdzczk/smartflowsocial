/**
 * Draft edit loader data preparation
 * Centralized data fetching for draft edit page
 */

import { getPostById } from "~/models/post.queries.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

/**
 * Load draft edit data
 */
export async function loadDraftEditData(userId: string, postId: string) {
  const [post, user, queueTypes, hashTagPresets] = await Promise.all([
    getPostById({ id: postId, userId }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  if (!post?.draft) {
    throw new Response("Draft not found", { status: 404 });
  }

  return {
    post,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    hashTagPresets,
  };
}
