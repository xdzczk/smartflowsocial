/**
 * Search loader data preparation
 * Centralized data fetching for search page
 */

import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { getUserById } from "~/features/user";

/**
 * Load search page data
 */
export async function loadSearchData(userId: string) {
  const [user, publishRelays] = await Promise.all([
    getUserById(userId),
    resolveExecutionRelays(userId),
  ]);
  return { user, publishRelays };
}
