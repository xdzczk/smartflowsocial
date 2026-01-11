/**
 * Hashtag preset utility functions
 */

import { getHashTagPresetById, getQueueTypes } from "~/features/user";

/**
 * Get hashtag preset tags based on user selection and queue type
 */
export async function getHashtagPresetTags(
  userId: string,
  useHashtagPresets: boolean,
  manualHashTagPresetId: string | null,
  queueType: string,
  queueTypeId: string | null
): Promise<{ tags: string; presetId: string | null }> {
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets && manualHashTagPresetId) {
    // Use manually selected hashtag preset
    const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
    hashTagPresetTags =
      preset &&
      typeof preset === "object" &&
      "tags" in preset &&
      typeof preset.tags === "string"
        ? preset.tags
        : "";
    hashTagPresetId = manualHashTagPresetId;
  } else if (!useHashtagPresets && queueType !== "unassigned") {
    // Use queue type's default hashtag preset
    const queueTypes = await getQueueTypes(userId);

    let selectedQueueType;
    if (queueTypeId) {
      // Prefer lookup by ID if available
      selectedQueueType = queueTypes.find((qt) => qt.id === queueTypeId);
    } else {
      // Fallback to name-based lookup for backward compatibility
      selectedQueueType = queueTypes.find((qt) => qt.name === queueType);
    }

    if (
      selectedQueueType &&
      typeof selectedQueueType === "object" &&
      "hashTagPreset" in selectedQueueType &&
      selectedQueueType.hashTagPreset
    ) {
      const preset = selectedQueueType.hashTagPreset;
      if (
        typeof preset === "object" &&
        "tags" in preset &&
        typeof preset.tags === "string"
      ) {
        hashTagPresetTags = preset.tags;
      }
      if (
        typeof preset === "object" &&
        "id" in preset &&
        typeof preset.id === "string"
      ) {
        hashTagPresetId = preset.id;
      }
    }
  }

  return { tags: hashTagPresetTags, presetId: hashTagPresetId };
}
