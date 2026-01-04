import type { HashTagPreset, User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Creates a new hashtag preset for a user
 */
export function createHashTagPreset(
  userId: string,
  name: string,
  tags: string,
  description?: string,
): Promise<HashTagPreset> {
  return prisma.hashTagPreset.create({
    data: {
      userId,
      name: name.trim(),
      tags: tags.trim(),
      description: description?.trim(),
    },
  });
}

/**
 * Updates an existing hashtag preset
 */
export function updateHashTagPreset(
  userId: string,
  id: string,
  name: string,
  tags: string,
  description?: string,
): Promise<HashTagPreset> {
  return prisma.hashTagPreset.update({
    where: {
      id,
      userId,
    },
    data: {
      name: name.trim(),
      tags: tags.trim(),
      description: description?.trim(),
    },
  });
}

/**
 * Deletes a hashtag preset
 */
export async function deleteHashTagPreset(
  userId: string,
  id: string,
): Promise<void> {
  await prisma.hashTagPreset.delete({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Gets all hashtag presets for a user
 */
export function getUserHashTagPresets(
  userId: string,
): Promise<HashTagPreset[]> {
  return prisma.hashTagPreset.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Gets a specific hashtag preset by ID
 */
export function getHashTagPresetById(
  userId: string,
  id: string,
): Promise<HashTagPreset | null> {
  return prisma.hashTagPreset.findFirst({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Checks if a hashtag preset exists for a user
 */
export async function hashTagPresetExistsForUser(
  userId: string,
  presetId: string,
): Promise<boolean> {
  const preset = await prisma.hashTagPreset.findFirst({
    where: {
      id: presetId,
      userId: userId,
    },
  });
  return !!preset;
}

/**
 * Updates user's hashtag settings
 */
export function updateUserHashTagsAndSettings(
  userId: string,
  showHashTagsInPosts: boolean,
): Promise<User> {
  // Update the user's showHashTagsinPosts setting
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      showHashTagsinPosts: showHashTagsInPosts,
    },
  });
}

/**
 * Gets whether user wants to show hashtags in posts
 */
export async function getShowHashTagsInPosts(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      showHashTagsinPosts: true,
    },
  });
  return user?.showHashTagsinPosts ?? false;
}

/**
 * Updates whether user wants to show hashtags in posts
 */
export function updateShowHashTagsInPosts(
  userId: string,
  showHashTags: boolean,
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      showHashTagsinPosts: showHashTags,
    },
  });
}




