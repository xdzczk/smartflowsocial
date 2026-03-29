/**
 * Thread post action: create N posts (one per segment) with delay, optional threadGroupId.
 */

import { json, redirect } from "@remix-run/node";

import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { resolveQueueTypeId } from "~/features/posts/server";
import { PublishNowUseCase } from "~/features/posts/server/publishing";
import { assertMediaUrlsReady } from "~/features/upload/services/media-readiness.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEvent } from "~/lib/validation/nostr-events.server";

import { CreatePostUseCase } from "../../use-cases/create-post.use-case.server";

import {
  isContestEmbedRequest,
  jsonContestEmbedPost,
} from "./contest-embed-response.server";
import { getHashtagPresetTags } from "./hashtag-preset-utils.server";
import {
  applyHashtags,
  parseIncludeHashtagsInNoteBodyFromForm,
} from "./hashtag-utils.server";
import { resolveContentWithTokens } from "./inline-tokens.server";

const DEFAULT_DELAY_SECONDS = 60; // 1 minute
const MIN_THREAD_SEGMENTS = 2;

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

function segmentHasTextOrMedia(seg: ThreadSegmentInput): boolean {
  const hasText = seg.content.trim().length > 0;
  const hasMedia =
    seg.attachmentMeta?.some(
      (a) => typeof a.url === "string" && a.url.trim() !== ""
    ) ?? false;
  return hasText || hasMedia;
}

function threadSegmentsValidationError(
  segments: ThreadSegmentInput[],
  signedEvents: SignedEvent[]
): { error: string } | null {
  if (segments.length < MIN_THREAD_SEGMENTS) {
    return {
      error: `Threads need at least ${MIN_THREAD_SEGMENTS} segments.`,
    };
  }
  if (signedEvents.length !== segments.length) {
    return { error: "Signed events must match each thread segment." };
  }
  if (!segments.every((s) => segmentHasTextOrMedia(s))) {
    return {
      error:
        "Each thread segment must include text or at least one media attachment.",
    };
  }
  return null;
}

function threadDelaySecondsFromForm(formData: FormData): number {
  const rawDelay = formData.get("threadDelaySeconds");
  const parsedDelay = parseInt(String(rawDelay ?? DEFAULT_DELAY_SECONDS), 10);
  const rawSeconds = Number.isNaN(parsedDelay)
    ? DEFAULT_DELAY_SECONDS
    : parsedDelay;
  return Math.max(60, Math.min(7200, Math.round(rawSeconds / 60) * 60));
}

function threadScheduleBaseFromForm(
  formData: FormData,
  isSchedule: boolean
):
  | { ok: true; baseTime: number; nominalFirstUnix?: number }
  | { ok: false; error: string } {
  if (!isSchedule) {
    return { ok: true, baseTime: Math.floor(Date.now() / 1000) };
  }
  const scheduledForStr = formData.get("scheduledFor");
  const n = scheduledForStr ? parseInt(String(scheduledForStr), 10) : NaN;
  if (Number.isNaN(n) || n < 0) {
    return { ok: false, error: "Schedule time required for schedule-thread" };
  }
  let nominalFirstUnix: number | undefined;
  const nominalRaw = formData.get("nominalScheduledFor");
  const nominalParsed =
    nominalRaw != null && String(nominalRaw).trim() !== ""
      ? parseInt(String(nominalRaw), 10)
      : NaN;
  if (Number.isFinite(nominalParsed) && nominalParsed >= 0) {
    nominalFirstUnix = nominalParsed;
  }
  return { ok: true, baseTime: n, nominalFirstUnix };
}

async function resolveThreadQueueAndHashtagContext(
  userId: string,
  formData: FormData
): Promise<{
  queueType: string;
  queueTypeId: string | null;
  hashTagPresetId: string | null;
  hashTagPresetTags: string;
  hashTagPresetIdResolved: string | null;
  resolvedQueueTypeId: string | null;
}> {
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

  return {
    queueType,
    queueTypeId,
    hashTagPresetId,
    hashTagPresetTags,
    hashTagPresetIdResolved,
    resolvedQueueTypeId,
  };
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

  const segmentError = threadSegmentsValidationError(segments, signedEvents);
  if (segmentError) {
    return json(segmentError, { status: 400 });
  }

  const delaySeconds = threadDelaySecondsFromForm(formData);

  const scheduleBase = threadScheduleBaseFromForm(formData, isSchedule);
  if (!scheduleBase.ok) {
    return json({ error: scheduleBase.error }, { status: 400 });
  }
  const { baseTime, nominalFirstUnix } = scheduleBase;

  const {
    queueType,
    hashTagPresetTags,
    hashTagPresetIdResolved,
    resolvedQueueTypeId,
  } = await resolveThreadQueueAndHashtagContext(userId, formData);

  const threadGroupId = `thread_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const showHashTagsinPostsEffective = parseIncludeHashtagsInNoteBodyFromForm(
    formData,
    true
  );

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
    await assertMediaUrlsReady(fileUrl);

    const contentWithHashtags = applyHashtags(
      content,
      hashTagPresetTags,
      showHashTagsinPostsEffective
    );

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
      nominalScheduledFor:
        i === 0 && nominalFirstUnix != null ? nominalFirstUnix : undefined,
      hashTagPresetTags,
      showHashTagsinPosts: showHashTagsinPostsEffective,
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
    return json({ error: "No posts created" }, { status: 500 });
  }
  if (isContestEmbedRequest(formData)) {
    return await jsonContestEmbedPost(userId, firstId);
  }
  if (isSchedule) {
    return redirect(`/dashboard/compose?type=thread&scheduled=${firstId}`);
  }
  return redirect(`/dashboard/compose?type=thread&published=${firstId}`);
}
