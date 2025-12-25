/**
 * Templates loader data preparation
 * Centralized data fetching for templates page
 */

import {
  getAssets,
  searchAssets,
} from "~/models/asset.server";
import { getTemplates } from "~/models/template.server";
import { getUserById } from "~/models/user.server";

/**
 * Load templates data
 */
export async function loadTemplatesData(
  userId: string,
  searchTerm: string = "",
  page: number = 1,
  limit: number = 100,
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

