/**
 * New post action handlers
 * Centralized action processing for new post page
 */

import {
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { createUploadHandler } from "~/features/upload/s3.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
} from "~/features/user";
import { env } from "~/lib/env.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import {
  newPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../use-cases/publish-now.use-case.server";
import { resolveQueueTypeId } from "./queue-type-resolver.server";
import { extractCorrelationId } from "~/lib/correlation-context.server";
import { getNostrPublisher } from "~/infra/publishers/nostr-publisher.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

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
    const urls =
      typeof fileUrl === "string" ? (JSON.parse(fileUrl) as string[]) : fileUrl;
    if (Array.isArray(urls) && urls.length > 0) {
      const firstUrl = urls[0];
      if (!firstUrl) return false;
      const lower = firstUrl.toLowerCase();
      return videoExtensions.some((ext) => lower.includes(ext));
    }
  } catch (_e) {
    // If parsing fails, try direct string
    const fileUrlStr =
      typeof fileUrl === "string" ? fileUrl : (fileUrl[0] ?? "");
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
  queueTypeId: string | null
): Promise<{ tags: string; presetId: string | null }> {
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets && manualHashTagPresetId) {
    // Use manually selected hashtag preset
    const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
    hashTagPresetTags =
      preset &&
      typeof preset === "object" &&
      "tags" in preset &&
      typeof preset.tags === "string"
        ? preset.tags
        : "";
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

    if (
      selectedQueueType &&
      typeof selectedQueueType === "object" &&
      "hashTagPreset" in selectedQueueType &&
      selectedQueueType.hashTagPreset
    ) {
      const preset = selectedQueueType.hashTagPreset;
      if (
        typeof preset === "object" &&
        "tags" in preset &&
        typeof preset.tags === "string"
      ) {
        hashTagPresetTags = preset.tags;
      }
      if (
        typeof preset === "object" &&
        "id" in preset &&
        typeof preset.id === "string"
      ) {
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
  showHashTagsinPosts: boolean
): string {
  return showHashTagsinPosts && hashTagPresetTags
    ? `${content}\n${hashTagPresetTags}`
    : content;
}

/**
 * Publish event to Nostr publisher
 * @deprecated Use getNostrPublisher().publish() instead
 */
async function publishToNostr(
  relays: string[],
  signedEvent: SignedEvent
): Promise<void> {
  const publisher = getNostrPublisher();
  await publisher.publish(signedEvent, relays);
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
  correlationId?: string
): Promise<Response> {
  const contentValue = formData.get("content");
  const content = contentValue ? String(contentValue) : "";

  // Apply hashtags
  const contentWithHashtags = applyHashtags(
    content,
    hashTagPresetTags,
    showHashTagsinPosts
  );

  // Use CreatePostUseCase for draft creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  await createPostUseCase.execute({
    userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl: [],
    postType: "TEXT",
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    hashTagPresetTags,
    showHashTagsinPosts,
    correlationId,
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
  correlationId?: string
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
    throw new Error(ERROR_INVALID_SIGNED_EVENT_FORMAT);
  }

  const signedEvent: SignedEvent = signedEventRaw;
  const nostrEvent: NostrEvent = nostrEventRaw;
  const signedEventJson = signedEvent;

  // Apply hashtags
  const contentWithHashtags = applyHashtags(
    content,
    hashTagPresetTags,
    showHashTagsinPosts
  );

  // Use CreatePostUseCase for post creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl: [],
    postType: "TEXT",
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    signedEvent,
    nostrEvent,
    scheduledFor:
      action === "schedule-text" ? signedEventJson.created_at : undefined,
    hashTagPresetTags,
    showHashTagsinPosts,
  });

  if (action === "post-text") {
    // Publish immediately using PublishNowUseCase
    const validatedSignedEvent = validateSignedEvent(result.post.signedEvent);
    if (!validatedSignedEvent) {
      throw new Error("Invalid signedEvent after post creation");
    }

    const publishUseCase = new PublishNowUseCase();
    await publishUseCase.execute({
      postId: result.post.id,
      userId,
      signedEvent: validatedSignedEvent,
      relays: sanitizedRelays,
      correlationId,
    });

    return redirect("/dashboard/posted");
  } else {
    // schedule-text - post will be scheduled via outbox pattern
    return redirect("/dashboard/scheduled");
  }
}

/**
 * Handle upload preview action
 */
