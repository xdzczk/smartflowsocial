/**
 * Longform edit loader data preparation
 * Centralized data fetching for longform edit page
 */

import { getAssets } from "~/models/asset.server";
import {
  getLongFormPost,
} from "~/models/longformpost.server";
import {
  getUserHashTags,
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

/**
 * Load longform edit page data
 */
export async function loadLongFormEditData(userId: string, postId: string) {
  const [
    post,
    tags,
    scheduleIntervals,
    queueTypes,
    user,
    assetsData,
    hashtagPresets,
  ] = await Promise.all([
    getLongFormPost({ id: postId, userId }),
    getUserHashTags(userId),
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserById(userId),
    getAssets({ userId, page: 1, limit: 100 }),
    getUserHashTagPresets(userId),
  ]);

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  return {
    post,
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    assets: assetsData.assets,
    userTimezone: user?.timezone || "Etc/GMT",
    hashtagPresets,
  };
}




