/**
 * Save-draft and (legacy) autosave-draft: create or update Post (DRAFT) with draftMeta.
 * Save-draft redirects to /dashboard/drafts; autosave-draft returns JSON (no longer used from UI).
 */

import { json, redirect } from "@remix-run/node";

import { prisma } from "~/lib/prisma.server";

import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";
import {
  createShortDraftVersion,
  SHORT_SNAPSHOT_SCHEMA_VERSION,
} from "../draft-version.server";
import { resolveQueueTypeId } from "../queue-type-resolver.server";

import { parseAttachmentMeta } from "./handlers/text-handlers.server";
import { getHashtagPresetTags } from "./hashtag-preset-utils.server";
import { resolveContentWithTokens } from "./inline-tokens.server";

function getFormString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return v != null ? String(v) : "";
}

/**
 * Create or update a short-post draft. Returns draftId on success.
 * Used by both save-draft (redirect) and legacy autosave-draft (json).
 */
export async function persistShortDraft(
  userId: string,
  formData: FormData
): Promise<{ draftId: string }> {
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
      return { draftId };
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

  return { draftId: newDraftId };
}

/** Save draft (explicit click): persist, create version snapshot, redirect to drafts. */
export async function handleSaveDraft(
  userId: string,
  formData: FormData
): Promise<Response> {
  const { draftId } = await persistShortDraft(userId, formData);
  const post = await prisma.post.findUnique({
    where: { id: draftId, userId },
    select: {
      content: true,
      caption: true,
      fileUrl: true,
      queueTypeId: true,
      draftMeta: true,
    },
  });
  if (post) {
    await createShortDraftVersion(
      draftId,
      {
        schemaVersion: SHORT_SNAPSHOT_SCHEMA_VERSION,
        /* eslint-disable @typescript-eslint/no-unnecessary-condition -- DB/API can omit */
        content: post.content ?? null,
        caption: post.caption ?? null,
        fileUrl: post.fileUrl ?? [],
        queueTypeId: post.queueTypeId ?? null,
        draftMeta: post.draftMeta ?? null,
        /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      },
      userId
    );
  }
  return redirect("/dashboard/drafts");
}

/** Legacy autosave-draft (no longer used from UI; kept for any remaining callers). */
export async function handleAutosaveDraft(
  userId: string,
  formData: FormData
): Promise<Response> {
  const { draftId } = await persistShortDraft(userId, formData);
  return json({ draftId, saved: true });
}