function handleUploadPreview(formData: FormData): {
  success: boolean;
  fileUrls?: string[];
  error?: string;
} {
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
      const fileStr =
        typeof file === "string"
          ? file
          : file instanceof File
            ? file.name
            : String(file);
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

  const fileUrls: Array<{
    fileUrl: string;
    scheduledFor: string | null;
    caption: string | null;
    queueType: string | null;
  }> = files.map((fileUrl) => {
    const fileUrlStr =
      typeof fileUrl === "string"
        ? fileUrl
        : fileUrl instanceof File
          ? fileUrl.name
          : String(fileUrl);
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
  correlationId?: string
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
    throw new Error(ERROR_INVALID_SIGNED_EVENT_FORMAT);
  }

  const signedEvent: SignedEvent = signedEventRaw;
  const nostrEvent: NostrEvent = nostrEventRaw;

  const isVideo = isVideoFile(fileUrl);

  // Use CreatePostUseCase for post creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: JSON.parse(fileUrl) as string[],
    postType: isVideo ? "VIDEO" : "IMAGE",
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    signedEvent,
    nostrEvent,
    hashTagPresetTags,
    showHashTagsinPosts,
    correlationId,
  });

  // Publish immediately using PublishNowUseCase
  const validatedSignedEvent = validateSignedEvent(result.post.signedEvent);
  if (!validatedSignedEvent) {
    throw new Error("Invalid signedEvent after post creation");
  }

  const publishUseCase = new PublishNowUseCase();
  await publishUseCase.execute({
    postId: result.post.id,
    userId,
    signedEvent: validatedSignedEvent,
    relays: sanitizedRelays,
    correlationId,
  });

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
  correlationId?: string
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
    throw new Error(ERROR_INVALID_SIGNED_EVENT_FORMAT);
  }

  const isVideo = isVideoFile(fileUrl);

  // Use CreatePostUseCase for post creation with scheduling (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: JSON.parse(fileUrl) as string[],
    postType: isVideo ? "VIDEO" : "IMAGE",
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    signedEvent: signedEvent,
    nostrEvent: nostrEvent,
    scheduledFor: signedEvent.created_at,
    hashTagPresetTags,
    showHashTagsinPosts,
    correlationId,
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
  correlationId?: string
): Promise<Response> {
  const fileUrl = formData.get("fileUrl") as string;
  const caption = formData.get("caption") as string;

  // Infer media type from URL extension for drafts
  let postType: "IMAGE" | "VIDEO" = "IMAGE"; // default
  if (fileUrl) {
    const isVideo = isVideoFile(fileUrl);
    postType = isVideo ? "VIDEO" : "IMAGE";
  }

  // Use CreatePostUseCase for draft creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: JSON.parse(fileUrl) as string[],
    postType,
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    hashTagPresetTags,
    showHashTagsinPosts,
    correlationId,
    // No scheduledFor = draft
  });

  return redirect("/dashboard/drafts");
}

/**
 * Main action handler for new post page
 */
export async function handleNewPostAction(
  userId: string,
  request: Request
): Promise<Response> {
  // Extract correlation ID from request headers
  const correlationId = extractCorrelationId(request.headers);

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
      createMemoryUploadHandler()
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Check for upload preview actions first (they don't need full validation)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  if (
    _action === "upload-images-preview" ||
    _action === "upload-media-preview"
  ) {
    const result = handleUploadPreview(formData);
    if (!result.success) {
      return Response.json(
        { error: result.error ?? "Upload preview failed" },
        { status: 400 }
      );
    }
    return Response.json(result);
  }

  // Validate non-file fields with Zod for other actions
  // Note: File uploads are handled separately by parseMultipartFormData
  const result = validateFormDataOrRespond(formData, newPostActionSchema);
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;
  const _caption = validatedData.caption || "";
  const _scheduledFor = validatedData.scheduledFor;
  const queueType = validatedData.queueType || "unassigned";
  const queueTypeId = validatedData.queueTypeId;
  const isRecyclable = validatedData.isRecyclable ?? false;
  const useHashtagPresets = validatedData.useHashtagPresets ?? false;
  const manualHashTagPresetId = useHashtagPresets
    ? validatedData.hashTagPresetId
    : null;

  // Get hashtag preset tags
  const hashtagResult = await getHashtagPresetTags(
    userId,
    useHashtagPresets,
    manualHashTagPresetId,
    queueType,
    queueTypeId
  );
  const hashTagPresetTags =
    typeof hashtagResult === "object" &&
    !Array.isArray(hashtagResult) &&
    "tags" in hashtagResult &&
    typeof hashtagResult.tags === "string"
      ? hashtagResult.tags
      : "";
  const hashTagPresetId =
    typeof hashtagResult === "object" &&
    !Array.isArray(hashtagResult) &&
    "presetId" in hashtagResult
      ? hashtagResult.presetId
      : manualHashTagPresetId;

  // Handle different actions
  // Note: Handlers still read from formData for backward compatibility
  // but validation ensures data structure is correct
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
      correlationId
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
      _action
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
        { status: 400 }
      );
    }
    return Response.json({ success: true, fileUrls: result.fileUrls });
  }

  if (
    _action === "post-image" ||
    _action === "post-images" ||
    _action === "post-media"
  ) {
    return handlePostImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
      sanitizedRelays
    );
  }

  if (
    _action === "schedule-image" ||
    _action === "schedule-images" ||
    _action === "schedule-media"
  ) {
    return handleScheduleImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId
    );
  }

  if (
    _action === "draft-image" ||
    _action === "draft-images" ||
    _action === "draft-media"
  ) {
    return handleDraftImages(
      userId,
      formData,
      hashTagPresetTags,
      showHashTagsinPosts,
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId
    );
  }

  return Response.json({ success: false });
}
