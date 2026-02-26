/**
 * Client-side submit handler logic for editing posts
 * Extracted from EditPostModal for better separation of concerns
 */

import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { nowSeconds } from "~/lib/temporal";

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

// ============================================================================
// Helper Functions
// ============================================================================

async function uploadNewFiles(
  newFiles: File[],
  existingImages: string[]
): Promise<string[]> {
  const allImageUrls = [...existingImages];
  if (newFiles.length === 0) {
    return allImageUrls;
  }

  const uploadResults = await uploadMultipleFiles(newFiles);
  const failedUploads = uploadResults.filter((result) => !result.success);
  if (failedUploads.length > 0) {
    throw new Error(
      `Upload failed: ${failedUploads.map((r) => r.error).join(", ")}`
    );
  }

  const newUrls = uploadResults
    .filter((result) => result.success && result.file)
    .map((result) => result.file!.url);
  allImageUrls.push(...newUrls);
  return allImageUrls;
}

async function ensureMediaUrlsReady(urls: string[]): Promise<void> {
  const stableUrls = urls.filter((url) => /^\/media\/[^/]+\/[^/]+$/.test(url));
  if (stableUrls.length === 0) return;
  const checks = await Promise.all(
    stableUrls.map(async (url) => {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
      });
      return { url, status: response.status };
    })
  );
  const notReady = checks.filter((entry) => entry.status === 409);
  if (notReady.length > 0) {
    throw new Error(
      "Some media are still processing. Please retry in a moment."
    );
  }
}

function buildLongformEventTags(
  postId: string,
  title: string | undefined,
  summary: string | undefined,
  image: string | undefined
): string[][] {
  const tags: string[][] = [
    ["d", postId],
    ["title", title ?? ""],
    ["summary", summary ?? ""],
  ];
  if (image) {
    tags.push(["image", image]);
  }
  return tags;
}

function getFinalHashtags(
  useHashtagPresets: boolean,
  selectedHashtagPresetTags: string | undefined,
  manualHashtags: string
): string {
  return useHashtagPresets && selectedHashtagPresetTags
    ? selectedHashtagPresetTags
    : manualHashtags;
}

function buildRegularPostContent(
  caption: string | undefined,
  allImageUrls: string[],
  finalHashtags: string,
  user: UserData | null | undefined
): string {
  let eventContent = caption ?? "";

  if (allImageUrls.length > 0) {
    const imageContent = allImageUrls.join("\n");
    eventContent = eventContent
      ? `${eventContent}\n\n${imageContent}`
      : imageContent;
  }

  if (user?.showHashTagsinPosts && finalHashtags) {
    eventContent = `${eventContent}\n${finalHashtags}`;
  }

  return eventContent;
}

function buildHashtagTags(finalHashtags: string): string[][] {
  const eventTags: string[][] = [];
  if (!finalHashtags) {
    return eventTags;
  }

  const hashtagList = finalHashtags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#") && tag.length > 1);
  hashtagList.forEach((tag) => {
    eventTags.push(["t", tag.replace("#", "")]);
  });
  return eventTags;
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
  const allImageUrls = await uploadNewFiles(newFiles, existingImages);
  await ensureMediaUrlsReady(allImageUrls);

  let eventContent = "";
  let eventTags: string[][] = [];
  let finalHashtags = "";

  if (isLongform) {
    eventContent = content ?? "";
    eventTags = buildLongformEventTags(post.id, title, summary, image);
  } else {
    finalHashtags = getFinalHashtags(
      useHashtagPresets,
      selectedHashtagPresetTags,
      manualHashtags
    );
    eventContent = buildRegularPostContent(
      caption,
      allImageUrls,
      finalHashtags,
      user
    );
    eventTags = buildHashtagTags(finalHashtags);
  }

  const eventKind = isLongform ? 30023 : 1;
  const eventTime = scheduledFor
    ? Math.floor(scheduledFor.getTime() / 1000)
    : nowSeconds();

  // Re-sign the event with new content
  const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
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
      Math.floor(scheduledFor.getTime() / 1000).toString()
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

  // Return signedEvent for regular posts so callers can create "also schedule repost/quote"
  if (isLongform) {
    return { formData };
  }
  return { formData, signedEvent };
}
