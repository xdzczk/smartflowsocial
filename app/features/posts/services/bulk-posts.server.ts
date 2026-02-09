/**
 * Bulk Posts Service
 *
 * Handles bulk posts dashboard data loading
 */

import { getQueueTypes, getUserHashTagPresets } from "~/features/user";

import { getBulkDraftGroupPosts } from "./draft-group.server";

/**
 * Get bulk posts dashboard data. When groupId is provided, also loads that group's posts for prefill.
 */
export async function getBulkPostsDashboardData(
  userId: string,
  groupId: string | null = null
) {
  const [hashTagPresetsRaw, queueTypesRaw, bulkDraftGroupPosts] =
    await Promise.all([
      getUserHashTagPresets(userId),
      getQueueTypes(userId),
      groupId ? getBulkDraftGroupPosts(groupId, userId) : Promise.resolve([]),
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

  const base = {
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

  if (groupId && bulkDraftGroupPosts.length > 0) {
    return {
      ...base,
      groupId,
      bulkDraftGroupPosts: bulkDraftGroupPosts.map((p) => ({
        id: p.id,
        caption: p.caption ?? "",
        fileUrl: p.fileUrl ?? [], // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- API can omit
        queueTypeId: p.queueTypeId,
        queueType: p.queueType,
        scheduledAtUtc: p.scheduledAtUtc,
        isRecyclable: p.isRecyclable ?? false, // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- API can omit
      })),
    };
  }

  return base;
}
