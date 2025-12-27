/**
 * New post action handlers
 * Centralized action processing for new post page
 */

import { redirect ,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import type { SignedEvent } from "~/features/nostr/types";
import { createUploadHandler } from "~/features/upload/s3.server";
import { createPost } from "~/models/post.commands.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
} from "~/models/user.server";

import { resolveQueueTypeId } from "./queue-type-resolver.server";

/**
 * Determine if a file URL is a video based on extension
 */
function isVideoFile(fileUrl: string | string[]): boolean {
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".ogg",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
  ];

  try {
    const urls = typeof fileUrl === "string" ? JSON.parse(fileUrl) as string[] : fileUrl;
    if (Array.isArray(urls) && urls.length > 0) {
      const firstUrl = urls[0];
      const lower = firstUrl.toLowerCase();
      return videoExtensions.some((ext) => lower.includes(ext));
    }
  } catch (e) {
    // If parsing fails, try direct string
    const lower = (fileUrl || "").toString().toLowerCase();
    return videoExtensions.some((ext) => lower.includes(ext));
  }

  return false;
}

/**
 * Get hashtag preset tags based on user selection and queue type
 */
async function getHashtagPresetTags(
  userId: string,
  useHashtagPresets: boolean,
  manualHashTagPresetId: string | null,
  queueType: string,
  queueTypeId: string | null,
): Promise<{ tags: string; presetId: string | null }> {
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets && manualHashTagPresetId) {
    // Use manually selected hashtag preset
    const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
    hashTagPresetTags = preset?.tags ?? "";
    hashTagPresetId = manualHashTagPresetId;
  } else if (!useHashtagPresets && queueType !== "unassigned") {
    // Use queue type's default hashtag preset
    const queueTypes = await getQueueTypes(userId);

    let selectedQueueType;
    if (queueTypeId) {
      // Prefer lookup by ID if available
      selectedQueueType = queueTypes.find((qt) => qt.id === queueTypeId);
    } else {
      // Fallback to name-based lookup for backward compatibility
      selectedQueueType = queueTypes.find((qt) => qt.name === queueType);
    }

    if (selectedQueueType && "hashTagPreset" in selectedQueueType && selectedQueueType.hashTagPreset) {
      const preset = selectedQueueType.hashTagPreset;
      if (preset && typeof preset === "object" && "tags" in preset && typeof preset.tags === "string") {
        hashTagPresetTags = preset.tags || "";
      }
      if (preset && typeof preset === "object" && "id" in preset && typeof preset.id === "string") {
        hashTagPresetId = preset.id;
      }
    }
  }

  return { tags: hashTagPresetTags, presetId: hashTagPresetId };
}

/**
 * Apply hashtags to content if user has showHashTagsinPosts enabled
 */
function applyHashtags(
  content: string,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
): string {
  return showHashTagsinPosts && hashTagPresetTags
    ? `${content}\n${hashTagPresetTags}`
    : content;
}

/**
 * Publish event to Nostr publisher
 */
