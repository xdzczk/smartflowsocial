/**
 * Base handler for post actions
 * Provides common functionality for all post handlers
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import { CreatePostUseCase } from "../../../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../../../use-cases/publish-now.use-case.server";
import { applyHashtags } from "../hashtag-utils.server";

export interface PostHandlerContext {
  userId: string;
  hashTagPresetTags: string;
  showHashTagsinPosts: boolean;
  queueType: string;
  queueTypeId: string | null;
  isRecyclable: boolean;
  hashTagPresetId: string | null;
  sanitizedRelays: string[];
  correlationId?: string;
}

export interface PostHandlerInput {
  content: string;
  fileUrls: string[];
  postType: "TEXT" | "IMAGE" | "CAROUSEL" | "VIDEO";
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  scheduledFor?: number; // Unix timestamp
}

export type PostAction = "draft" | "post" | "schedule";

export interface PostHandlerResult {
  redirect: string;
}

/**
 * Base handler for creating posts
 */
export async function handlePostCreation(
  input: PostHandlerInput,
  context: PostHandlerContext,
  action: PostAction
): Promise<PostHandlerResult> {
  // Apply hashtags to content
  const contentWithHashtags = applyHashtags(
    input.content,
    context.hashTagPresetTags,
    context.showHashTagsinPosts
  );

  // Create post using use case
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId: context.userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl: input.fileUrls,
    postType: input.postType,
    queueTypeId: context.queueTypeId,
    queueType: context.queueType,
    hashTagPresetId: context.hashTagPresetId,
    isRecyclable: context.isRecyclable,
    signedEvent: input.signedEvent,
    nostrEvent: input.nostrEvent,
    scheduledFor: input.scheduledFor,
    hashTagPresetTags: context.hashTagPresetTags,
    showHashTagsinPosts: context.showHashTagsinPosts,
    correlationId: context.correlationId,
  });

  // Handle different actions
  if (action === "draft") {
    return { redirect: "/dashboard/drafts" };
  }

  if (action === "post") {
    // Publish immediately
    // Validate cryptographically (structure + signature) before publishing
    // Even though we validated at input, we validate again when reading from DB
    const validatedSignedEvent = validateSignedEventCryptographically(
      result.post.signedEvent
    );

    const publishUseCase = new PublishNowUseCase();
    await publishUseCase.execute({
      postId: result.post.id,
      userId: context.userId,
      signedEvent: validatedSignedEvent,
      relays: context.sanitizedRelays,
      correlationId: context.correlationId,
    });

    // Stay on current page and show modal there
    return { redirect: `/dashboard/newpost?published=${result.post.id}` };
  }

  // schedule - post will be scheduled via outbox pattern
  // Stay on current page and show modal there
  return { redirect: `/dashboard/newpost?scheduled=${result.post.id}` };
}
