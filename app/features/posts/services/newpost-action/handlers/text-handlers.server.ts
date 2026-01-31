/**
 * Text post action handlers
 * Handles draft, post, and schedule actions for text posts
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../../../use-cases/publish-now.use-case.server";
import { applyHashtags } from "../hashtag-utils.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

interface TextHandlerParams {
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
  action?: "post-text" | "schedule-text";
  correlationId?: string;
}

/**
 * Handle draft text post action
 */
export async function handleDraftText({
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
}: TextHandlerParams): Promise<Response> {
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
export async function handlePostOrScheduleText({
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
  action = "post-text",
  correlationId,
}: TextHandlerParams): Promise<Response> {
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

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEvent.pubkey,
    context: { feature: "newpost", action },
  });

  // Apply hashtags
  const contentWithHashtags = applyHashtags(
    content,
    hashTagPresetTags,
    showHashTagsinPosts
  );

  const alsoScheduleRepost = formData.get("alsoScheduleRepost") === "on";
  const repostScheduledForStr = formData.get("repostScheduledFor");
  const repostSignedEventStr = formData.get("repostSignedEvent");
  const alsoScheduleQuote = formData.get("alsoScheduleQuote") === "on";
  const quoteScheduledForStr = formData.get("quoteScheduledFor");
  const quoteSignedEventStr = formData.get("quoteSignedEvent");
  const quoteCaption = formData.get("quoteCaption");

  let repostScheduledFor: number | undefined;
  let repostSignedEvent: SignedEvent | undefined;
  if (alsoScheduleRepost && repostScheduledForStr && repostSignedEventStr) {
    repostScheduledFor = parseInt(String(repostScheduledForStr), 10);
    if (!Number.isNaN(repostScheduledFor)) {
      try {
        repostSignedEvent = JSON.parse(
          String(repostSignedEventStr)
        ) as SignedEvent;
      } catch {
        repostSignedEvent = undefined;
      }
    }
  }

  let quoteScheduledFor: number | undefined;
  let quoteSignedEvent: SignedEvent | undefined;
  if (alsoScheduleQuote && quoteScheduledForStr && quoteSignedEventStr) {
    quoteScheduledFor = parseInt(String(quoteScheduledForStr), 10);
    if (!Number.isNaN(quoteScheduledFor)) {
      try {
        quoteSignedEvent = JSON.parse(
          String(quoteSignedEventStr)
        ) as SignedEvent;
      } catch {
        quoteSignedEvent = undefined;
      }
    }
  }

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
    alsoScheduleRepost: alsoScheduleRepost && !!repostSignedEvent,
    repostScheduledFor,
    repostSignedEvent,
    alsoScheduleQuote: alsoScheduleQuote && !!quoteSignedEvent,
    quoteScheduledFor,
    quoteSignedEvent,
    quoteCaption: quoteCaption ? String(quoteCaption) : undefined,
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

    // Stay on current page and show modal there
    return redirect(`/dashboard/newpost?published=${result.post.id}`);
  } else {
    // schedule-text - post will be scheduled via outbox pattern
    // Stay on current page and show modal there
    return redirect(`/dashboard/newpost?scheduled=${result.post.id}`);
  }
}
