import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { fetchJsonWithRetry } from "~/lib/fetch.server";
import {
  buildCacheKey,
  getOrSetJson,
  getJsonFromRedis,
  setJsonInRedis,
} from "~/lib/redis-cache.server";

export interface PostStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

// ============================================================================
// Stats Parsing Helper Functions
// ============================================================================

function isStatsEvent(event: unknown, eventId: string): boolean {
  if (!Array.isArray(event) || event.length < 3 || event[0] !== "EVENT") {
    return false;
  }
  const eventDataRaw: unknown = event[2];
  if (
    !eventDataRaw ||
    typeof eventDataRaw !== "object" ||
    Array.isArray(eventDataRaw)
  ) {
    return false;
  }
  const eventTyped = eventDataRaw as { kind?: unknown; content?: unknown };
  const isStatsEvent =
    typeof eventTyped.kind === "number" &&
    eventTyped.kind === 10000100 &&
    typeof eventTyped.content === "string";
  return (
    isStatsEvent &&
    typeof eventTyped.content === "string" &&
    eventTyped.content.includes(eventId)
  );
}

function parseStatsContent(content: string): {
  likes?: number;
  replies?: number;
  mentions?: number;
  reposts?: number;
  zaps?: number;
  satszapped?: number;
} {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const parsedObj = parsed as Record<string, unknown>;
      return {
        likes:
          typeof parsedObj["likes"] === "number"
            ? parsedObj["likes"]
            : undefined,
        replies:
          typeof parsedObj["replies"] === "number"
            ? parsedObj["replies"]
            : undefined,
        mentions:
          typeof parsedObj["mentions"] === "number"
            ? parsedObj["mentions"]
            : undefined,
        reposts:
          typeof parsedObj["reposts"] === "number"
            ? parsedObj["reposts"]
            : undefined,
        zaps:
          typeof parsedObj["zaps"] === "number" ? parsedObj["zaps"] : undefined,
        satszapped:
          typeof parsedObj["satszapped"] === "number"
            ? parsedObj["satszapped"]
            : undefined,
      };
    }
  } catch {
    // If parsing fails, return empty content
  }
  return {};
}

function createEmptyStats(): PostStats {
  return {
    likes: 0,
    replies: 0,
    mentions: 0,
    reposts: 0,
    zaps: 0,
    satszapped: 0,
  };
}

function extractStatsFromEvent(
  data: unknown[],
  eventId: string
): Record<string, PostStats> {
  const statsEvent = data.find((event: unknown) =>
    isStatsEvent(event, eventId)
  );

  if (
    Array.isArray(statsEvent) &&
    statsEvent[2] &&
    typeof statsEvent[2] === "object" &&
    !Array.isArray(statsEvent[2])
  ) {
    const eventData = statsEvent[2] as {
      kind?: unknown;
      content?: unknown;
    };
    if (eventData.content && typeof eventData.content === "string") {
      const content = parseStatsContent(eventData.content);
      return {
        [eventId]: {
          likes: content.likes ?? 0,
          replies: content.replies ?? 0,
          mentions: content.mentions ?? 0,
          reposts: content.reposts ?? 0,
          zaps: content.zaps ?? 0,
          satszapped: content.satszapped ?? 0,
        },
      };
    }
  }

  return {
    [eventId]: createEmptyStats(),
  };
}

// Cache value structure for stale-while-revalidate
interface CachedStats {
  stats: PostStats;
  cachedAt: number; // Unix timestamp in milliseconds
}

// Stale threshold: 2 minutes (120000 ms)
const STALE_THRESHOLD_MS = 2 * 60 * 1000;
// Cache TTL: 5 minutes (300 seconds)
const CACHE_TTL_SECONDS = 5 * 60;
// Cache namespace for post stats
const POST_STATS_CACHE = "post-stats";

/**
 * Fetch stats for a single event ID from external API
 */
async function fetchStatsFromAPI(eventId: string): Promise<PostStats> {
  const primalUrl = process.env["PRIMAL_CACHING_URL"] ?? env.PRIMAL_CACHING_URL;
  if (!primalUrl) {
    return createEmptyStats();
  }

  try {
    const response = await fetchJsonWithRetry<unknown[]>(primalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "thread_view",
        params: {
          event_id: eventId,
        },
      }),
      timeout: 2000, // 2 seconds timeout
      maxRetries: 0, // No retries to fail faster
    });

    const data: unknown[] = Array.isArray(response) ? response : [];
    const extracted = extractStatsFromEvent(data, eventId);
    return extracted[eventId] ?? createEmptyStats();
  } catch {
    // Return empty stats on error
    return createEmptyStats();
  }
}

