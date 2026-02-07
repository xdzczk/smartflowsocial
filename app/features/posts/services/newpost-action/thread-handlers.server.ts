/**
 * Thread post action: create N posts (one per segment) with delay, optional threadGroupId.
 */

import { redirect } from "@remix-run/node";

import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../../use-cases/publish-now.use-case.server";
import { resolveQueueTypeId } from "../queue-type-resolver.server";

import { getHashtagPresetTags } from "./hashtag-preset-utils.server";
import { applyHashtags } from "./hashtag-utils.server";
import { resolveContentWithTokens } from "./inline-tokens.server";

const DEFAULT_DELAY_SECONDS = 60; // 1 minute

interface ThreadSegmentInput {
  content: string;
  attachmentMeta?: Array<{ localId: string; url?: string; alt?: string }>;
}

function parseSegments(formData: FormData): ThreadSegmentInput[] {
  const raw = formData.get("threadSegments");
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ThreadSegmentInput =>
        typeof p === "object" &&
        p !== null &&
        "content" in p &&
        typeof (p as ThreadSegmentInput).content === "string"
    );
  } catch {
    return [];
  }
}

function parseSignedEvents(formData: FormData): SignedEvent[] {
  const raw = formData.get("threadSignedEvents");
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SignedEvent =>
        typeof p === "object" &&
        p !== null &&
        "id" in p &&
        "pubkey" in p &&
        "sig" in p
    );
  } catch {
    return [];
  }
}

export async function handleThreadAction(
  userId: string,
  sessionPubkey: string,
  formData: FormData,
  sanitizedRelays: string[]
): Promise<Response> {
  const action = formData.get("_action");
  const isSchedule = action === "schedule-thread";

  const segments = parseSegments(formData);
  const signedEvents = parseSignedEvents(formData);

  if (segments.length === 0 || signedEvents.length !== segments.length) {
    return Response.json(
      {
        error:
          "Thread must have at least one segment and signed events for each",
      },
      { status: 400 }
    );
  }

  const rawDelay = formData.get("threadDelaySeconds");
  const parsedDelay = parseInt(String(rawDelay ?? DEFAULT_DELAY_SECONDS), 10);
  const rawSeconds = Number.isNaN(parsedDelay)
    ? DEFAULT_DELAY_SECONDS
    : parsedDelay;
  // Only allow minute-based spacing (round to nearest minute, clamp 1–120 min)
  const delaySeconds = Math.max(
    60,
    Math.min(7200, Math.round(rawSeconds / 60) * 60)
  );

  let baseTime: number;
  if (isSchedule) {
    const scheduledForStr = formData.get("scheduledFor");
    const n = scheduledForStr ? parseInt(String(scheduledForStr), 10) : NaN;
    if (Number.isNaN(n) || n < 0) {
      return Response.json(
        { error: "Schedule time required for schedule-thread" },
        { status: 400 }
      );
    }
    baseTime = n;
  } else {
    baseTime = Math.floor(Date.now() / 1000);
  }

  const queueType = String(formData.get("queueType") ?? "unassigned");
  const queueTypeIdRaw = formData.get("queueTypeId");
  const queueTypeId =
    queueTypeIdRaw != null && String(queueTypeIdRaw) !== ""
      ? String(queueTypeIdRaw)
      : null;
  const hashTagPresetIdRaw = formData.get("hashTagPresetId");
  const hashTagPresetId =
    hashTagPresetIdRaw != null && String(hashTagPresetIdRaw) !== ""
      ? String(hashTagPresetIdRaw)
      : null;

  const hashtagResult = await getHashtagPresetTags(
    userId,
    !!hashTagPresetId,
    hashTagPresetId,
    queueType,
    queueTypeId
  );
  const hashTagPresetTags =
    typeof hashtagResult === "object"
      ? (hashtagResult as { tags: string }).tags
      : "";
  const hashTagPresetIdResolved =
    typeof hashtagResult === "object"
      ? (hashtagResult as { presetId: string | null }).presetId
      : hashTagPresetId;

  const resolvedQueueTypeId = await resolveQueueTypeId(
    userId,
    queueTypeId,
    queueType
  );

  const threadGroupId = `thread_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const createPostUseCase = new CreatePostUseCase();
  const publishUseCase = new PublishNowUseCase();
  const postIds: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const attachmentMeta = seg.attachmentMeta ?? [];
    let content = seg.content;
    let fileUrl: string[] = [];
    if (attachmentMeta.length > 0) {
      const resolved = resolveContentWithTokens(seg.content, attachmentMeta);
      content = resolved.content;
      fileUrl = resolved.fileUrl;
    }

    const contentWithHashtags = applyHashtags(content, hashTagPresetTags, true);

    const signedEvent = signedEvents[i];
    if (!signedEvent) continue;

    assertSignedEventMatchesSessionPubkey({
      sessionPubkey,
      eventPubkey: signedEvent.pubkey,
      context: { feature: "newpost", action: "thread" },
    });

    const scheduledForUnix = baseTime + i * delaySeconds;

    const result = await createPostUseCase.execute({
      userId,
      content: contentWithHashtags,
      caption: contentWithHashtags,
      fileUrl,
      postType: "TEXT",
      queueTypeId: resolvedQueueTypeId,
      queueType,
      hashTagPresetId: hashTagPresetIdResolved,
      isRecyclable: false,
      signedEvent,
      nostrEvent: signedEvent as unknown as NostrEvent,
      scheduledFor: scheduledForUnix,
      hashTagPresetTags,
      showHashTagsinPosts: true,
      postKind: "THREAD",
      threadGroupId,
    });

    postIds.push(result.post.id);

    if (!isSchedule && i === 0) {
      const validated = validateSignedEvent(result.post.signedEvent);
      if (validated) {
        await publishUseCase.execute({
          postId: result.post.id,
          userId,
          signedEvent: validated,
          relays: sanitizedRelays,
        });
      }
    }
  }

  const firstId = postIds[0];
  if (firstId == null) {
    return Response.json({ error: "No posts created" }, { status: 500 });
  }
  if (isSchedule) {
    return redirect(`/dashboard/newpost?scheduled=${firstId}`);
  }
  return redirect(`/dashboard/newpost?published=${firstId}`);
}
