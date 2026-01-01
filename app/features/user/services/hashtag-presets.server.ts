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

// Legacy functions for backward compatibility

/**
 * @deprecated Use createHashTagPreset or updateHashTagPreset instead
 * Updates or creates a "Default" hashtag preset for backward compatibility
 */
export async function updateUserHashTags(
  userId: string,
  tags: string,
): Promise<HashTagPreset | null> {
  // For backward compatibility, we'll create or update a "Default" preset
  const existingDefault = await prisma.hashTagPreset.findFirst({
    where: {
      userId,
      name: "Default",
    },
  });

  if (existingDefault) {
    return prisma.hashTagPreset.update({
      where: {
        id: existingDefault.id,
      },
      data: {
        tags,
      },
    });
  } else {
    return prisma.hashTagPreset.create({
      data: {
        userId,
        name: "Default",
        tags,
        description: "Default hashtags",
      },
    });
  }
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
 * @deprecated Use getUserHashTagPresets instead
 * Gets the "Default" hashtag preset tags for backward compatibility
 */
export async function getUserHashTags(userId: string): Promise<string> {
  // For backward compatibility, try to get "Default" preset
  const defaultPreset = await prisma.hashTagPreset.findFirst({
    where: {
      userId,
      name: "Default",
    },
  });
  return defaultPreset?.tags ?? "";
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

/**
 * @deprecated Use hashtag presets instead
 * Gets effective hashtags for a user (legacy function)
 */
export async function getEffectiveHashtags(
  userId: string,
  hashTagPresetId?: string,
): Promise<string> {
  // If hashtag preset is specified, get its tags
  if (hashTagPresetId) {
    const preset = await prisma.hashTagPreset.findFirst({
      where: {
        id: hashTagPresetId,
        userId: userId,
      },
      select: {
        tags: true,
      },
    });

    if (preset?.tags) {
      return preset.tags;
    }
  }

  // Otherwise, return empty string (no default hashtags)
  return "";
}















