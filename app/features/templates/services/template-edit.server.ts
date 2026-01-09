/**
 * Template edit service layer
 * Handles template editing operations
 */

import { json, redirect } from "@remix-run/node";

import { ValidationError } from "~/lib/errors";
import {
  templateEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  removePostFromTemplate,
} from "~/models/template.server";
const ACTION_UPDATE_NAME = "updateName";
const ACTION_REMOVE_POST = "removePost";

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

  if (_action === ACTION_REMOVE_POST) {
    // TypeScript guarantees this is "removePost" after the check
    const removeData = result.data;

    await removePostFromTemplate({
      templateId,
      postId: removeData.postId,
      userId,
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
    return redirect("/dashboard/templates");
  }

  // TypeScript guarantees this is "schedule" after checking all other actions
  const template = await getTemplateById({ id: templateId, userId });

  if (!template) {
    return json({ error: "Template not found" }, { status: 404 });
  }

  // Prepare template data for scheduling (similar to repost mode)
  const localDate = new Date();
  localDate.setHours(localDate.getHours() + 1);

  const templateData = template.posts.map((post, index) => {
    const scheduleDate = new Date(localDate);
    scheduleDate.setHours(scheduleDate.getHours() + index);

    return {
      caption: post.caption ?? "",
      fileUrl: post.fileUrl,
      queueType: post.queueTypeId ?? "unassigned",
      scheduledFor: scheduleDate
        .toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
    };
  });

  return json({ scheduleData: templateData });
}
