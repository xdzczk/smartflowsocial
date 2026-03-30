/**
 * Template edit service layer
 * Handles template editing operations
 */

import { json } from "@remix-run/node";

import { parseAttachmentMeta } from "~/features/posts/composer/services/newpost-action/handlers/text-handlers.server";
import { getHashtagPresetTags } from "~/features/posts/composer/services/newpost-action/hashtag-preset-utils.server";
import { resolveContentWithTokens } from "~/features/posts/composer/services/newpost-action/inline-tokens.server";
import { updateLongFormPost, updatePost } from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import {
  getTemplateById,
  getTemplatePrefill,
  updateTemplate,
  deleteTemplate,
} from "~/features/templates/services/template-data.server";
import { getQueueTypeByNameForUser } from "~/features/user";
import { ValidationError } from "~/lib/errors";
import {
  sanitizeMarkdown,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";
import {
  templateEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

const ACTION_UPDATE_NAME = "updateName";

async function applyUpdateLongform(
  data: {
    longFormPostId: string;
    queueType?: string;
    content?: string;
    summary?: string;
    title?: string;
    image?: string;
    customTags?: string;
    hashTagPresetId?: string | null;
    name?: string;
  },
  templateId: string,
  userId: string
) {
  const template = await getTemplateById({ id: templateId, userId });
  if (template?.longFormPost?.id !== data.longFormPostId) {
    return json(
      { error: "Template or longform post not found" },
      {
        status: 404,
      }
    );
  }
  let queueTypeId: string | null = null;
  if (data.queueType && data.queueType !== "unassigned") {
    const queueTypeRecord = await getQueueTypeByNameForUser(
      userId,
      data.queueType
    );
    queueTypeId = queueTypeRecord?.id ?? null;
  }
  const markdownContent = (data.content ?? "").trim();
  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary =
    data.summary?.trim() ?? generateSummary(sanitizedContent);
  await updateLongFormPost({
    id: data.longFormPostId,
    userId,
    title: data.title?.trim() ? data.title.trim() : "Untitled",
    summary: finalSummary,
    content: sanitizedContent,
    image: data.image ?? undefined,
    tags: data.customTags
      ? data.customTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
    queueTypeId,
    hashTagPresetId: data.hashTagPresetId ?? undefined,
  });
  if (data.name?.trim()) {
    await updateTemplate({
      id: templateId,
      userId,
      name: data.name.trim(),
    });
  }
  return json({ success: true });
}

/**
 * Load template data for editing, including composer context (queue types, etc.)
 * and prefill for post or longform composer.
 */
export async function loadTemplateEditData(templateId: string, userId: string) {
  if (!templateId) {
    throw new ValidationError("Template ID is required");
  }

  const template = await getTemplateById({ id: templateId, userId });

  if (!template) {
    throw new ValidationError("Template not found", { templateId, userId });
  }

  const { loadNewPostData } = await import("~/features/posts/server/composer");
  const { loadNewLongFormData } =
    await import("~/features/posts/server/longform");

  const prefill = await getTemplatePrefill({ id: templateId, userId });

  let postContext: Awaited<ReturnType<typeof loadNewPostData>> | null = null;
  let longformContext: Awaited<ReturnType<typeof loadNewLongFormData>> | null =
    null;

  if (
    template.post &&
    (template as { templateType?: string }).templateType === "POST"
  ) {
    postContext = await loadNewPostData(userId, null, templateId);
  }
  if (
    template.longFormPost &&
    (template as { templateType?: string }).templateType === "LONGFORM"
  ) {
    longformContext = await loadNewLongFormData(userId, templateId);
  }

  return {
    template,
    prefill: prefill ?? null,
    postContext,
    longformContext,
  };
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

  if (_action === "updateTemplatePost") {
    const data = result.data;
    const template = await getTemplateById({ id: templateId, userId });
    if (template?.post?.id !== data.postId) {
      return json({ error: "Template or post not found" }, { status: 404 });
    }

    const attachmentMeta = parseAttachmentMeta(formData);
    let content = data.content;
    let fileUrl: string[] = [];
    if (attachmentMeta.length > 0) {
      const resolved = resolveContentWithTokens(data.content, attachmentMeta);
      content = resolved.content;
      fileUrl = resolved.fileUrl;
    }

    const hashtagResult = await getHashtagPresetTags(
      userId,
      !!data.useHashtagPresets,
      data.hashTagPresetId ?? "",
      data.queueType,
      data.queueTypeId ?? null
    );
    const hashTagPresetTags = hashtagResult.tags;
    const contentWithHashtags = hashTagPresetTags
      ? `${content}\n${hashTagPresetTags}`.trim()
      : content;

    const resolvedQueueTypeId = await resolveQueueTypeId(
      userId,
      data.queueTypeId ?? null,
      data.queueType
    );

    const tags = data.tags
      ? data.tags
          .toString()
          .split(" ")
          .filter((t) => t.trim())
      : [];

    await updatePost({
      id: data.postId,
      userId,
      data: {
        content: contentWithHashtags,
        caption: contentWithHashtags,
        fileUrl,
        queueTypeId: resolvedQueueTypeId,
        tags,
        hashTagPresetId: data.hashTagPresetId ?? undefined,
      },
    });

    if (data.name?.trim()) {
      await updateTemplate({
        id: templateId,
        userId,
        name: data.name.trim(),
      });
    }

    return json({ success: true });
  }

  return applyUpdateLongform(result.data, templateId, userId);
}
