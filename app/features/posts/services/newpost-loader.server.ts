/**
 * New post loader data preparation
 * Centralized data fetching for new post page
 */

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getAssets } from "~/models/asset.server";

/**
 * Load new post page data
 */
export async function loadNewPostData(userId: string) {
  // Require that the user has any subscription before accessing dashboard child routes
  await requireAnySubscription(userId);

  const [scheduleIntervals, queueTypes, hashTagPresets, assetsData] =
    await Promise.all([
      getScheduleInterval(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
      getAssets({ userId, page: 1, limit: 50 }),
    ]);

  return {
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    assets: assetsData.assets,
  };
}




