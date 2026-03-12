/**
 * Templates loader data preparation
 * Centralized data fetching for templates page
 */

import { getTemplates } from "~/features/templates/services/template-data.server";
import { getUserById } from "~/features/user";

/**
 * Load templates data
 */
export async function loadTemplatesData(userId: string) {
  const [templates, user] = await Promise.all([
    getTemplates({ userId }),
    getUserById(userId),
  ]);

  return {
    templates,
    user,
  };
}
