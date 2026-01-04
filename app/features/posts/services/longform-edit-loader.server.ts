/**
 * Longform edit loader data preparation
 * Centralized data fetching for longform edit page
 */

import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getAssets } from "~/models/asset.server";
import { getLongFormPost } from "~/models/longformpost.server";

/**
 * Load longform edit page data
 */
export async function loadLongFormEditData(userId: string, postId: string) {
  const [
    post,
    scheduleIntervals,
    queueTypes,
    user,
    assetsData,
    hashtagPresets,
  ] = await Promise.all([
    getLongFormPost({ id: postId, userId }),
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserById(userId),
    getAssets({ userId, page: 1, limit: 100 }),
    getUserHashTagPresets(userId),
  ]);

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  // Get "Default" preset tags for backward compatibility
  const defaultPreset = hashtagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";

  return {
    post,
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    assets: assetsData.assets,
    userTimezone: user?.timezone ?? "Etc/GMT",
    hashtagPresets,
  };
}
