import WebSocket from "ws";

type CacheParams = Record<string, unknown>;
type CacheResponse = unknown[];

/**
 * Gets Primal cache endpoints from environment variable or uses defaults
 * Supports comma-separated list of WebSocket URLs
 */
function getCacheEndpoints(): string[] {
  const envUrl = process.env.PRIMAL_CACHING_URL;
  
  if (envUrl) {
    // Support comma-separated list of endpoints
    const endpoints = envUrl.split(",").map((url) => url.trim()).filter(Boolean);
    if (endpoints.length > 0) {
      return endpoints;
    }
  }
  
  // Default fallback endpoints (public Primal cache servers only)
  return [
    "wss://cache1.primal.net/v1",
    "wss://cache2.primal.net/v1",
  ];
}

async function tryConnectToCache(
  endpoint: string,
  requestType: string,
  params: CacheParams,
): Promise<CacheResponse> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const ws = new WebSocket(endpoint);
    const requestId = Math.random().toString(36).substring(2, 12);
    const responses: unknown[] = [];

    ws.onopen = () => {
      switch (requestType) {
        case "net_stats":
          ws.send(JSON.stringify(["REQ", requestId, { cache: ["net_stats"] }]));
          break;
        case "feed":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              { cache: ["feed", { pubkey: params.pubkey }] },
            ]),
          );
          break;
        case "thread_view": {
          const threadViewMsg = JSON.stringify([
            "REQ",
            requestId,
            { cache: ["thread_view", { event_id: params.event_id }] },
          ]);
          ws.send(threadViewMsg);
          break;
        }
        case "user_infos":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              { cache: ["user_infos", { pubkeys: params.pubkeys }] },
            ]),
          );
          break;
        case "events":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              { cache: ["events", { event_ids: params.event_ids }] },
            ]),
          );
          break;
        case "user_profile":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              { cache: ["user_profile", { pubkey: params.pubkey }] },
            ]),
          );
          break;
        // ---- Added request types below ----

        // Get reposts (kind: 6)
        case "reposts":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              {
                cache: [
                  "event_actions",
                  {
                    event_id: params.event_id,
                    kind: 6,
                    limit: params.limit ?? 100,
                  },
                ],
              },
            ]),
          );
          break;

        // Get likes/reactions (kind: 7)
        case "likes":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              {
                cache: [
                  "event_actions",
                  {
                    event_id: params.event_id,
                    kind: 7,
                    limit: params.limit ?? 100,
                  },
                ],
              },
            ]),
          );
          break;

        // Get replies (kind: 1)
        case "replies":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              {
                cache: [
                  "event_actions",
                  {
                    event_id: params.event_id,
                    kind: 1,
                    limit: params.limit ?? 100,
                  },
                ],
              },
            ]),
          );
          break;

        // Get zaps (kind: 9735)
        case "zaps":
          ws.send(
            JSON.stringify([
              "REQ",
              requestId,
              {
                cache: [
                  "event_actions",
                  {
                    event_id: params.event_id,
                    kind: 9735,
                    limit: params.limit ?? 100,
                  },
                ],
              },
            ]),
          );
          break;

        // ---- End of added request types ----
        default:
          ws.close();
          reject(new Error("Invalid request type"));
          return;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString());
      responses.push(data);

      if (data[0] === "EOSE") {
        ws.send(JSON.stringify(["CLOSE", requestId]));
        ws.close();
        if (!resolved) {
          resolved = true;
          resolve(responses);
        }
      }
    };

    ws.onerror = (error) => {
      console.error(`[WS] WebSocket error on ${endpoint}:`, error);
      ws.close();
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    };

    ws.onclose = () => {
      // If ws closed before resolved, must reject if not already handled
      if (!resolved) {
        resolved = true;
        resolve(responses);
      }
    };

    // timeout in case hangs forever
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          ws.close();
        } catch {
          // Ignore errors when closing WebSocket during timeout
        }
        resolve(responses);
      }
    }, 6000);
  });
}

/**
 * Attempts each Primal cache endpoint, returning the first successful non-empty response.
 * Uses PRIMAL_CACHING_URL from environment (comma-separated for multiple endpoints),
 * or falls back to default endpoints if not configured.
 */
export async function connectToPrimalCache(
  requestType: string,
  params: CacheParams,
): Promise<CacheResponse> {
  const endpoints = getCacheEndpoints();
  
  for (const endpoint of endpoints) {
    try {
      const responses = await tryConnectToCache(endpoint, requestType, params);

      // A "good" response: has at least one element that's not ["EOSE"]
      const nonEose = responses?.filter(
        (res): res is unknown[] => Array.isArray(res) && res[0] !== "EOSE",
      );

      if (nonEose && nonEose.length > 0) {
        return responses;
      }
      // else, try next endpoint
    } catch (err) {
      console.error(`[Cache] ${endpoint} failed with error:`, err);
      // try next endpoint
      continue;
    }
  }
  // All endpoints failed or gave empty responses
  console.error("[Cache] All endpoints failed or gave empty responses");
  throw new Error("All Primal cache endpoints failed or gave empty responses.");
}
