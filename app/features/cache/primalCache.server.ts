import { logError } from "~/lib/error-logger.server";

type CacheParams = Record<string, unknown>;
type CacheResponse = unknown[];

/**
 * Fetches data from the Primal cache REST API
 */
async function fetchFromCache(
  requestType: string,
  params: CacheParams,
  retries = 2,
): Promise<CacheResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(process.env.PRIMAL_CACHING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType,
          params,
        }),
      });

      if (!response.ok) {
        // For 502/503 errors, retry after a short delay
        if (
          (response.status === 502 || response.status === 503) &&
          attempt < retries
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1)),
          );
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      if (attempt === retries) {
        console.error(
          `[REST Cache] Failed to fetch after ${retries + 1} attempts:`,
          error,
        );
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error("Failed to fetch from cache after all retries");
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
