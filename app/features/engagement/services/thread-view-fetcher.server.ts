/**
 * Thread view fetching service
 * Fetches thread view data from Primal API with timeout support
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";

/**
 * Fetch thread view with timeout
 */
export async function fetchThreadViewWithTimeout(
  eventId: string,
  timeout = 5000
): Promise<unknown> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), timeout)
  );

  const fetchPromise = connectToPrimalCache("thread_view", {
    event_id: eventId,
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}
