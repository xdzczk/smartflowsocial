/**
 * Templates action handlers
 * Centralized action processing for templates page
 */

import {
  deleteTemplate,
  getTemplates,
} from "~/features/templates/services/template-data.server";
import { getUserTimezone } from "~/features/user/services/user-settings.server";
import { formatForDateTimeLocal, nowInTimezone } from "~/lib/temporal";
import {
  templatesActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

const ACTION_DELETE = "delete";
const ACTION_BULK_DELETE = "bulkDelete";

export async function handleTemplatesAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, templatesActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === ACTION_DELETE) {
    const deleteData = result.data;
    await deleteTemplate({ id: deleteData.templateId, userId });
    return { success: true };
  }

  if (_action === ACTION_BULK_DELETE) {
    const ids = formData
      .getAll("templateIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    for (const id of ids) {
      await deleteTemplate({ id, userId });
    }
    return { success: true };
  }

  // TypeScript guarantees this is "schedule" after the check (discriminated union)
  const scheduleData = result.data as {
    _action: "schedule";
    templateId: string;
  };
  const templates = await getTemplates({ userId });
  const template = templates.find((t) => t.id === scheduleData.templateId);

  if (!template) {
    return { error: "Template not found" };
  }

  const userTimezone = (await getUserTimezone(userId)) ?? "UTC";
  const now = nowInTimezone(userTimezone);
  const startTime = now.add({ hours: 1 });

  // Schedule only applies to post-type templates (one post)
  const post = template.post;
  if (!post) {
    return { error: "Template has no post to schedule" };
  }

  const templateData = [
    {
      caption: post.caption ?? "",

      // Prisma JsonValue for fileUrl may be string[] or string at runtime
      fileUrl: Array.isArray(post.fileUrl)
        ? (post.fileUrl[0] ?? "")
        : typeof post.fileUrl === "string"
          ? post.fileUrl
          : "",
      queueType: post.queueTypeId ?? "unassigned",
      scheduledFor: formatForDateTimeLocal(startTime, userTimezone),
    },
  ];

  return { scheduleData: templateData };
}
