/**
 * Bulk Posts Service
 * 
 * Handles bulk posts dashboard data loading
 */

import { getQueueTypes, getUserHashTagPresets, getUserHashTags } from "~/models/user.server";
/**
 * Get bulk posts dashboard data
 */
export async function getBulkPostsDashboardData(userId: string) {
  const [tags, queueTypes, hashTagPresets] = await Promise.all([
    getUserHashTags(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  // Split tags string into array and sort alphabetically
  const tagsArray = tags
    ? tags.split(/\s+/).filter((t) => t.trim()).sort((a, b) => a.localeCompare(b))
    : [];

  // Calculate initial mode based on hash tag presets
  const mode = hashTagPresets.length > 0 ? "preset" : "manual";

  return {
    tags: tagsArray,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    hashTagPresets,
    mode,
  };
}




