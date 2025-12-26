/**
 * Query Batching Utilities
 * 
 * Provides utilities for batching database queries to prevent N+1 query problems.
 * These functions help optimize database access by loading related data in batches.
 */

import type { User, QueueType, HashTagPreset, Template } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Batch load users by their IDs
 * Returns a Map for O(1) lookup
 */
export async function batchLoadUsers(
  userIds: string[],
): Promise<Map<string, User>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      npub: true,
      timezone: true,
      isEnabled: true,
      createdAt: true,
      updatedAt: true,
      // Add other commonly needed fields
    },
  });

  return new Map(users.map((user) => [user.id, user]));
}

/**
 * Batch load queue types by their IDs
 * Returns a Map for O(1) lookup
 */
export async function batchLoadQueueTypes(
  queueTypeIds: (string | null)[],
): Promise<Map<string, QueueType>> {
  const validIds = queueTypeIds.filter(
    (id): id is string => id !== null && id !== undefined,
  );
  
  if (validIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(validIds)];
  const queueTypes = await prisma.queueType.findMany({
    where: { id: { in: uniqueIds } },
  });

  return new Map(queueTypes.map((qt) => [qt.id, qt]));
}

/**
 * Batch load hashtag presets by their IDs
 * Returns a Map for O(1) lookup
 */
export async function batchLoadHashTagPresets(
  hashTagPresetIds: (string | null)[],
): Promise<Map<string, HashTagPreset>> {
  const validIds = hashTagPresetIds.filter(
    (id): id is string => id !== null && id !== undefined,
  );
  
  if (validIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(validIds)];
  const hashTagPresets = await prisma.hashTagPreset.findMany({
    where: { id: { in: uniqueIds } },
  });

  return new Map(hashTagPresets.map((htp) => [htp.id, htp]));
}

/**
 * Batch load templates by their IDs
 * Returns a Map for O(1) lookup
 */
export async function batchLoadTemplates(
  templateIds: (string | null)[],
): Promise<Map<string, Template>> {
  const validIds = templateIds.filter(
    (id): id is string => id !== null && id !== undefined,
  );
  
  if (validIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(validIds)];
  const templates = await prisma.template.findMany({
    where: { id: { in: uniqueIds } },
  });

  return new Map(templates.map((template) => [template.id, template]));
}

/**
 * Batch load all related data for posts
 * This is useful when you have posts and need to load all their relations
 */
export async function batchLoadPostRelations(ids: {
  queueTypeIds: (string | null)[];
  hashTagPresetIds: (string | null)[];
  templateIds: (string | null)[];
}): Promise<{
  queueTypes: Map<string, QueueType>;
  hashTagPresets: Map<string, HashTagPreset>;
  templates: Map<string, Template>;
}> {
  const [queueTypes, hashTagPresets, templates] = await Promise.all([
    batchLoadQueueTypes(ids.queueTypeIds),
    batchLoadHashTagPresets(ids.hashTagPresetIds),
    batchLoadTemplates(ids.templateIds),
  ]);

  return {
    queueTypes,
    hashTagPresets,
    templates,
  };
}



