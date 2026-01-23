/**
 * User Profile Caching Service
 * Provides cached user profile fetching with Redis caching and stale-while-revalidate
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { logError } from "~/lib/error-logger.server";
import {
  buildCacheKey,
  getOrSetJson,
  getJsonFromRedis,
  setJsonInRedis,
} from "~/lib/redis-cache.server";

// Cache constants for user profiles
const USER_PROFILE_CACHE = "user-profile";
const USER_PROFILE_TTL_SECONDS = 5 * 60; // 5 minutes
const USER_PROFILE_STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

interface CachedUserProfile {
  data: unknown[];
  cachedAt: number;
}

/**
 * Fetch user profile from API with timeout
 */
async function fetchUserProfileFromAPI(
  pubkey: string,
  timeout = 2000
): Promise<unknown[]> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), timeout)
  );

  const fetchPromise = connectToPrimalCache("user_profile", {
    pubkey,
  });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  return Array.isArray(result) ? result : [];
}

/**
 * Refresh user profile in background (fire-and-forget)
 */
function refreshUserProfileInBackground(pubkey: string): void {
  // Fire and forget - don't await
  void (async () => {
    try {
      const data = await fetchUserProfileFromAPI(pubkey);
      const cacheKey = buildCacheKey({
        namespace: USER_PROFILE_CACHE,
        parts: { pubkey },
      });
      await setJsonInRedis({
        cache: USER_PROFILE_CACHE,
        key: cacheKey,
        value: {
          data,
          cachedAt: Date.now(),
        } satisfies CachedUserProfile,
        ttlSeconds: USER_PROFILE_TTL_SECONDS,
      });
    } catch (error) {
      // Silently fail background refresh
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Background user profile refresh failed",
        pubkey,
      });
    }
  })();
}

/**
 * Get user profile with Redis caching and stale-while-revalidate
 */
export async function getUserProfileWithCache(
  pubkey: string
): Promise<unknown[]> {
  const cacheKey = buildCacheKey({
    namespace: USER_PROFILE_CACHE,
    parts: { pubkey },
  });

  // Check cache first
  const cachedResult = await getJsonFromRedis<CachedUserProfile>({
    cache: USER_PROFILE_CACHE,
    key: cacheKey,
  });

  if (cachedResult.hit) {
    const age = Date.now() - cachedResult.value.cachedAt;
    const isStale = age > USER_PROFILE_STALE_THRESHOLD_MS;

    if (isStale) {
      // Stale-while-revalidate: return cached value immediately, refresh in background
      refreshUserProfileInBackground(pubkey);
    }

    return cachedResult.value.data;
  }

  // Cache miss - fetch and cache
  const cachedValue = await getOrSetJson<CachedUserProfile>({
    cache: USER_PROFILE_CACHE,
    key: cacheKey,
    ttlSeconds: USER_PROFILE_TTL_SECONDS,
    compute: async () => {
      const data = await fetchUserProfileFromAPI(pubkey);
      return {
        data,
        cachedAt: Date.now(),
      } satisfies CachedUserProfile;
    },
  });
  return cachedValue.data;
}
