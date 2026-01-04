/**
 * New longform loader data preparation
 * Centralized data fetching for new longform post page
 */

import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { getAssets } from "~/models/asset.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/features/user";

/**
 * Load new longform post page data
 */
export async function loadNewLongFormData(userId: string) {
  // Check if user has access to long-form posts feature
  await requireFeatureAccess(userId, "longformPosts");

  const [
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    user,
    assetsData,
    uploadProvider,
  ] = await Promise.all([
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    getUserById(userId),
    getAssets({ userId, page: 1, limit: 100 }),
    getUserUploadProvider(userId),
  ]);

  // Get "Default" preset tags for backward compatibility
  const defaultPreset = hashTagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";

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
