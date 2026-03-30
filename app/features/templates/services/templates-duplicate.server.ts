/**
 * Duplicate a template by cloning its backing post or longform row.
 */

import { CreatePostUseCase } from "~/features/posts/server/composer";
import { CreateLongFormPostUseCase } from "~/features/posts/server/longform";

import { createTemplate, getTemplateById } from "./template-data.server";

function normalizePostFileUrl(fileUrl: unknown): string[] {
  if (Array.isArray(fileUrl)) {
    return fileUrl.filter((u): u is string => typeof u === "string");
  }
  if (typeof fileUrl === "string" && fileUrl.length > 0) {
    return [fileUrl];
  }
  return [];
}

export async function duplicateTemplateForUser({
  templateId,
  userId,
}: {
  templateId: string;
  userId: string;
}) {
  const t = await getTemplateById({ id: templateId, userId });
  if (!t) {
    return { error: "Template not found" as const };
  }

  const baseName = (t.name ?? "Untitled").trim() || "Untitled";
  const newName = `${baseName} (copy)`;

  if (t.templateType === "POST" && t.post) {
    const p = t.post;
    const createPostUseCase = new CreatePostUseCase();
    const postResult = await createPostUseCase.execute({
      userId,
      content: p.content ?? "",
      caption: p.caption ?? p.content ?? "",
      fileUrl: normalizePostFileUrl(p.fileUrl),
      postType: p.postType,
      queueType: "unassigned",
      queueTypeId: null,
      hashTagPresetId: p.hashTagPresetId ?? undefined,
      isRecyclable: false,
      showHashTagsinPosts: true,
      postKind: p.postKind,
    });

    await createTemplate({
      userId,
      name: newName,
      templateType: "POST",
      postId: postResult.post.id,
      longFormPostId: null,
    });
    return { success: true as const };
  }

  if (t.templateType === "LONGFORM" && t.longFormPost) {
    const lf = t.longFormPost;
    const createLongFormPostUseCase = new CreateLongFormPostUseCase();
    const postResult = await createLongFormPostUseCase.execute({
      userId,
      title: lf.title?.trim() ? lf.title.trim() : "Untitled",
      summary: lf.summary ?? undefined,
      content: lf.content ?? "",
      image: lf.image ?? undefined,
      tags: Array.isArray(lf.tags)
        ? lf.tags.filter((x): x is string => typeof x === "string")
        : [],
      queueType: "unassigned",
      queueTypeId: null,
      hashTagPresetId: lf.hashTagPresetId ?? undefined,
      isPublished: false,
    });

    await createTemplate({
      userId,
      name: newName,
      templateType: "LONGFORM",
      postId: null,
      longFormPostId: postResult.post.id,
    });
    return { success: true as const };
  }

  return { error: "Template has no content to duplicate" as const };
}
