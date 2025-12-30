/**
 * Bulk Posts Service
 * 
 * Handles bulk posts dashboard data loading
 */

import { getQueueTypes, getUserHashTagPresets, getUserHashTags } from "~/features/user";
/**
 * Get bulk posts dashboard data
 */
export async function getBulkPostsDashboardData(userId: string) {
  const [tagsRaw, queueTypesRaw, hashTagPresetsRaw] = await Promise.all([
    getUserHashTags(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  const tags = typeof tagsRaw === "string" ? tagsRaw : tagsRaw ? String(tagsRaw) : "";
  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];
  const hashTagPresets = Array.isArray(hashTagPresetsRaw) ? hashTagPresetsRaw : [];

  // Split tags string into array and sort alphabetically
  const tagsArray = tags
    ? tags.split(/\s+/).filter((t) => t.trim()).sort((a, b) => a.localeCompare(b))
    : [];

  // Calculate initial mode based on hash tag presets
  const mode = hashTagPresets.length > 0 ? "preset" : "manual";

  return {
    tags: tagsArray,
    queueTypes: queueTypes.filter((qt: unknown) => 
      typeof qt === "object" && qt !== null && "isEnabled" in qt && qt.isEnabled !== false
    ),
    hashTagPresets,
    mode,
  };
}




