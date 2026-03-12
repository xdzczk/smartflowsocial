/**
 * Text post action handlers
 * Handles draft, post, and schedule actions for text posts
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { PublishNowUseCase } from "~/features/posts/server/publishing";
import { assertMediaUrlsReady } from "~/features/upload/services/media-readiness.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../../use-cases/create-post.use-case.server";
import { applyHashtags } from "../hashtag-utils.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

interface RepostScheduleItem {
  scheduledFor: number;
  signedEvent: SignedEvent;
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
}
interface QuoteScheduleItem {
  scheduledFor: number;
  signedEvent: SignedEvent;
  caption?: string;
}

function parseRepostSchedulesFromForm(
  formData: FormData
): RepostScheduleItem[] {
  const repostSchedulesStr = formData.get("repostSchedules");
  const alsoScheduleRepost = formData.get("alsoScheduleRepost") === "on";
  const repostScheduledForStr = formData.get("repostScheduledFor");
  const repostSignedEventStr = formData.get("repostSignedEvent");
  let list: RepostScheduleItem[] = [];
  if (repostSchedulesStr && typeof repostSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(repostSchedulesStr) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed
          .filter(
            (p): p is RepostScheduleItem =>
              typeof p === "object" &&
              p !== null &&
              "scheduledFor" in p &&
              "signedEvent" in p &&
              typeof (p as RepostScheduleItem).scheduledFor === "number" &&
              typeof (p as RepostScheduleItem).signedEvent === "object"
          )
          .map((p) => ({
            scheduledFor: p.scheduledFor,
            signedEvent: p.signedEvent,
            ...(p.minReactions != null && { minReactions: p.minReactions }),
            ...(p.minZaps != null && { minZaps: p.minZaps }),
            ...(p.minComments != null && { minComments: p.minComments }),
            ...(p.minReposts != null && { minReposts: p.minReposts }),
            ...(p.minSats != null && { minSats: p.minSats }),
          }));
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

function parseQuoteSchedulesFromForm(formData: FormData): QuoteScheduleItem[] {
  const quoteSchedulesStr = formData.get("quoteSchedules");
  const alsoScheduleQuote = formData.get("alsoScheduleQuote") === "on";
  const quoteScheduledForStr = formData.get("quoteScheduledFor");
  const quoteSignedEventStr = formData.get("quoteSignedEvent");
  const quoteCaption = formData.get("quoteCaption");
  let list: QuoteScheduleItem[] = [];
  if (quoteSchedulesStr && typeof quoteSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(quoteSchedulesStr) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (p): p is QuoteScheduleItem =>
            typeof p === "object" &&
            p !== null &&
            "scheduledFor" in p &&
            "signedEvent" in p &&
            typeof (p as QuoteScheduleItem).scheduledFor === "number" &&
            typeof (p as QuoteScheduleItem).signedEvent === "object"
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

export function parseAttachmentMeta(
  formData: FormData
): Array<{ localId: string; url?: string }> {
  const raw = formData.get("attachmentMeta");
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is { localId: string; url?: string } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { localId: unknown }).localId === "string"
    );
  } catch {
    return [];
  }
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
  let content = contentValue ? String(contentValue) : "";
  let fileUrl: string[] = [];

  const attachmentMeta = parseAttachmentMeta(formData);
  if (attachmentMeta.length > 0) {
    const { resolveContentWithTokens } =
      await import("../inline-tokens.server");
    const resolved = resolveContentWithTokens(content, attachmentMeta);
    content = resolved.content;
    fileUrl = resolved.fileUrl;
  }
  await assertMediaUrlsReady(fileUrl);

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
    fileUrl,
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

  let content = contentValue ? String(contentValue) : "";
  let fileUrl: string[] = [];

  const attachmentMeta = parseAttachmentMeta(formData);
  if (attachmentMeta.length > 0) {
    const { resolveContentWithTokens } =
      await import("../inline-tokens.server");
    const resolved = resolveContentWithTokens(content, attachmentMeta);
    content = resolved.content;
    fileUrl = resolved.fileUrl;
  }
  await assertMediaUrlsReady(fileUrl);

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

  // Use CreatePostUseCase for post creation (handles queue type resolution internally)
  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content: contentWithHashtags,
    caption: contentWithHashtags,
    fileUrl,
    postType: "TEXT",
    queueTypeId, // Pass raw queueTypeId - use case will resolve if needed
    queueType, // Pass queue type name for resolution
    hashTagPresetId,
    isRecyclable,
    signedEvent,
    nostrEvent,
    scheduledFor:
      action === "schedule-text" ? signedEventJson.created_at : undefined,
    nominalScheduledFor:
      action === "schedule-text" && Number.isFinite(nominalScheduledFor)
        ? nominalScheduledFor
        : undefined,
    hashTagPresetTags,
    showHashTagsinPosts,
    repostSchedules,
    quoteSchedules: quoteSchedules.length > 0 ? quoteSchedules : undefined,
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
