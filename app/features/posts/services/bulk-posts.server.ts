/**
 * Bulk Posts Service
 *
 * Handles bulk posts dashboard data loading
 */

import { getQueueTypes, getUserHashTagPresets } from "~/features/user";
/**
 * Get bulk posts dashboard data
 */
export async function getBulkPostsDashboardData(userId: string) {
  const [hashTagPresetsRaw, queueTypesRaw] = await Promise.all([
    getUserHashTagPresets(userId),
    getQueueTypes(userId),
  ]);

  // Ensure hashTagPresetsRaw is an array before using array methods
  const hashTagPresets = Array.isArray(hashTagPresetsRaw)
    ? hashTagPresetsRaw
    : [];

  // Get "Default" preset tags for backward compatibility
  const defaultPreset = hashTagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";
  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];

  // Split tags string into array and sort alphabetically
  const tagsArray = tags
    ? tags
        .split(/\s+/)
        .filter((t) => t.trim())
        .sort((a, b) => a.localeCompare(b))
    : [];

  // Calculate initial mode based on hash tag presets
  const mode = hashTagPresets.length > 0 ? "preset" : "manual";

  return {
    tags: tagsArray,
    queueTypes: queueTypes.filter(
      (qt: unknown) =>
        typeof qt === "object" &&
        qt !== null &&
        "isEnabled" in qt &&
        qt.isEnabled !== false
    ),
    hashTagPresets,
    mode,
  };
}
