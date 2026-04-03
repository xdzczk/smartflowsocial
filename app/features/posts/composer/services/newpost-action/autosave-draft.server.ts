/**
 * Save-draft and autosave-draft: create or update Post (DRAFT) with draftMeta.
 * Save-draft returns JSON (stay on compose); autosave-draft returns JSON and is used by the
 * composer autosave flow (useComposerAutosave) for background saves.
 */

import { json } from "@remix-run/node";

import { resolveQueueTypeId } from "~/features/posts/server";
import {
  createShortDraftVersion,
  SHORT_SNAPSHOT_SCHEMA_VERSION,
} from "~/features/posts/server/drafts";

import {
  findFirstPost,
  findPostByIdAndUser,
  updatePost,
} from "../../../repositories/post-queries-data.server";
import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";

import { isContestEmbedRequest } from "./contest-embed-response.server";
import { parseAttachmentMeta } from "./handlers/text-handlers.server";
import { getHashtagPresetTags } from "./hashtag-preset-utils.server";
import { parseIncludeHashtagsInNoteBodyFromForm } from "./hashtag-utils.server";
import { prepareComposerTextAndFileUrls } from "./inline-tokens.server";

function getFormString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return v != null ? String(v) : "";
}

/**
 * Create or update a short-post draft. Returns draftId on success.
 * Used by both save-draft and autosave-draft (JSON responses).
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
  const { content, fileUrl } = prepareComposerTextAndFileUrls(
    contentRaw,
    attachmentMeta
  );

  const draftMeta = {
    attachmentMeta: attachmentMeta.map((a) => ({
      localId: a.localId,
      status: "done" as const,
      url: a.url,
      alt: (a as { alt?: string }).alt,
    })),
  };

  if (draftId && typeof draftId === "string" && draftId.length > 0) {
    const existing = await findFirstPost({
      id: draftId,
      userId,
      currentState: "DRAFT",
    });
    if (existing) {
      await updatePost(draftId, userId, {
        content: content || null,
        caption: content || null,
        fileUrl,
        draftMeta: draftMeta as unknown as object,
        updatedAt: new Date(),
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
  const appendTagsToBody = parseIncludeHashtagsInNoteBodyFromForm(
    formData,
    true
  );
  const contentWithHashtags =
    appendTagsToBody && (tagsStr || hashTagPresetTags)
      ? `${content || ""}\n${tagsStr} ${hashTagPresetTags}`.trim()
      : content || "";

  const resolvedQueueTypeId = await resolveQueueTypeId(
    userId,
    queueTypeId,
    queueType
  );

  const { checkDraftCapacity } =
    await import("~/features/payments/entitlements/draft-template-cap.server");
  const capErr = await checkDraftCapacity(userId, 1);
  if (capErr) {
    throw new Error(capErr);
  }

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
    showHashTagsinPosts: appendTagsToBody,
  });

  const newDraftId = result.post.id;
  await updatePost(newDraftId, userId, {
    draftMeta: draftMeta as unknown as object,
  });

  return { draftId: newDraftId };
}

/** Save draft (explicit click): persist, create version snapshot, return JSON for the composer. */
export async function handleSaveDraft(
  userId: string,
  formData: FormData
): Promise<Response> {
  const { draftId } = await persistShortDraft(userId, formData);
  const post = await findPostByIdAndUser(draftId, userId, {
    content: true,
    caption: true,
    fileUrl: true,
    queueTypeId: true,
    draftMeta: true,
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
  if (isContestEmbedRequest(formData)) {
    return json({
      ok: true,
      embedContext: "contest" as const,
      draftSaved: true,
      draftId,
    });
  }
  return json({ ok: true, draftSaved: true, draftId });
}

/** Autosave-draft: persists draft and returns JSON; used by composer autosave (useComposerAutosave). */
export async function handleAutosaveDraft(
  userId: string,
  formData: FormData
): Promise<Response> {
  const { draftId } = await persistShortDraft(userId, formData);
  return json({ draftId, saved: true });
}
