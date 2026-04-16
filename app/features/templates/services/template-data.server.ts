import {
  getTemplateById,
  createTemplate,
  getTemplates,
  getTemplateListSummaries,
  updateTemplate,
  deleteTemplate,
} from "~/features/templates/repositories/template-data.server";

export {
  createTemplate,
  getTemplates,
  getTemplateListSummaries,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
};

/**
 * Get prefill data for a template (for loading into New Post or New Longform composer).
 */
export async function getTemplatePrefill({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const template = await getTemplateById({ id, userId });
  if (!template) return null;

  const type = template.templateType;

  if (type === "POST" && template.post) {
    const post = template.post as {
      content?: string | null;
      caption?: string | null;
      fileUrl?: string[] | string;
      queueType?: { name: string } | null;
      queueTypeId?: string | null;
      tags?: string[] | null;
      hashTagPresetId?: string | null;
      draftMeta?: {
        attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
      } | null;
    };
    const fileUrl = Array.isArray(post.fileUrl)
      ? post.fileUrl
      : typeof post.fileUrl === "string"
        ? [post.fileUrl]
        : [];
    return {
      type: "POST" as const,
      post: {
        content: post.content ?? "",
        caption: post.caption ?? "",
        fileUrl,
        queueType: post.queueType?.name ?? "unassigned",
        queueTypeId: post.queueTypeId ?? null,
        tags: Array.isArray(post.tags) ? post.tags.join(" ") : "",
        hashTagPresetId: post.hashTagPresetId ?? null,
        draftMeta: post.draftMeta ?? null,
      },
    };
  }

  if (type === "LONGFORM" && template.longFormPost) {
    const lf = template.longFormPost as {
      title?: string | null;
      summary?: string | null;
      content?: string | null;
      image?: string | null;
      tags?: string[] | null;
      queueType?: { name: string } | null;
    };
    return {
      type: "LONGFORM" as const,
      longform: {
        title: lf.title ?? "",
        summary: lf.summary ?? "",
        content: lf.content ?? "",
        image: lf.image ?? "",
        tags: Array.isArray(lf.tags) ? lf.tags : [],
        queueType: lf.queueType
          ? { name: lf.queueType.name }
          : { name: "unassigned" },
      },
    };
  }

  return null;
}
