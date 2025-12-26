/**
 * Template edit service layer
 * Handles template editing operations
 */

import { json, redirect } from "@remix-run/node";

import { ValidationError } from "~/lib/errors";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  removePostFromTemplate,
} from "~/models/template.server";

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
  userId: string,
) {
  if (!templateId) {
    throw new ValidationError("Template ID is required");
  }

  const _action = formData.get("_action");

  if (_action === "updateName") {
    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return json({ error: "Template name is required" }, { status: 400 });
    }

    await updateTemplate({
      id: templateId,
      userId,
      name,
    });

    return json({ success: true });
  }

  if (_action === "removePost") {
    const postId = formData.get("postId");
    if (!postId || typeof postId !== "string") {
      return json({ error: "Post ID is required" }, { status: 400 });
    }

    await removePostFromTemplate({
      templateId,
      postId,
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

  if (_action === "schedule") {
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
        caption: post.caption || "",
        fileUrl: post.fileUrl,
        queueType: post.queueType || "unassigned",
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

  return json({ error: "Invalid action" }, { status: 400 });
}

