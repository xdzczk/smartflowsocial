/**
 * User Data Caching Service
 * Provides cached versions of user data that rarely changes
 */

import type { RelayIntent } from "~/features/relays/relay-resolution.server";
import { getRelayIntent } from "~/features/relays/relay-resolution.server";
import {
  buildCacheKey,
  deleteFromRedis,
  getOrSetJson,
} from "~/lib/redis-cache.server";

import type {
  HashTagPreset,
  QueueType,
} from "../data/user-prisma-types.server";

import { getUserHashTagPresets } from "./hashtag-presets.server";
import { getQueueTypes } from "./queue-types.server";

// Cache namespace
const USER_DATA_CACHE = "user-data";

/**
 * Get queue types with caching (5 minute TTL)
 */
export async function getQueueTypesCached(
  userId: string
): Promise<QueueType[]> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "queueTypes" },
  });

  return getOrSetJson<QueueType[]>({
    cache: USER_DATA_CACHE,
    key: cacheKey,
    ttlSeconds: 5 * 60, // 5 minutes
    compute: () => getQueueTypes(userId),
  });
}

/**
 * Invalidate queue types cache for a user (call after create/update/delete)
 */
export async function invalidateQueueTypesCache(userId: string): Promise<void> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "queueTypes" },
  });
  await deleteFromRedis({
    cache: USER_DATA_CACHE,
    key: cacheKey,
  });
}

/**
 * Get hashtag presets with caching (5 minute TTL)
 */
export async function getHashTagPresetsCached(
  userId: string
): Promise<HashTagPreset[]> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "hashTagPresets" },
  });

  return getOrSetJson<HashTagPreset[]>({
    cache: USER_DATA_CACHE,
    key: cacheKey,
    ttlSeconds: 5 * 60, // 5 minutes
    compute: () => getUserHashTagPresets(userId),
  });
}

/**
 * Invalidate hashtag presets cache for a user (call after create/update/delete)
 */
export async function invalidateHashTagPresetsCache(
  userId: string
): Promise<void> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "hashTagPresets" },
  });
  await deleteFromRedis({
    cache: USER_DATA_CACHE,
    key: cacheKey,
  });
}

/**
 * Get relay intent with caching (2 minute TTL)
 */
export async function getRelayIntentCached(
  userId: string
): Promise<RelayIntent> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "relayIntent" },
  });

  return getOrSetJson<RelayIntent>({
    cache: USER_DATA_CACHE,
    key: cacheKey,
    ttlSeconds: 2 * 60, // 2 minutes
    compute: () => getRelayIntent(userId),
  });
}

export async function invalidateRelayIntentCache(
  userId: string
): Promise<void> {
  const cacheKey = buildCacheKey({
    namespace: USER_DATA_CACHE,
    parts: { userId, type: "relayIntent" },
  });
  await deleteFromRedis({
    cache: USER_DATA_CACHE,
    key: cacheKey,
  });
}
