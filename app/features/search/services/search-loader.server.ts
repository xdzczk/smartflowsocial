/**
 * Search loader data preparation
 * Centralized data fetching for search page
 */

import { getUserById } from "~/features/user";
/**
 * Load search page data
 */
export async function loadSearchData(userId: string) {
  const user = await getUserById(userId);
  return { user };
}
