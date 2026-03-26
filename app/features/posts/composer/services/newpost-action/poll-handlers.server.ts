/**
 * NIP-88 poll actions: post-poll, schedule-poll (kind 1068).
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { KIND_POLL, parsePollFromSignedEvent } from "~/features/polls";
import { PublishNowUseCase } from "~/features/posts/server/publishing";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";

import {
  isContestEmbedRequest,
  jsonContestEmbedPost,
} from "./contest-embed-response.server";
import { getHashtagPresetTags } from "./hashtag-preset-utils.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

export interface PollActionParams {
  userId: string;
  sessionPubkey: string;
  formData: FormData;
  sanitizedRelays: string[];
  action: "post-poll" | "schedule-poll";
  correlationId?: string;
  queueType: string;
  queueTypeId: string | null;
  isRecyclable: boolean;
  hashTagPresetId: string | null;
}

export async function handlePostOrSchedulePoll(
  params: PollActionParams
): Promise<Response> {
  const {
    userId,
    sessionPubkey,
    formData,
    sanitizedRelays,
    action,
    correlationId,
    queueType,
    queueTypeId,
    isRecyclable,
    hashTagPresetId,
  } = params;

  const contentValue = formData.get("content");
  const content = contentValue ? String(contentValue).trim() : "";
  if (!content) {
    throw new Error("Poll question is required");
  }

  const signedEventValue = formData.get("signedEvent");
  const nostrEventValue = formData.get("nostrEvent");
  const signedEventStr = signedEventValue ? String(signedEventValue) : "";
  const nostrEventStr = nostrEventValue ? String(nostrEventValue) : "";

  let signedEvent: SignedEvent;
  let nostrEvent: NostrEvent;
  try {
    signedEvent = JSON.parse(signedEventStr) as SignedEvent;
    nostrEvent = JSON.parse(nostrEventStr) as NostrEvent;
  } catch {
    throw new Error(ERROR_INVALID_SIGNED_EVENT_FORMAT);
  }

  if (signedEvent.kind !== KIND_POLL) {
    throw new Error("signedEvent must be kind 1068 (NIP-88 poll)");
  }

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEvent.pubkey,
    context: { feature: "newpost", action },
  });

  const parsedPoll = parsePollFromSignedEvent(signedEvent);
  if (!parsedPoll) {
    throw new Error("Invalid NIP-88 poll event");
  }

  if (parsedPoll.question.trim() !== content) {
    throw new Error("Poll question does not match signed event content");
  }

  const createPostUseCase = new CreatePostUseCase();
  const result = await createPostUseCase.execute({
    userId,
    content,
    caption: content,
    fileUrl: [],
    postType: "POLL",
    queueTypeId,
    queueType,
    hashTagPresetId,
    isRecyclable,
    signedEvent,
    nostrEvent,
    scheduledFor:
      action === "schedule-poll" ? signedEvent.created_at : undefined,
    nominalScheduledFor: undefined,
    showHashTagsinPosts: false,
  });

  if (action === "post-poll") {
    const validatedSignedEvent = validateSignedEvent(result.post.signedEvent);
    if (!validatedSignedEvent) {
      throw new Error("Invalid signedEvent after poll creation");
    }
    const publishUseCase = new PublishNowUseCase();
    await publishUseCase.execute({
      postId: result.post.id,
      userId,
      signedEvent: validatedSignedEvent,
      relays: sanitizedRelays,
      correlationId,
    });
    if (isContestEmbedRequest(formData)) {
      return await jsonContestEmbedPost(userId, result.post.id);
    }
    return redirect(`/dashboard/compose?type=poll&published=${result.post.id}`);
  }

  if (isContestEmbedRequest(formData)) {
    return await jsonContestEmbedPost(userId, result.post.id);
  }
  return redirect(`/dashboard/compose?type=poll&scheduled=${result.post.id}`);
}

/**
 * Resolve hashtag preset tags for poll flow (same as text post router).
 */
export async function resolvePollHashtagContext(
  userId: string,
  useHashtagPresets: boolean,
  manualHashTagPresetId: string | null,
  queueType: string,
  queueTypeId: string | null
): Promise<{ hashTagPresetTags: string; hashTagPresetId: string | null }> {
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
  return { hashTagPresetTags, hashTagPresetId };
}