/**
 * Refresh stats in background (fire-and-forget)
 */
function refreshStatsInBackground(eventId: string): void {
  // Fire and forget - don't await
  void (async () => {
    try {
      const stats = await fetchStatsFromAPI(eventId);
      const cacheKey = buildCacheKey({
        namespace: POST_STATS_CACHE,
        parts: { eventId },
      });
      await setJsonInRedis({
        cache: POST_STATS_CACHE,
        key: cacheKey,
        value: {
          stats,
          cachedAt: Date.now(),
        } satisfies CachedStats,
        ttlSeconds: CACHE_TTL_SECONDS,
      });
    } catch (error) {
      // Silently fail background refresh
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Background stats refresh failed",
        eventId,
      });
    }
  })();
}

/**
 * Get stats for a single event ID with Redis caching and stale-while-revalidate
 */
async function getSinglePostStats(eventId: string): Promise<PostStats> {
  const cacheKey = buildCacheKey({
    namespace: POST_STATS_CACHE,
    parts: { eventId },
  });

  // Check cache first
  const cachedResult = await getJsonFromRedis<CachedStats>({
    cache: POST_STATS_CACHE,
    key: cacheKey,
  });

  if (cachedResult.hit) {
    const age = Date.now() - cachedResult.value.cachedAt;
    const isStale = age > STALE_THRESHOLD_MS;

    if (isStale) {
      // Stale-while-revalidate: return cached value immediately, refresh in background
      refreshStatsInBackground(eventId);
    }

    return cachedResult.value.stats;
  }

  // Cache miss - fetch and cache
  const cachedValue = await getOrSetJson<CachedStats>({
    cache: POST_STATS_CACHE,
    key: cacheKey,
    ttlSeconds: CACHE_TTL_SECONDS,
    compute: async () => {
      const stats = await fetchStatsFromAPI(eventId);
      return {
        stats,
        cachedAt: Date.now(),
      } satisfies CachedStats;
    },
  });
  return cachedValue.stats;
}

/**
 * Fetch stats with concurrency limiting
 * Processes eventIds in batches to avoid overwhelming the external API
 */
async function fetchStatsWithConcurrencyLimit(
  eventIds: string[],
  concurrency = 20
): Promise<Record<string, PostStats>> {
  const stats: Record<string, PostStats> = {};
  const batches: string[][] = [];

  // Split into batches
  for (let i = 0; i < eventIds.length; i += concurrency) {
    batches.push(eventIds.slice(i, i + concurrency));
  }

  // Process batches sequentially, but items within batch concurrently
  for (const batch of batches) {
    const batchPromises = batch.map(async (eventId) => {
      try {
        const statsResult = await getSinglePostStats(eventId);
        return { eventId, stats: statsResult };
      } catch {
        // Individual failures don't block others
        return { eventId, stats: createEmptyStats() };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach((result) => {
      if (result.status === "fulfilled") {
        stats[result.value.eventId] = result.value.stats;
      }
    });
  }

  return stats;
}

/**
 * Get post stats for multiple event IDs with optimizations:
 * - Redis caching with stale-while-revalidate
 * - Deduplication of eventIds
 * - Concurrency limiting (max 10 concurrent requests)
 */
export async function getPostStats(
  eventIds: string[]
): Promise<Record<string, PostStats>> {
  if (eventIds.length === 0) {
    return {};
  }

  // Deduplicate eventIds to avoid redundant API calls
  const uniqueEventIds = Array.from(new Set(eventIds));

  // Initialize empty stats for all original eventIds
  const emptyStats: Record<string, PostStats> = {};
  eventIds.forEach((eventId) => {
    emptyStats[eventId] = createEmptyStats();
  });

  try {
    // Fetch stats with concurrency limiting (increased to 20 for faster first loads)
    const fetchedStats = await fetchStatsWithConcurrencyLimit(
      uniqueEventIds,
      20
    );

    // Map results back to all eventIds (including duplicates)
    const stats: Record<string, PostStats> = {};
    eventIds.forEach((eventId) => {
      // Use fetched stats if available, otherwise use empty
      const fetchedStat = fetchedStats[eventId];
      if (fetchedStat) {
        stats[eventId] = fetchedStat;
      } else {
        // emptyStats is guaranteed to have all eventIds since we initialized it above
        const emptyStat = emptyStats[eventId];
        stats[eventId] = emptyStat ?? createEmptyStats();
      }
    });

    return stats;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching stats",
      eventIdsCount: eventIds.length,
    });
    // Return empty stats if everything fails
    return emptyStats;
  }
}
