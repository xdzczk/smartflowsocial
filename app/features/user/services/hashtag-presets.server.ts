import type { HashTagPreset, User } from "../data/user-prisma-types.server";
import {
  createHashTagPreset as createHashTagPresetRow,
  deleteHashTagPreset as deleteHashTagPresetRow,
  findHashTagPresetByIdAndUserId,
  findHashTagPresetExists,
  findHashTagPresetsByUserId,
  findUserShowHashTagsInPosts,
  updateHashTagPreset as updateHashTagPresetRow,
  updateUserShowHashTagsInPosts,
} from "../repositories/hashtag-presets-data.server";

/**
 * Creates a new hashtag preset for a user
 */
export function createHashTagPreset(
  userId: string,
  name: string,
  tags: string,
  description?: string
): Promise<HashTagPreset> {
  return createHashTagPresetRow({ userId, name, tags, description });
}

/**
 * Updates an existing hashtag preset
 */
export function updateHashTagPreset(
  userId: string,
  id: string,
  name: string,
  tags: string,
  description?: string
): Promise<HashTagPreset> {
  return updateHashTagPresetRow(userId, id, { name, tags, description });
}

/**
 * Deletes a hashtag preset
 */
export function deleteHashTagPreset(userId: string, id: string): Promise<void> {
  return deleteHashTagPresetRow(userId, id);
}

/**
 * Gets all hashtag presets for a user
 */
export function getUserHashTagPresets(
  userId: string
): Promise<HashTagPreset[]> {
  return findHashTagPresetsByUserId(userId);
}

/**
 * Gets a specific hashtag preset by ID
 */
export function getHashTagPresetById(
  userId: string,
  id: string
): Promise<HashTagPreset | null> {
  return findHashTagPresetByIdAndUserId(userId, id);
}

/**
 * Checks if a hashtag preset exists for a user
 */
export function hashTagPresetExistsForUser(
  userId: string,
  presetId: string
): Promise<boolean> {
  return findHashTagPresetExists(userId, presetId);
}

/**
 * Updates user's hashtag settings
 */
export function updateUserHashTagsAndSettings(
  userId: string,
  showHashTagsInPosts: boolean
): Promise<User> {
  return updateUserShowHashTagsInPosts(userId, showHashTagsInPosts);
}

/**
 * Gets whether user wants to show hashtags in posts
 */
export function getShowHashTagsInPosts(userId: string): Promise<boolean> {
  return findUserShowHashTagsInPosts(userId);
}

/**
 * Updates whether user wants to show hashtags in posts
 */
export function updateShowHashTagsInPosts(
  userId: string,
  showHashTags: boolean
): Promise<User> {
  return updateUserShowHashTagsInPosts(userId, showHashTags);
}
