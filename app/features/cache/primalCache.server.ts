import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { fetchJsonWithRetry } from "~/lib/fetch.server";
import { buildCacheKey, getOrSetJson } from "~/lib/redis-cache.server";
import { withSentrySpan } from "~/lib/sentry.server";

type CacheParams = Record<string, unknown>;
type CacheResponse = unknown[];

function cacheTtlSecondsForRequestType(requestType: string): {
  ttlSeconds: number | null;
  negativeTtlSeconds?: number;
} {
  // Conservative TTLs: enough to reduce load but avoid stale UX.
  switch (requestType) {
    case "thread_view":
      return { ttlSeconds: 30, negativeTtlSeconds: 5 };
    case "user_profile":
      return { ttlSeconds: 300, negativeTtlSeconds: 30 };
    case "user_infos":
      return { ttlSeconds: 300, negativeTtlSeconds: 30 };
    case "event_actions":
      return { ttlSeconds: 30, negativeTtlSeconds: 5 };
    case "get_notifications":
      return { ttlSeconds: 15, negativeTtlSeconds: 5 };
    default:
      return { ttlSeconds: null };
  }
}

function isEmptyCacheResponse(value: CacheResponse): boolean {
  if (!Array.isArray(value) || value.length === 0) return true;
  const nonEose = value.filter(
    (res) => Array.isArray(res) && res[0] !== "EOSE"
  );
  return nonEose.length === 0;
}

/**
 * Fetches data from the Primal cache REST API
 * Uses hardened fetch wrapper with retries and timeouts
 */
export async function fetchFromCache(
  requestType: string,
  params: CacheParams
): Promise<CacheResponse> {
  // Read directly from process.env to support test environment changes
  const primalUrl = process.env["PRIMAL_CACHING_URL"] ?? env.PRIMAL_CACHING_URL;
  if (!primalUrl) {
    throw new Error("PRIMAL_CACHING_URL environment variable is not set");
  }

  try {
    const { ttlSeconds, negativeTtlSeconds } =
      cacheTtlSecondsForRequestType(requestType);

    if (!ttlSeconds) {
      return await withSentrySpan(
        {
          name: "primal_cache.fetch",
          op: "http.client",
          attributes: { requestType },
        },
        async () =>
          await fetchJsonWithRetry<CacheResponse>(primalUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType, params }),
            timeout: 5000,
            maxRetries: 2,
            retryOn5xx: true,
          })
      );
    }

    const key = buildCacheKey({
      namespace: "primal",
      version: "v1",
      parts: { requestType, params },
    });

    return await getOrSetJson<CacheResponse>({
      cache: "primal",
      key,
      ttlSeconds,
      negativeTtlSeconds,
      shouldNegativeCache: isEmptyCacheResponse,
      compute: async () =>
        await withSentrySpan(
          {
            name: "primal_cache.fetch",
            op: "http.client",
            attributes: { requestType, cache: "redis" },
          },
          async () =>
            await fetchJsonWithRetry<CacheResponse>(primalUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestType, params }),
              timeout: 5000,
              maxRetries: 2,
              retryOn5xx: true,
            })
        ),
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      requestType,
      params,
      message: "[REST Cache] Failed to fetch",
    });
    throw error;
  }
}

/**
 * Connects to the Primal cache REST API and fetches data.
 * Supports request types: thread_view, feed, user_profile, user_infos, events, net_stats, reposts, likes, replies, zaps
 *
 * @param requestType - The type of request (e.g., "thread_view", "feed", etc.)
 * @param params - Parameters for the request (e.g., { event_id: "..." })
 * @returns Array of response events from the cache
 *
 * @example
 * const responses = await connectToPrimalCache("thread_view", {
 *   event_id: "d17048466d168d49a0af46ce7fc054f59a797ad0d05e0f95a0241192cd220bff"
 * });
 */
export async function connectToPrimalCache(
  requestType: string,
  params: CacheParams
): Promise<CacheResponse> {
  try {
    const responses = await fetchFromCache(requestType, params);

    // Check if we got valid responses (at least one non-EOSE event)
    const nonEose = responses.filter(
      (res): res is unknown[] => Array.isArray(res) && res[0] !== "EOSE"
    );

    if (nonEose.length > 0) {
      return responses;
    }

    logError(new Error("[REST Cache] Empty response"), {
      requestType,
      params,
    });
    throw new Error("Primal cache gave empty response.");
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      requestType,
      params,
      message: "[REST Cache] Failed",
    });
    throw err;
  }
}
