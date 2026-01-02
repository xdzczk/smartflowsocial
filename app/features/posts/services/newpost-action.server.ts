/**
 * New post action handlers
 * Centralized action processing for new post page
 */

import { redirect ,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { createUploadHandler } from "~/features/upload/s3.server";
import { env } from "~/lib/env.server";
import { fetchWithRetry } from "~/lib/fetch.server";
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
  } catch (_e) {
    // If parsing fails, try direct string
    const fileUrlStr = typeof fileUrl === "string" ? fileUrl : fileUrl[0] ?? "";
    const lower = fileUrlStr.toLowerCase();
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
    hashTagPresetTags = (preset && typeof preset === "object" && "tags" in preset && typeof preset.tags === "string") ? preset.tags : "";
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

    if (selectedQueueType && typeof selectedQueueType === "object" && "hashTagPreset" in selectedQueueType && selectedQueueType.hashTagPreset) {
      const preset = selectedQueueType.hashTagPreset;
      if (preset && typeof preset === "object" && "tags" in preset && typeof preset.tags === "string") {
        hashTagPresetTags = preset.tags ?? "";
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
  const response = await fetchWithRetry(env.NOSTR_PUBLISHER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      relays,
      event: signedEvent,
    }),
    timeout: 15000, // 15 seconds for publishing
    maxRetries: 2,
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
  const contentValue = formData.get("content");
  const content = contentValue ? String(contentValue) : "";

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
  const contentValue = formData.get("content");
  const signedEventValue = formData.get("signedEvent");
  const nostrEventValue = formData.get("nostrEvent");
  
  const content = contentValue ? String(contentValue) : "";
  const signedEventStr = signedEventValue ? String(signedEventValue) : "";
  const nostrEventStr = nostrEventValue ? String(nostrEventValue) : "";
  
  let signedEventRaw: SignedEvent;
  let nostrEventRaw: NostrEvent;
  try {
    signedEventRaw = JSON.parse(signedEventStr) as SignedEvent;
    nostrEventRaw = JSON.parse(nostrEventStr) as NostrEvent;
  } catch {
    throw new Error("Invalid signedEvent or nostrEvent format");
  }
  
  const signedEvent: SignedEvent = signedEventRaw;
  const nostrEvent: NostrEvent = nostrEventRaw;
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
  const scheduledForValue = formData.get("scheduledFor");
  const captionValue = formData.get("caption");
  const queueTypeValue = formData.get("queueType");
  
  const scheduledFor = scheduledForValue ? String(scheduledForValue) : null;
  const caption = captionValue ? String(captionValue) : null;
  const queueType = queueTypeValue ? String(queueTypeValue) : null;

  // Validate files are not empty and are valid URLs
  const hasValidFiles = files.some((file) => {
    try {
      const fileStr = typeof file === "string" ? file : file instanceof File ? file.name : String(file);
      new URL(fileStr); // Check if valid URL
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
  }[] = files.map((fileUrl) => {
    const fileUrlStr = typeof fileUrl === "string" ? fileUrl : fileUrl instanceof File ? fileUrl.name : String(fileUrl);
    return {
      fileUrl: fileUrlStr,
      scheduledFor,
      caption,
      queueType,
    };
  });

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
  const signedEventValue = formData.get("signedEvent");
  const nostrEventValue = formData.get("nostrEvent");
  const fileUrlValue = formData.get("fileUrl");
  const captionValue = formData.get("caption");
  
  const signedEventStr = signedEventValue ? String(signedEventValue) : "";
  const nostrEventStr = nostrEventValue ? String(nostrEventValue) : "";
  const fileUrl = fileUrlValue ? String(fileUrlValue) : "";
  const caption = captionValue ? String(captionValue) : "";
  
  let signedEventRaw: SignedEvent;
  let nostrEventRaw: NostrEvent;
  try {
    signedEventRaw = JSON.parse(signedEventStr) as SignedEvent;
    nostrEventRaw = JSON.parse(nostrEventStr) as NostrEvent;
  } catch {
    throw new Error("Invalid signedEvent or nostrEvent format");
  }
  
  const signedEvent: SignedEvent = signedEventRaw;
  const nostrEvent: NostrEvent = nostrEventRaw;

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
  const signedEventValue = formData.get("signedEvent");
  const nostrEventValue = formData.get("nostrEvent");
  const fileUrlValue = formData.get("fileUrl");
  const captionValue = formData.get("caption");
  
  const signedEventStr = signedEventValue ? String(signedEventValue) : "";
  const nostrEventStr = nostrEventValue ? String(nostrEventValue) : "";
  const fileUrl = fileUrlValue ? String(fileUrlValue) : "";
  const caption = captionValue ? String(captionValue) : "";
  
  let signedEvent: SignedEvent;
  let nostrEvent: NostrEvent;
  try {
    signedEvent = JSON.parse(signedEventStr) as SignedEvent;
    nostrEvent = JSON.parse(nostrEventStr) as NostrEvent;
  } catch {
    throw new Error("Invalid signedEvent or nostrEvent format");
  }

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
  const contentType = request.headers.get("Content-Type") ?? "";

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

  const _actionValue = formData.get("_action");
  const captionValue = formData.get("caption");
  const scheduledForValue = formData.get("scheduledFor");
  
  const _action = _actionValue ? String(_actionValue) : "";
  const _caption = captionValue ? String(captionValue) : "";
  const _scheduledFor = scheduledForValue ? String(scheduledForValue) : null;
  const queueTypeValue = formData.get("queueType");
  const queueTypeIdValue = formData.get("queueTypeId");
  const isRecyclableValue = formData.get("isRecyclable");
  const useHashtagPresetsValue = formData.get("useHashtagPresets");
  const hashTagPresetIdValue = formData.get("hashTagPresetId");
  
  const queueType = (queueTypeValue ? String(queueTypeValue) : null) ?? "unassigned";
  const queueTypeId = queueTypeIdValue ? String(queueTypeIdValue) : null;
  const isRecyclable = isRecyclableValue === "on" || isRecyclableValue === "true";
  const useHashtagPresets = useHashtagPresetsValue === "on" || useHashtagPresetsValue === "true";
  const manualHashTagPresetId = useHashtagPresets && hashTagPresetIdValue
    ? String(hashTagPresetIdValue)
    : null;

  // Get hashtag preset tags
  const hashtagResult = await getHashtagPresetTags(
      userId,
      useHashtagPresets,
      manualHashTagPresetId,
      queueType,
      queueTypeId,
    );
  const hashTagPresetTags = typeof hashtagResult === "object" && hashtagResult !== null && "tags" in hashtagResult && typeof hashtagResult.tags === "string" ? hashtagResult.tags : "";
  const hashTagPresetId = typeof hashtagResult === "object" && hashtagResult !== null && "presetId" in hashtagResult ? (hashtagResult.presetId) : manualHashTagPresetId;

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

