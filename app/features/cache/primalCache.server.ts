import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
import { fetchJsonWithRetry } from "~/lib/fetch.server";
import { connectToPrimalCache as connectToPrimalCacheWs } from "~/lib/nostrwebsocket.server";
import { buildCacheKey, getOrSetJson } from "~/lib/redis-cache.server";
import { withSentrySpan } from "~/lib/sentry.server";

type CacheParams = Record<string, unknown>;
type CacheResponse = unknown[];

const SENTRY_SPAN_NAME_PRIMAL_FETCH = "primal_cache.fetch";
const SENTRY_SPAN_OP_HTTP_CLIENT = "http.client";

/** Default per-attempt timeout when calling Primal over HTTP (was 15s × 3 attempts ≈ 45s wall time). */
const DEFAULT_PRIMAL_HTTP_TIMEOUT_MS = 8000;

/** Default extra retries after the first attempt (maxRetries in fetch layer = this value). */
const DEFAULT_PRIMAL_HTTP_MAX_RETRIES = 0;

function parsePrimalHttpTimeoutMs(): number {
  const raw = env.PRIMAL_HTTP_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_PRIMAL_HTTP_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_PRIMAL_HTTP_TIMEOUT_MS;
  return Math.min(60_000, Math.max(2_000, n));
}

function parsePrimalHttpMaxRetries(): number {
  const raw = env.PRIMAL_HTTP_MAX_RETRIES?.trim();
  if (!raw) return DEFAULT_PRIMAL_HTTP_MAX_RETRIES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_PRIMAL_HTTP_MAX_RETRIES;
  return Math.min(5, Math.max(0, n));
}

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

/** True if PRIMAL_CACHING_URL is an HTTP(S) proxy (e.g. Cloudflare Worker). */
function isHttpPrimalUrl(url: string | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("http://") || u.startsWith("https://");
}

/**
 * Fetches via HTTP POST when PRIMAL_CACHING_URL is an HTTP(S) proxy
 * (e.g. Cloudflare Worker that forwards to WebSocket backends).
 */
async function fetchFromPrimalViaHttp(
  primalUrl: string,
  requestType: string,
  params: CacheParams
): Promise<CacheResponse> {
  return withSentrySpan(
    {
      name: SENTRY_SPAN_NAME_PRIMAL_FETCH,
      op: SENTRY_SPAN_OP_HTTP_CLIENT,
      attributes: { requestType, transport: "http" },
    },
    () =>
      fetchJsonWithRetry<CacheResponse>(primalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, params }),
        timeout: parsePrimalHttpTimeoutMs(),
        maxRetries: parsePrimalHttpMaxRetries(),
        retryOn5xx: true,
      })
  );
}

/**
 * Fetches via WebSocket when PRIMAL_CACHING_URL is ws/wss or unset
 * (direct Primal cache or default public endpoints).
 */
async function fetchFromPrimalViaWebSocket(
  requestType: string,
  params: CacheParams
): Promise<CacheResponse> {
  return withSentrySpan(
    {
      name: SENTRY_SPAN_NAME_PRIMAL_FETCH,
      op: SENTRY_SPAN_OP_HTTP_CLIENT,
      attributes: { requestType, transport: "websocket" },
    },
    () => connectToPrimalCacheWs(requestType, params)
  );
}

/**
 * Fetches data from the Primal cache.
 * Supports two PRIMAL_CACHING_URL formats:
 * - https://... (e.g. Cloudflare Worker proxy): HTTP POST with { requestType, params }
 * - wss://... or unset: WebSocket API (direct cache or default public endpoints)
 */
export async function fetchFromCache(
  requestType: string,
  params: CacheParams
): Promise<CacheResponse> {
  const primalUrl = env.PRIMAL_CACHING_URL;
  const useHttp = isHttpPrimalUrl(primalUrl);

  const doFetch = (): Promise<CacheResponse> =>
    useHttp && primalUrl
      ? fetchFromPrimalViaHttp(primalUrl, requestType, params)
      : fetchFromPrimalViaWebSocket(requestType, params);

  try {
    const { ttlSeconds, negativeTtlSeconds } =
      cacheTtlSecondsForRequestType(requestType);

    if (!ttlSeconds) {
      return await doFetch();
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
      compute: () =>
        withSentrySpan(
          {
            name: SENTRY_SPAN_NAME_PRIMAL_FETCH,
            op: SENTRY_SPAN_OP_HTTP_CLIENT,
            attributes: { requestType, cache: "redis" },
          },
          doFetch
        ),
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      requestType,
      params,
      message: "[Primal Cache] Failed to fetch",
    });
    throw error;
  }
}

/**
 * Connects to the Primal cache and fetches data.
 * PRIMAL_CACHING_URL can be:
 * - https://... — HTTP proxy (e.g. Cloudflare Worker): POST { requestType, params }, returns same array format
 * - wss://... or unset — WebSocket API (direct cache or default wss://cache1.primal.net/v1, etc.)
 * WebSocket `requestType` strings must match `App.exposed_functions` in Primal’s `app.jl`
 * (e.g. `network_stats`, `thread_view`, `parametrized_replaceable_event`, `contact_list`,
 * `user_followers`, `mutual_follows`). Helpers in `nostrwebsocket.server.ts` map aliases
 * (`reposts`/`likes`/… → `event_actions`) and `net_stats` → `network_stats`.
 * `get_notifications` is used on Primal public caches but is not in the open-source exposed set.
 *
 * @param requestType - The type of request (e.g., "thread_view", "user_profile", etc.)
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

    logError(new Error("[Primal Cache] Empty response"), {
      requestType,
      params,
    });
    throw new Error("Primal cache gave empty response.");
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      requestType,
      params,
      message: "[Primal Cache] Failed",
    });
    throw err;
  }
}
