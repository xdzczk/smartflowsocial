/**
 * Media post action handlers
 * Handles draft, post, and schedule actions for image/video posts
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { PublishNowUseCase } from "~/features/posts/server";
import { assertMediaUrlsReady } from "~/features/upload/services/media-readiness.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../../use-cases/create-post.use-case.server";
import { applyHashtags } from "../hashtag-utils.server";
import { isVideoFile } from "../media-utils.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

function parseRepostSchedulesFromForm(formData: FormData): Array<{
  scheduledFor: number;
  signedEvent: SignedEvent;
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
}> {
  const repostSchedulesStr = formData.get("repostSchedules");
  const alsoScheduleRepost = formData.get("alsoScheduleRepost") === "on";
  const repostScheduledForStr = formData.get("repostScheduledFor");
  const repostSignedEventStr = formData.get("repostSignedEvent");
  let list: Array<{
    scheduledFor: number;
    signedEvent: SignedEvent;
    minReactions?: number;
    minZaps?: number;
    minComments?: number;
    minReposts?: number;
    minSats?: number;
  }> = [];
  if (repostSchedulesStr && typeof repostSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(repostSchedulesStr) as Array<{
        scheduledFor: number;
        signedEvent: SignedEvent;
        minReactions?: number;
        minZaps?: number;
        minComments?: number;
        minReposts?: number;
        minSats?: number;
      }>;
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (p) =>
            typeof p.scheduledFor === "number" &&
            typeof p.signedEvent === "object"
        );
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    alsoScheduleRepost &&
    repostScheduledForStr &&
    repostSignedEventStr
  ) {
    const repostScheduledFor = parseInt(String(repostScheduledForStr), 10);
    if (!Number.isNaN(repostScheduledFor)) {
      try {
        const repostSignedEvent = JSON.parse(
          String(repostSignedEventStr)
        ) as SignedEvent;
        list = [
          { scheduledFor: repostScheduledFor, signedEvent: repostSignedEvent },
        ];
      } catch {
        // keep empty
      }
    }
  }
  return list;
}

function parseQuoteSchedulesFromForm(formData: FormData): Array<{
  scheduledFor: number;
  signedEvent: SignedEvent;
  caption?: string;
}> {
  const quoteSchedulesStr = formData.get("quoteSchedules");
  const alsoScheduleQuote = formData.get("alsoScheduleQuote") === "on";
  const quoteScheduledForStr = formData.get("quoteScheduledFor");
  const quoteSignedEventStr = formData.get("quoteSignedEvent");
  const quoteCaption = formData.get("quoteCaption");
  let list: Array<{
    scheduledFor: number;
    signedEvent: SignedEvent;
    caption?: string;
  }> = [];
  if (quoteSchedulesStr && typeof quoteSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(quoteSchedulesStr) as Array<{
        scheduledFor: number;
        signedEvent: SignedEvent;
        caption?: string;
      }>;
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (p) =>
            typeof p.scheduledFor === "number" &&
            typeof p.signedEvent === "object"
        );
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    alsoScheduleQuote &&
    quoteScheduledForStr &&
    quoteSignedEventStr
  ) {
    const quoteScheduledFor = parseInt(String(quoteScheduledForStr), 10);
    if (!Number.isNaN(quoteScheduledFor)) {
      try {
        const quoteSignedEvent = JSON.parse(
          String(quoteSignedEventStr)
        ) as SignedEvent;
        list = [
          {
            scheduledFor: quoteScheduledFor,
            signedEvent: quoteSignedEvent,
            caption: quoteCaption ? String(quoteCaption) : undefined,
          },
        ];
      } catch {
        // keep empty
      }
    }
  }
  return list;
}

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
  await assertMediaUrlsReady(fileUrlArray);
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

  // Stay on current page and show modal there
  return redirect(`/dashboard/newpost?published=${result.post.id}`);
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
  await assertMediaUrlsReady(fileUrlArray);
  const isVideo = isVideoFile(fileUrlArray);

  const repostSchedulesRaw = parseRepostSchedulesFromForm(formData);
  const repostSchedules =
    repostSchedulesRaw.length > 0
      ? repostSchedulesRaw.map((item) => {
          const conditions: {
            minReactions?: number;
            minZaps?: number;
            minComments?: number;
            minReposts?: number;
            minSats?: number;
          } = {};
          if (item.minReactions != null && item.minReactions >= 0)
            conditions.minReactions = item.minReactions;
          if (item.minZaps != null && item.minZaps >= 0)
            conditions.minZaps = item.minZaps;
          if (item.minComments != null && item.minComments >= 0)
            conditions.minComments = item.minComments;
          if (item.minReposts != null && item.minReposts >= 0)
            conditions.minReposts = item.minReposts;
          if (item.minSats != null && item.minSats >= 0)
            conditions.minSats = item.minSats;
          return {
            scheduledFor: item.scheduledFor,
            signedEvent: item.signedEvent,
            ...(Object.keys(conditions).length > 0 && {
              repostConditions: conditions,
            }),
          };
        })
      : undefined;
  const quoteSchedules = parseQuoteSchedulesFromForm(formData);

  const nominalScheduledForRaw = formData.get("nominalScheduledFor");
  const nominalScheduledFor =
    nominalScheduledForRaw != null &&
    String(nominalScheduledForRaw).trim() !== ""
      ? parseInt(String(nominalScheduledForRaw), 10)
      : undefined;

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
    nominalScheduledFor: Number.isFinite(nominalScheduledFor)
      ? nominalScheduledFor
      : undefined,
    hashTagPresetTags,
    showHashTagsinPosts,
    correlationId,
    repostSchedules,
    quoteSchedules: quoteSchedules.length > 0 ? quoteSchedules : undefined,
  });

  // Stay on current page and show modal there
  return redirect(`/dashboard/newpost?scheduled=${result.post.id}`);
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
  await assertMediaUrlsReady(fileUrlArray);

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
