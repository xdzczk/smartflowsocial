/**
 * Search loader data preparation
 * Centralized data fetching for search page
 */

import { getUserById } from "~/models/user.server";

/**
 * Load search page data
 */
export async function loadSearchData(userId: string) {
  const user = await getUserById(userId);
  return { user };
}



