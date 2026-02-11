/**
 * Template edit service layer
 * Handles template editing operations
 */

import { json } from "@remix-run/node";

import { getUserTimezone } from "~/features/user/services/user-settings.server";
import { ValidationError } from "~/lib/errors";
import { formatForDateTimeLocal, nowInTimezone } from "~/lib/temporal";
import {
  templateEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from "~/models/template.server";

const ACTION_UPDATE_NAME = "updateName";

/**
 * Load template data for editing
 */
export async function loadTemplateEditData(templateId: string, userId: string) {
  if (!templateId) {
    throw new ValidationError("Template ID is required");
  }

  const template = await getTemplateById({ id: templateId, userId });

  if (!template) {
    throw new ValidationError("Template not found", { templateId, userId });
  }

  return { template };
}

/**
 * Handle template edit actions
 */
export async function handleTemplateEditAction(
  formData: FormData,
  templateId: string,
  userId: string
) {
  if (!templateId) {
    throw new ValidationError("Template ID is required");
  }

  const result = validateFormDataOrRespond(formData, templateEditActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === ACTION_UPDATE_NAME) {
    // TypeScript guarantees this is "updateName" after the check
    const updateData = result.data;

    await updateTemplate({
      id: templateId,
      userId,
      name: updateData.name,
    });

    return json({ success: true });
  }

  if (_action === "delete") {
    await deleteTemplate({
      id: templateId,
      userId,
    });

    return json({ success: true });
  }

  if (_action === "deleteTemplate") {
    await deleteTemplate({ id: templateId, userId });
    // Return JSON so the client can navigate; redirect() from fetcher does not navigate the browser
    return json({ success: true, redirectTo: "/dashboard/templates" });
  }

  // TypeScript guarantees this is "schedule" after checking all other actions
  const template = await getTemplateById({ id: templateId, userId });

  if (!template) {
    return json({ error: "Template not found" }, { status: 404 });
  }

  // Prepare template data for scheduling (similar to repost mode)
  // Get user's timezone for proper date handling
  const userTimezone = (await getUserTimezone(userId)) ?? "UTC";
  const now = nowInTimezone(userTimezone);
  const startTime = now.add({ hours: 1 });

  // Schedule only applies to post-type templates (one post)
  const post = template.post;
  if (!post) {
    return json({ error: "Template has no post to schedule" }, { status: 400 });
  }

  // Prisma JsonValue for fileUrl may be string[] or string at runtime
  const fileUrl = Array.isArray(post.fileUrl)
    ? (post.fileUrl[0] ?? "")
    : typeof post.fileUrl === "string"
      ? post.fileUrl
      : "";
  const templateData = [
    {
      caption: post.caption ?? "",
      fileUrl,
      queueType: post.queueTypeId ?? "unassigned",
      scheduledFor: formatForDateTimeLocal(startTime, userTimezone),
    },
  ];

  return json({ scheduleData: templateData });
}
