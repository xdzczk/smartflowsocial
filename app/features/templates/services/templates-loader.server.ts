/**
 * Templates loader data preparation
 * Centralized data fetching for templates page
 */

import { getUserById } from "~/features/user";
import { getAssets, searchAssets } from "~/models/asset.server";
import { getTemplates } from "~/models/template.server";

/**
 * Load templates data
 */
export async function loadTemplatesData(
  userId: string,
  searchTerm = "",
  page = 1,
  limit = 20
) {
  const [templates, user, assetsData] = await Promise.all([
    getTemplates({ userId }),
    getUserById(userId),
    searchTerm
      ? searchAssets({ userId, searchTerm, page, limit })
      : getAssets({ userId, page, limit }),
  ]);

  return {
    templates,
    user,
    assets: assetsData.assets,
    totalCount: assetsData.totalCount,
    totalPages: assetsData.totalPages,
    currentPage: assetsData.currentPage,
    searchTerm,
  };
}
