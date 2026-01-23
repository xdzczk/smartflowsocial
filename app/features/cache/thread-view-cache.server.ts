/**
 * Thread View Caching Service
 * Provides cached thread view fetching with Redis caching and stale-while-revalidate
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { logError } from "~/lib/error-logger.server";
import {
  buildCacheKey,
  getOrSetJson,
  getJsonFromRedis,
  setJsonInRedis,
} from "~/lib/redis-cache.server";

// Cache constants for thread view
const THREAD_VIEW_CACHE = "thread-view";
const THREAD_VIEW_TTL_SECONDS = 5 * 60; // 5 minutes
const THREAD_VIEW_STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

interface CachedThreadView {
  data: unknown[];
  cachedAt: number;
}

/**
 * Fetch thread view from API with timeout
 */
async function fetchThreadViewFromAPI(
  eventId: string,
  timeout = 2000
): Promise<unknown[]> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), timeout)
  );

  const fetchPromise = connectToPrimalCache("thread_view", {
    event_id: eventId,
  });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  return Array.isArray(result) ? result : [];
}

/**
 * Refresh thread view in background (fire-and-forget)
 */
function refreshThreadViewInBackground(eventId: string): void {
  // Fire and forget - don't await
  void (async () => {
    try {
      const data = await fetchThreadViewFromAPI(eventId);
      const cacheKey = buildCacheKey({
        namespace: THREAD_VIEW_CACHE,
        parts: { eventId },
      });
      await setJsonInRedis({
        cache: THREAD_VIEW_CACHE,
        key: cacheKey,
        value: {
          data,
          cachedAt: Date.now(),
        } satisfies CachedThreadView,
        ttlSeconds: THREAD_VIEW_TTL_SECONDS,
      });
    } catch (error) {
      // Silently fail background refresh
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Background thread view refresh failed",
        eventId,
      });
    }
  })();
}

/**
 * Get thread view with Redis caching and stale-while-revalidate
 */
export async function getThreadViewWithCache(
  eventId: string
): Promise<unknown[]> {
  const cacheKey = buildCacheKey({
    namespace: THREAD_VIEW_CACHE,
    parts: { eventId },
  });

  // Check cache first
  const cachedResult = await getJsonFromRedis<CachedThreadView>({
    cache: THREAD_VIEW_CACHE,
    key: cacheKey,
  });

  if (cachedResult.hit) {
    const age = Date.now() - cachedResult.value.cachedAt;
    const isStale = age > THREAD_VIEW_STALE_THRESHOLD_MS;

    if (isStale) {
      // Stale-while-revalidate: return cached value immediately, refresh in background
      refreshThreadViewInBackground(eventId);
    }

    return cachedResult.value.data;
  }

  // Cache miss - fetch and cache
  const cachedValue = await getOrSetJson<CachedThreadView>({
    cache: THREAD_VIEW_CACHE,
    key: cacheKey,
    ttlSeconds: THREAD_VIEW_TTL_SECONDS,
    compute: async () => {
      const data = await fetchThreadViewFromAPI(eventId);
      return {
        data,
        cachedAt: Date.now(),
      } satisfies CachedThreadView;
    },
  });
  return cachedValue.data;
}