async function publishToNostr(
  relays: string[],
  signedEvent: SignedEvent,
): Promise<void> {
  const response = await fetch(process.env.NOSTR_PUBLISHER_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      relays,
      event: signedEvent,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to post to nostr publisher: ${response.statusText}`,
    );
  }
}

/**
 * Handle draft text post action
 */
async function handleDraftText(
  userId: string,
  formData: FormData,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  queueType: string,
  queueTypeId: string | null,
  isRecyclable: boolean,
  hashTagPresetId: string | null,
): Promise<Response> {
  const content = formData.get("content") as string;

  // Resolve queue type ID in feature layer (business logic)
  const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);

  await createPost({
    userId,
    content: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: [],
    isScheduled: false,
    isPosted: false,
    postType: "TEXT",
    tags: [],
    queueTypeId: resolvedQueueTypeId,
    draft: true,
    isRecyclable,
    hashTagPresetId,
  });

  return redirect("/dashboard/drafts");
}

/**
 * Handle post or schedule text post action
 */
async function handlePostOrScheduleText(
  userId: string,
  formData: FormData,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  queueType: string,
  queueTypeId: string | null,
  isRecyclable: boolean,
  hashTagPresetId: string | null,
  sanitizedRelays: string[],
  action: "post-text" | "schedule-text",
): Promise<Response> {
  const content = formData.get("content") as string;
  const signedEventRaw = JSON.parse(formData.get("signedEvent") as string) as SignedEvent;
  const nostrEventRaw = JSON.parse(formData.get("nostrEvent") as string) as import("~/features/nostr/types").NostrEvent;
  const signedEvent = signedEventRaw;
  const nostrEvent = nostrEventRaw;
  const signedEventJson = signedEvent;

  if (action === "post-text") {
    // Resolve queue type ID in feature layer (business logic)
    const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);
    
    const post = await createPost({
      userId,
      content: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
      caption: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
      postedAt: new Date(),
      fileUrl: [],
      scheduledFor: String(signedEventJson.created_at),
      isScheduled: false,
      isPosted: true,
      signedEvent: signedEvent,
      nostrEvent: nostrEvent,
      postType: "TEXT",
      tags: [],
      queueTypeId: resolvedQueueTypeId,
      isRecyclable,
      hashTagPresetId,
    });

    await publishToNostr(sanitizedRelays, post.signedEvent as unknown as SignedEvent);

    return redirect("/dashboard/posted");
  } else {
    // schedule-text
    // Resolve queue type ID in feature layer (business logic)
    const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);
    
    await createPost({
      userId,
      content: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
      caption: applyHashtags(content, hashTagPresetTags, showHashTagsinPosts),
      fileUrl: [],
      scheduledFor: String(signedEventJson.created_at),
      isScheduled: true,
      isPosted: false,
      signedEvent: signedEvent,
      nostrEvent: nostrEvent,
      postType: "TEXT",
      tags: [],
      queueTypeId: resolvedQueueTypeId,
      isRecyclable,
      hashTagPresetId,
    });

    return redirect("/dashboard/scheduled");
  }
}

/**
 * Handle upload preview action
 */
function handleUploadPreview(
  formData: FormData,
): { success: boolean; fileUrls?: string[]; error?: string } {
  const files = formData.getAll("files");
  const scheduledFor = formData.get("scheduledFor");
  const caption = formData.get("caption");
  const queueType = formData.get("queueType");

  // Validate files are not empty and are valid URLs
  const hasValidFiles = files.some((file) => {
    try {
      new URL(file as string); // Check if valid URL
      return true;
    } catch {
      return false;
    }
  });

  if (!hasValidFiles) {
    return {
      success: false,
      error: "Upload failed, please try again",
    };
  }

  const fileUrls: {
    fileUrl: string;
    scheduledFor: string | null;
    caption: string | null;
    queueType: string | null;
  }[] = files.map((fileUrl) => ({
    fileUrl: String(fileUrl),
    scheduledFor: scheduledFor ? String(scheduledFor) : null,
    caption: caption ? String(caption) : null,
    queueType: queueType ? String(queueType) : null,
  }));

  return { success: true, fileUrls: fileUrls.map((f) => f.fileUrl) };
}

/**
 * Handle post images/media action
 */
async function handlePostImages(
  userId: string,
  formData: FormData,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  queueType: string,
  queueTypeId: string | null,
  isRecyclable: boolean,
  hashTagPresetId: string | null,
  sanitizedRelays: string[],
): Promise<Response> {
  const signedEventRaw = JSON.parse(formData.get("signedEvent") as string) as SignedEvent;
  const nostrEventRaw = JSON.parse(formData.get("nostrEvent") as string) as import("~/features/nostr/types").NostrEvent;
  const signedEvent = signedEventRaw;
  const nostrEvent = nostrEventRaw;
  const fileUrl = formData.get("fileUrl") as string;
  const caption = formData.get("caption") as string;

  const isVideo = isVideoFile(fileUrl);

  // Resolve queue type ID in feature layer (business logic)
  const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);

  const post = await createPost({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    postedAt: new Date(),
    isScheduled: false,
    isPosted: true,
    fileUrl: JSON.parse(fileUrl) as string[],
    scheduledFor: String(signedEvent.created_at),
    nostrEventId: signedEvent.id,
    nostrEvent,
    signedEvent,
    postType: isVideo ? "VIDEO" : "IMAGE",
    tags: [],
    queueTypeId: resolvedQueueTypeId,
    isRecyclable,
    hashTagPresetId,
  });

  await publishToNostr(sanitizedRelays, post.signedEvent as unknown as SignedEvent);

  return redirect("/dashboard/posted");
}

/**
 * Handle schedule images/media action
 */
async function handleScheduleImages(
  userId: string,
  formData: FormData,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  queueType: string,
  queueTypeId: string | null,
  isRecyclable: boolean,
  hashTagPresetId: string | null,
): Promise<Response> {
  const signedEvent = JSON.parse(formData.get("signedEvent") as string) as SignedEvent;
  const nostrEvent = JSON.parse(formData.get("nostrEvent") as string) as import("~/features/nostr/types").NostrEvent;
  const fileUrl = formData.get("fileUrl") as string;
  const caption = formData.get("caption") as string;

  const isVideo = isVideoFile(fileUrl);

  // Resolve queue type ID in feature layer (business logic)
  const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);

  await createPost({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: JSON.parse(fileUrl) as string[],
    scheduledFor: String(signedEvent.created_at),
    isScheduled: true,
    isPosted: false,
    signedEvent: signedEvent,
    nostrEvent: nostrEvent,
    postType: isVideo ? "VIDEO" : "IMAGE",
    tags: [],
    queueTypeId: resolvedQueueTypeId,
    isRecyclable,
    hashTagPresetId,
  });

  return redirect("/dashboard/scheduled");
}

/**
 * Handle draft images/media action
 */
async function handleDraftImages(
  userId: string,
  formData: FormData,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  queueType: string,
  queueTypeId: string | null,
  isRecyclable: boolean,
  hashTagPresetId: string | null,
): Promise<Response> {
  const fileUrl = formData.get("fileUrl") as string;
  const caption = formData.get("caption") as string;

  // Infer media type from URL extension for drafts
  let postType: "IMAGE" | "VIDEO" = "IMAGE"; // default
  if (fileUrl) {
    const isVideo = isVideoFile(fileUrl);
    postType = isVideo ? "VIDEO" : "IMAGE";
  }

  // Resolve queue type ID in feature layer (business logic)
  const resolvedQueueTypeId = await resolveQueueTypeId(userId, queueTypeId, queueType);

  await createPost({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: JSON.parse(fileUrl) as string[],
    isScheduled: false,
    isPosted: false,
    postType,
    tags: [],
    queueTypeId: resolvedQueueTypeId,
    draft: true,
    isRecyclable,
    hashTagPresetId,
  });

  return redirect("/dashboard/drafts");
}

/**
 * Main action handler for new post page
 */
export async function handleNewPostAction(
  userId: string,
  request: Request,
): Promise<Response> {
  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const { userRelays, showHashTagsinPosts } = user;
  const sanitizedRelays = userRelays.map((relay: string) => relay.trim());

  // Check content type before parsing
  const contentType = request.headers.get("Content-Type") || "";

  let formData: FormData;
  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = composeUploadHandlers(
      createUploadHandler(userId),
      createMemoryUploadHandler(),
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  const _action = formData.get("_action") as string;
  const caption = formData.get("caption") as string;
  const scheduledFor = formData.get("scheduledFor");
  const queueType = (formData.get("queueType") as string) || "unassigned";
  const queueTypeId = (formData.get("queueTypeId") as string) || null;
  const isRecyclable = formData.get("isRecyclable") === "on";
  const useHashtagPresets = formData.get("useHashtagPresets") === "on";
  const manualHashTagPresetId = useHashtagPresets
    ? ((formData.get("hashTagPresetId") as string) || null)
    : null;

  // Get hashtag preset tags
  const { tags: hashTagPresetTags, presetId: hashTagPresetId } =
    await getHashtagPresetTags(
      userId,
      useHashtagPresets,
      manualHashTagPresetId,
      queueType,
      queueTypeId,
    );

  // Handle different actions
  if (_action === "draft-text") {
    return handleDraftText(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
    );
  }

  if (_action === "post-text" || _action === "schedule-text") {
    return handlePostOrScheduleText(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
      sanitizedRelays,
      _action,
    );
  }

  if (
    _action === "upload-images-preview" ||
    _action === "upload-media-preview"
  ) {
    const result = handleUploadPreview(formData);
    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return Response.json({ success: true, fileUrls: result.fileUrls });
  }

  if (_action === "post-images" || _action === "post-media") {
    return handlePostImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
      sanitizedRelays,
    );
  }

  if (_action === "schedule-images" || _action === "schedule-media") {
    return handleScheduleImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
    );
  }

  if (_action === "draft-images" || _action === "draft-media") {
    return handleDraftImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
    );
  }

  return Response.json({ success: false });
}

