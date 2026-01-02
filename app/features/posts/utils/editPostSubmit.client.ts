/**
 * Client-side submit handler logic for editing posts
 * Extracted from EditPostModal for better separation of concerns
 */

import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { signEventFn } from "~/lib/nostr";

import type { PostData, LongFormPostData, UserData } from "../types";

interface EditPostSubmitParams {
  post: PostData | LongFormPostData;
  isLongform: boolean;
  caption?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string;
  existingImages: string[];
  newFiles: File[];
  selectedHashtagPresetTags: string;
  manualHashtags: string;
  useHashtagPresets: boolean;
  selectedQueueType: string;
  selectedHashtagPresetId: string | null;
  scheduledFor: Date | null;
  user?: UserData;
}

export async function prepareEditPostSubmission({
  post,
  isLongform,
  caption,
  title,
  summary,
  content,
  image,
  existingImages,
  newFiles,
  selectedHashtagPresetTags,
  manualHashtags,
  useHashtagPresets,
  selectedQueueType,
  selectedHashtagPresetId,
  scheduledFor,
  user,
}: EditPostSubmitParams) {
  // Handle image uploads first if there are new files
  const allImageUrls = [...existingImages];
  if (newFiles.length > 0) {
    const uploadResults = await uploadMultipleFiles(newFiles);
    const failedUploads = uploadResults.filter((result) => !result.success);
    if (failedUploads.length > 0) {
      throw new Error(
        `Upload failed: ${failedUploads.map((r) => r.error).join(", ")}`,
      );
    }
    const newUrls = uploadResults
      .filter((result) => result.success && result.file)
      .map((result) => result.file!.url);
    allImageUrls.push(...newUrls);
  }

  let eventContent = "";
  let eventTags: string[][] = [];
  let finalHashtags = "";

  if (isLongform) {
    // Create longform event content (NIP-23)
    eventContent = content ?? "";
    eventTags = [
      ["d", post.id], // identifier tag
      ["title", title ?? ""],
      ["summary", summary ?? ""],
    ];
    if (image) {
      eventTags.push(["image", image]);
    }
  } else {
    // Determine final hashtags to use
    if (useHashtagPresets && selectedHashtagPresetTags) {
      finalHashtags = selectedHashtagPresetTags;
    } else {
      finalHashtags = manualHashtags;
    }

    // Create post content with images below text
    eventContent = caption ?? "";

    // Add image URLs to content (below the text)
    if (allImageUrls.length > 0) {
      const imageContent = allImageUrls.join("\n");
      eventContent = eventContent
        ? `${eventContent}\n\n${imageContent}`
        : imageContent;
    }

    // Add hashtags if applicable and user setting is enabled
    if (user?.showHashTagsinPosts && finalHashtags) {
      eventContent = `${eventContent}\n${finalHashtags}`;
    }

    // Parse hashtags and add as 't' tags
    if (finalHashtags) {
      const hashtagList = finalHashtags
        .split(/\s+/)
        .filter((tag) => tag.startsWith("#") && tag.length > 1);
      hashtagList.forEach((tag) => {
        eventTags.push(["t", tag.replace("#", "")]);
      });
    }
  }

  const eventKind = isLongform ? 30023 : 1;
  const eventTime = scheduledFor
    ? Math.floor(scheduledFor.getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  // Re-sign the event with new content
  const { nostrEvent, signedEvent } = await signEventFn({
    content: eventContent,
    created_at: eventTime,
    kind: eventKind,
    tags: eventTags,
  });

  // Build form data
  const formData = new FormData();
  formData.append("_action", isLongform ? "editLongform" : "editPost");
  formData.append("postId", post.id);
  formData.append("signedEvent", JSON.stringify(signedEvent));
  formData.append("nostrEvent", JSON.stringify(nostrEvent));

  if (scheduledFor) {
    formData.append(
      "scheduledFor",
      Math.floor(scheduledFor.getTime() / 1000).toString(),
    );
  }

  if (isLongform) {
    formData.append("title", title ?? "");
    formData.append("summary", summary ?? "");
    formData.append("content", content ?? "");
    formData.append("image", image ?? "");
  } else {
    formData.append("caption", caption ?? "");
    formData.append("fileUrl", JSON.stringify(allImageUrls));
    formData.append("hashtags", finalHashtags);
    if (selectedQueueType) {
      formData.append("queueTypeId", selectedQueueType);
    }
    if (useHashtagPresets && selectedHashtagPresetId) {
      formData.append("hashTagPresetId", selectedHashtagPresetId);
    }
  }

  return formData;
}
