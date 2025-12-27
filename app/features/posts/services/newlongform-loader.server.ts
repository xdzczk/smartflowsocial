/**
 * New longform loader data preparation
 * Centralized data fetching for new longform post page
 */

import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { getAssets } from "~/models/asset.server";
import {
  getUserHashTags,
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/models/user.server";

/**
 * Load new longform post page data
 */
export async function loadNewLongFormData(userId: string) {
  // Check if user has access to long-form posts feature
  await requireFeatureAccess(userId, "longformPosts");

  const [tags, scheduleIntervals, queueTypes, hashTagPresets, user, assetsData, uploadProvider] =
    await Promise.all([
      getUserHashTags(userId),
      getScheduleInterval(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
      getUserById(userId),
      getAssets({ userId, page: 1, limit: 100 }),
      getUserUploadProvider(userId),
    ]);

  return {
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    assets: assetsData.assets,
    userTimezone: user?.timezone ?? "Etc/GMT",
    uploadProvider,
  };
}




