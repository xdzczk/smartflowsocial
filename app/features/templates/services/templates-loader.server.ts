/**
 * Templates loader data preparation
 * Centralized data fetching for templates page
 */

import { getUserById } from "~/features/user";
import { getTemplates } from "~/models/template.server";

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
