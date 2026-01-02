import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { fetchJsonWithRetry } from "~/lib/fetch.server";

type CacheParams = Record<string, unknown>;
type CacheResponse = unknown[];

/**
 * Fetches data from the Primal cache REST API
 * Uses hardened fetch wrapper with retries and timeouts
 */
export async function fetchFromCache(
  requestType: string,
  params: CacheParams,
): Promise<CacheResponse> {
  // Read directly from process.env to support test environment changes
  const primalUrl = process.env.PRIMAL_CACHING_URL ?? env.PRIMAL_CACHING_URL;
  if (!primalUrl) {
    throw new Error("PRIMAL_CACHING_URL environment variable is not set");
  }

  try {
    const data = await fetchJsonWithRetry<CacheResponse>(primalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType,
        params,
      }),
      timeout: 5000, // 5 seconds for cache requests
      maxRetries: 2,
      retryOn5xx: true,
    });

    return data;
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
  params: CacheParams,
): Promise<CacheResponse> {
  try {
    const responses = await fetchFromCache(requestType, params);

    // Check if we got valid responses (at least one non-EOSE event)
    const nonEose = responses?.filter(
      (res): res is unknown[] => Array.isArray(res) && res[0] !== "EOSE",
    );

    if (nonEose && nonEose.length > 0) {
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
