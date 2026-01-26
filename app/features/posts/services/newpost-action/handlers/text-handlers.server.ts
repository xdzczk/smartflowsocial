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

    return redirect(`/dashboard/posted?published=${result.post.id}`);
  } else {
    // schedule-text - post will be scheduled via outbox pattern
    return redirect(`/dashboard/scheduled?scheduled=${result.post.id}`);
  }
}
