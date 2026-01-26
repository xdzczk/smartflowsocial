/**
 * Media post action handlers
 * Handles draft, post, and schedule actions for image/video posts
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../../../use-cases/publish-now.use-case.server";
import { applyHashtags } from "../hashtag-utils.server";
import { isVideoFile } from "../media-utils.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

interface MediaHandlerParams {
  userId: string;
  sessionPubkey: string;
  formData: FormData;
  hashTagPresetTags: string;
  showHashTagsinPosts: boolean;
  queueType: string;
  queueTypeId: string | null;
  isRecyclable: boolean;
  hashTagPresetId: string | null;
  sanitizedRelays?: string[];
  correlationId?: string;
}

/**
 * Handle post images/media action
 */
export async function handlePostImages({
  userId,
  sessionPubkey,
  formData,
  hashTagPresetTags,
  showHashTagsinPosts,
  queueType,
  queueTypeId,
  isRecyclable,
  hashTagPresetId,
  sanitizedRelays = [],
  correlationId,
}: MediaHandlerParams): Promise<Response> {
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

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEvent.pubkey,
    context: { feature: "newpost", action: "post-images" },
  });

  // Parse fileUrl JSON string to array for video detection
  const fileUrlArray = fileUrl ? (JSON.parse(fileUrl) as string[]) : [];
  const isVideo = isVideoFile(fileUrlArray);

  // Use CreatePostUseCase for post creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: fileUrlArray,
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

  return redirect(`/dashboard/posted?published=${result.post.id}`);
}

/**
 * Handle schedule images/media action
 */
export async function handleScheduleImages({
  userId,
  sessionPubkey,
  formData,
  hashTagPresetTags,
  showHashTagsinPosts,
  queueType,
  queueTypeId,
  isRecyclable,
  hashTagPresetId,
  correlationId,
}: MediaHandlerParams): Promise<Response> {
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

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEvent.pubkey,
    context: { feature: "newpost", action: "schedule-images" },
  });

  // Parse fileUrl JSON string to array for video detection
  const fileUrlArray = fileUrl ? (JSON.parse(fileUrl) as string[]) : [];
  const isVideo = isVideoFile(fileUrlArray);

  // Use CreatePostUseCase for post creation with scheduling (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: fileUrlArray,
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

  return redirect(`/dashboard/scheduled?scheduled=${result.post.id}`);
}

/**
 * Handle draft images/media action
 */
export async function handleDraftImages({
  userId,
  sessionPubkey: _sessionPubkey,
  formData,
  hashTagPresetTags,
  showHashTagsinPosts,
  queueType,
  queueTypeId,
  isRecyclable,
  hashTagPresetId,
  correlationId,
}: MediaHandlerParams): Promise<Response> {
  const fileUrlValue = formData.get("fileUrl");
  const fileUrl = fileUrlValue ? String(fileUrlValue) : "";
  const caption = formData.get("caption") as string;

  // Parse fileUrl JSON string to array for video detection
  const fileUrlArray = fileUrl ? (JSON.parse(fileUrl) as string[]) : [];

  // Infer media type from URL extension for drafts
  let postType: "IMAGE" | "VIDEO" = "IMAGE"; // default
  if (fileUrlArray.length > 0) {
    const isVideo = isVideoFile(fileUrlArray);
    postType = isVideo ? "VIDEO" : "IMAGE";
  }

  // Use CreatePostUseCase for draft creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  await createPostUseCase.execute({
    userId,
    content: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    caption: applyHashtags(caption, hashTagPresetTags, showHashTagsinPosts),
    fileUrl: fileUrlArray,
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
