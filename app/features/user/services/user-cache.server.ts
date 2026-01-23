/**
 * User Data Caching Service
 * Provides cached versions of user data that rarely changes
 */

import type { HashTagPreset, QueueType } from "@prisma/client";

import type { RelayIntent } from "~/features/relays/relay-resolution.server";
import { getRelayIntent } from "~/features/relays/relay-resolution.server";
import { buildCacheKey, getOrSetJson } from "~/lib/redis-cache.server";

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
