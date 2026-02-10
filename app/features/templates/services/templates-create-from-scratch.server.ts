/**
 * Create template from scratch: create draft Post or LongFormPost then Template.
 * Used by template-only composer routes (new/post and new/longform).
 */

import { redirect } from "@remix-run/node";

import { parseAttachmentMeta } from "~/features/posts/services/newpost-action/handlers/text-handlers.server";
import { getHashtagPresetTags } from "~/features/posts/services/newpost-action/hashtag-preset-utils.server";
import { resolveContentWithTokens } from "~/features/posts/services/newpost-action/inline-tokens.server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { CreateLongFormPostUseCase } from "~/features/posts/use-cases/create-longform-post.use-case.server";
import { CreatePostUseCase } from "~/features/posts/use-cases/create-post.use-case.server";
import { validateFormDataOrRespond } from "~/lib/validation";
import {
  createTemplateFromScratchPostSchema,
  createTemplateFromScratchLongformSchema,
} from "~/lib/validation/schemas/templates.schemas";
import { createTemplate } from "~/models/template.server";

/**
 * Create a post-type template from scratch: create draft Post, then Template.
 */
export async function handleCreateTemplateFromScratchPost(
  userId: string,
  formData: FormData
) {
  const result = validateFormDataOrRespond(
    formData,
    createTemplateFromScratchPostSchema
  );
  if (!result.success) {
    return result.response;
  }

  const {
    templateName,
    content: contentRaw,
    queueType,
    queueTypeId,
    hashTagPresetId: _hashTagPresetId,
    useHashtagPresets,
  } = result.data;

  const attachmentMeta = parseAttachmentMeta(formData);
  let content = contentRaw;
  let fileUrl: string[] = [];
  if (attachmentMeta.length > 0) {
    const resolved = resolveContentWithTokens(contentRaw, attachmentMeta);
    content = resolved.content;
    fileUrl = resolved.fileUrl;
  }

  const hashtagResult = await getHashtagPresetTags(
    userId,
    !!useHashtagPresets,
    result.data.hashTagPresetId ?? "",
    queueType,
    result.data.queueTypeId ?? null
  );
  const hashTagPresetTags =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getHashtagPresetTags return type is union
    typeof hashtagResult === "object" &&
    hashtagResult !== null &&
    "tags" in hashtagResult
      ? (hashtagResult as { tags: string }).tags
      : "";
  const contentWithHashtags = hashTagPresetTags
    ? `${content}\n${hashTagPresetTags}`.trim()
    : content;

  const resolvedQueueTypeId = await resolveQueueTypeId(
    userId,
    queueTypeId ?? null,
    queueType
  );

  const createPostUseCase = new CreatePostUseCase();
  const postResult = await createPostUseCase.execute({
    userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl,
    postType: fileUrl.length > 0 ? "IMAGE" : "TEXT",
    queueTypeId: resolvedQueueTypeId,
    queueType,
    hashTagPresetId: result.data.hashTagPresetId ?? undefined,
    isRecyclable: false,
    hashTagPresetTags,
    showHashTagsinPosts: true,
  });

  await createTemplate({
    userId,
    name: templateName,
    templateType: "POST",
    postId: postResult.post.id,
    longFormPostId: null,
  });

  return redirect("/dashboard/templates");
}

/**
 * Create a longform-type template from scratch: create draft LongFormPost, then Template.
 */
export async function handleCreateTemplateFromScratchLongform(
  userId: string,
  formData: FormData
) {
  const result = validateFormDataOrRespond(
    formData,
    createTemplateFromScratchLongformSchema
  );
  if (!result.success) {
    return result.response;
  }

  const {
    templateName,
    title,
    summary,
    content,
    image,
    customTags,
    queueType,
    queueTypeId,
    hashTagPresetId,
  } = result.data;

  const tags = customTags
    ? customTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const createLongFormPostUseCase = new CreateLongFormPostUseCase();
  const postResult = await createLongFormPostUseCase.execute({
    userId,
    title: title || "Untitled",
    summary: summary ?? undefined,
    content: content || "",
    image: image ?? undefined,
    tags,
    queueTypeId: queueTypeId ?? undefined,
    queueType,
    hashTagPresetId: hashTagPresetId ?? undefined,
    isPublished: false,
  });

  await createTemplate({
    userId,
    name: templateName,
    templateType: "LONGFORM",
    postId: null,
    longFormPostId: postResult.post.id,
  });

  return redirect("/dashboard/templates");
}
