/**
 * New longform loader data preparation
 * Centralized data fetching for new longform post page
 */

import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import {
  getTemplatePrefill,
  getTemplates,
} from "~/features/templates/services/template-data.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/features/user";

/**
 * Load new longform post page data. When templateId is in the URL, load that template for prefill.
 */
export async function loadNewLongFormData(
  userId: string,
  templateId: string | null = null
) {
  await requireFeatureAccess(userId, "longformPosts");

  const [
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    user,
    uploadProvider,
    templates,
  ] = await Promise.all([
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    getUserById(userId),
    getUserUploadProvider(userId),
    getTemplates({ userId }),
  ]);

  const defaultPreset = hashTagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";

  const base = {
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    userTimezone: user?.timezone ?? "Etc/GMT",
    uploadProvider,
    templates: templates.filter(
      (t) => (t as { templateType?: string }).templateType === "LONGFORM"
    ),
  };

  if (templateId && templateId.length > 0) {
    const prefill = await getTemplatePrefill({ id: templateId, userId });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prefill type discriminated at runtime
    if (prefill?.type === "LONGFORM" && prefill.longform) {
      return {
        ...base,
        initialTemplateData: prefill.longform,
      };
    }
  }

  return { ...base, initialTemplateData: null };
}
