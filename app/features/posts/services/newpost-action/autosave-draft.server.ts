/**
 * Autosave composer draft: create or update Post (DRAFT) with draftMeta.
 */

import { json } from "@remix-run/node";

import { prisma } from "~/lib/prisma.server";

import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";
import { resolveQueueTypeId } from "../queue-type-resolver.server";

import { parseAttachmentMeta } from "./handlers/text-handlers.server";
import { getHashtagPresetTags } from "./hashtag-preset-utils.server";
import { resolveContentWithTokens } from "./inline-tokens.server";

function getFormString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return v != null ? String(v) : "";
}

export async function handleAutosaveDraft(
  userId: string,
  formData: FormData
): Promise<Response> {
  const draftId = formData.get("draftId");
  const contentRaw = getFormString(formData, "content");
  const queueType = getFormString(formData, "queueType") || "unassigned";
  const queueTypeIdRaw = formData.get("queueTypeId");
  const queueTypeId =
    queueTypeIdRaw != null && queueTypeIdRaw !== ""
      ? String(queueTypeIdRaw)
      : null;
  const _scheduledFor = getFormString(formData, "scheduledFor");
  const hashTagPresetIdRaw = formData.get("hashTagPresetId");
  const hashTagPresetId =
    hashTagPresetIdRaw != null && hashTagPresetIdRaw !== ""
      ? String(hashTagPresetIdRaw)
      : null;
  const tagsStr = getFormString(formData, "tags");

  const attachmentMeta = parseAttachmentMeta(formData);
  let content = contentRaw;
  let fileUrl: string[] = [];
  if (attachmentMeta.length > 0) {
    const resolved = resolveContentWithTokens(contentRaw, attachmentMeta);
    content = resolved.content;
    fileUrl = resolved.fileUrl;
  }

  const draftMeta = {
    attachmentMeta: attachmentMeta.map((a) => ({
      localId: a.localId,
      status: "done" as const,
      url: a.url,
      alt: (a as { alt?: string }).alt,
    })),
    contentWithTokens: contentRaw,
  };

  if (draftId && typeof draftId === "string" && draftId.length > 0) {
    const existing = await prisma.post.findFirst({
      where: { id: draftId, userId, currentState: "DRAFT" },
    });
    if (existing) {
      await prisma.post.update({
        where: { id: draftId, userId },
        data: {
          content: content || null,
          caption: content || null,
          fileUrl,
          draftMeta: draftMeta as unknown as object,
          updatedAt: new Date(),
        },
      });
      return json({ draftId, saved: true });
    }
  }

  const hashtagResult = await getHashtagPresetTags(
    userId,
    !!hashTagPresetId,
    hashTagPresetId,
    queueType,
    queueTypeId
  );
  const hashTagPresetTags =
    typeof hashtagResult === "object"
      ? (hashtagResult as { tags: string }).tags
      : "";
  const contentWithHashtags =
    tagsStr || hashTagPresetTags
      ? `${content || ""}\n${tagsStr} ${hashTagPresetTags}`.trim()
      : content || "";

  const resolvedQueueTypeId = await resolveQueueTypeId(
    userId,
    queueTypeId,
    queueType
  );

  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl,
    postType: "TEXT",
    queueTypeId: resolvedQueueTypeId,
    queueType,
    hashTagPresetId,
    isRecyclable: false,
    hashTagPresetTags,
    showHashTagsinPosts: true,
  });

  const newDraftId = result.post.id;
  await prisma.post.update({
    where: { id: newDraftId, userId },
    data: { draftMeta: draftMeta as unknown as object },
  });

  return json({
    draftId: newDraftId,
    saved: true,
  });
}
