/**
 * Draft edit action handlers
 * Centralized action processing for draft edit page
 */

import type { SignedEvent } from "~/features/nostr/types";
import {
  assertScheduleCapacity,
  ScheduleCapExceededError,
} from "~/features/payments/entitlements/schedule-cap-policy.server";
import {
  createPostWithOutbox,
  updatePost,
  getPostById,
} from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import {
  draftEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { restoreShortDraftVersion } from "./draft-version.server";

function parseSignedEvent(raw: string): {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
} | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      !("pubkey" in parsed) ||
      !("created_at" in parsed) ||
      !("kind" in parsed) ||
      !("tags" in parsed) ||
      !("content" in parsed) ||
      !("sig" in parsed)
    ) {
      return null;
    }
    return parsed as {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    };
  } catch {
    return null;
  }
}

export async function handleDraftEditAction(
  formData: FormData,
  userId: string,
  postId: string
) {
  const _actionRaw = formData.get("_action");
  if (_actionRaw === "restore-version") {
    const versionId = formData.get("versionId");
    if (typeof versionId === "string" && versionId) {
      const restoredId = await restoreShortDraftVersion(versionId, userId);
      if (restoredId) {
        return { redirect: `/dashboard/drafts/edit/${restoredId}` };
      }
    }
  }

  const result = validateFormDataOrRespond(formData, draftEditActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "update") {
    const updateData = result.data;

    // Resolve queue type ID in feature layer (business logic)
    const resolvedQueueTypeId = await resolveQueueTypeId(
      userId,
      updateData.queueTypeId,
      updateData.queueType
    );

    const hashTagPresetId = updateData.useHashtagPresets
      ? updateData.hashTagPresetId
      : null;

    await updatePost({
      id: postId,
      userId,
      data: {
        content: updateData.content,
        caption: updateData.caption,
        queueTypeId: resolvedQueueTypeId,
        hashTagPresetId,
      },
    });

    return { redirect: "/dashboard/drafts" };
  }

  // _action must be "resume" at this point (discriminated union)
  const resumeData = result.data;

  // Resolve queue type ID in feature layer (business logic)
  const resolvedQueueTypeId = await resolveQueueTypeId(
    userId,
    resumeData.queueTypeId,
    resumeData.queueType
  );

  const hashTagPresetId = resumeData.useHashtagPresets
    ? resumeData.hashTagPresetId
    : null;

  let nominalScheduledAtUtc: Date | undefined;
  if (
    resumeData.nominalScheduledFor != null &&
    resumeData.nominalScheduledFor.trim() !== ""
  ) {
    const parsed = new Date(
      parseInt(resumeData.nominalScheduledFor, 10) * 1000
    );
    nominalScheduledAtUtc = Number.isNaN(parsed.getTime()) ? undefined : parsed;
  } else {
    nominalScheduledAtUtc = undefined;
  }

  const scheduledAtUtcFromResume = resumeData.scheduledFor
    ? parseInt(resumeData.scheduledFor, 10)
    : undefined;
  if (
    scheduledAtUtcFromResume !== undefined &&
    Number.isNaN(scheduledAtUtcFromResume)
  ) {
    throw new Error("Invalid scheduledFor in resume data");
  }

  const repostList = parseRepostListFromResume(resumeData);
  const quoteList = parseQuoteListFromResume(resumeData);
  const scheduleSlotCount = 1 + repostList.length + quoteList.length;
  try {
    await assertScheduleCapacity(userId, scheduleSlotCount);
  } catch (e) {
    if (e instanceof ScheduleCapExceededError) {
      return { error: e.message };
    }
    throw e;
  }

  // Update post data (flags will be set by state machine transition)
  await updatePost({
    id: postId,
    userId,
    data: {
      content: resumeData.content,
      caption: resumeData.caption,
      queueTypeId: resolvedQueueTypeId,
      ...(scheduledAtUtcFromResume !== undefined
        ? { scheduledAtUtc: scheduledAtUtcFromResume }
        : {}),
      ...(nominalScheduledAtUtc != null ? { nominalScheduledAtUtc } : {}),
      signedEvent: resumeData.signedEvent,
      nostrEvent: resumeData.nostrEvent,
      hashTagPresetId,
      // Note: Flags (draft, isScheduled, isPosted) should be derived from currentState
      // State machine transition will update currentState, which is the source of truth
    },
  });

  // Transition to SCHEDULED state using state machine (single source of truth)
  const stateMachine = new PostStateMachine();
  await stateMachine.transition(
    postId,
    userId,
    "SCHEDULED",
    "Draft resumed and scheduled"
  );

  const sourcePost = await getPostById({ id: postId, userId });
  if (!sourcePost) {
    return { redirect: "/dashboard/scheduled" };
  }
  await createRepostAndQuotePostsFromResume(
    resumeData,
    sourcePost,
    postId,
    userId,
    stateMachine
  );
  return { redirect: "/dashboard/scheduled" };
}

interface ResumeRepostQuoteData {
  repostSchedules?: string;
  alsoScheduleRepost?: boolean;
  repostSignedEvent?: string;
  repostScheduledFor?: string;
  quoteSchedules?: string;
  alsoScheduleQuote?: boolean;
  quoteSignedEvent?: string;
  quoteScheduledFor?: string;
  quoteCaption?: string;
}

async function createRepostAndQuotePostsFromResume(
  resumeData: ResumeRepostQuoteData,
  sourcePost: NonNullable<Awaited<ReturnType<typeof getPostById>>>,
  postId: string,
  userId: string,
  stateMachine: PostStateMachine
): Promise<void> {
  const repostList = parseRepostListFromResume(resumeData);
  for (const item of repostList) {
    if (!item.signedEvent) continue;
    const scheduledAtUtc = new Date(item.scheduledFor * 1000);
    const repostPost = await createPostWithOutbox(
      {
        userId,
        content: "",
        caption: "",
        fileUrl: [],
        postType: sourcePost.postType,
        queueTypeId: sourcePost.queueTypeId,
        scheduledAtUtc,
        tags: [],
        repost: true,
        isQuotedPost: false,
        repostOfPostId: postId,
        postKind: "REPOST",
        signedEvent: item.signedEvent as SignedEvent,
      },
      item.scheduledFor
    );
    await stateMachine.transition(
      repostPost.id,
      userId,
      "SCHEDULED",
      "Repost created"
    );
  }
  const quoteList = parseQuoteListFromResume(resumeData);
  for (const item of quoteList) {
    if (!item.signedEvent) continue;
    const scheduledAtUtc = new Date(item.scheduledFor * 1000);
    const quoteCaption = item.caption ?? "";
    const quotePost = await createPostWithOutbox(
      {
        userId,
        content: quoteCaption,
        caption: quoteCaption,
        fileUrl: [],
        postType: sourcePost.postType,
        queueTypeId: sourcePost.queueTypeId,
        scheduledAtUtc,
        tags: [],
        repost: false,
        isQuotedPost: true,
        quoteOfPostId: postId,
        postKind: "QUOTE",
        signedEvent: item.signedEvent as SignedEvent,
      },
      item.scheduledFor
    );
    await stateMachine.transition(
      quotePost.id,
      userId,
      "SCHEDULED",
      "Quote post created"
    );
  }
}

function parseRepostListFromResume(resumeData: {
  repostSchedules?: string;
  alsoScheduleRepost?: boolean;
  repostSignedEvent?: string;
  repostScheduledFor?: string;
}): Array<{
  scheduledFor: number;
  signedEvent: ReturnType<typeof parseSignedEvent>;
}> {
  let list: Array<{
    scheduledFor: number;
    signedEvent: ReturnType<typeof parseSignedEvent>;
  }> = [];
  if (
    resumeData.repostSchedules &&
    typeof resumeData.repostSchedules === "string"
  ) {
    try {
      const parsed = JSON.parse(resumeData.repostSchedules) as Array<{
        scheduledFor: number;
        signedEvent: string;
      }>;
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((p) => typeof p.scheduledFor === "number" && p.signedEvent)
          .map((p) => ({
            scheduledFor: p.scheduledFor,
            signedEvent: parseSignedEvent(
              typeof p.signedEvent === "string"
                ? p.signedEvent
                : JSON.stringify(p.signedEvent)
            ),
          }))
          .filter(
            (
              p
            ): p is {
              scheduledFor: number;
              signedEvent: NonNullable<ReturnType<typeof parseSignedEvent>>;
            } => p.signedEvent != null
          );
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    resumeData.alsoScheduleRepost &&
    resumeData.repostSignedEvent &&
    resumeData.repostScheduledFor
  ) {
    const repostSignedEvent = parseSignedEvent(resumeData.repostSignedEvent);
    const scheduledForUnix = parseInt(resumeData.repostScheduledFor, 10);
    if (repostSignedEvent && !Number.isNaN(scheduledForUnix)) {
      list = [
        { scheduledFor: scheduledForUnix, signedEvent: repostSignedEvent },
      ];
    }
  }
  return list;
}

function parseQuoteListFromResume(resumeData: {
  quoteSchedules?: string;
  alsoScheduleQuote?: boolean;
  quoteSignedEvent?: string;
  quoteScheduledFor?: string;
  quoteCaption?: string;
}): Array<{
  scheduledFor: number;
  signedEvent: ReturnType<typeof parseSignedEvent>;
  caption?: string;
}> {
  let list: Array<{
    scheduledFor: number;
    signedEvent: ReturnType<typeof parseSignedEvent>;
    caption?: string;
  }> = [];
  if (
    resumeData.quoteSchedules &&
    typeof resumeData.quoteSchedules === "string"
  ) {
    try {
      const parsed = JSON.parse(resumeData.quoteSchedules) as Array<{
        scheduledFor: number;
        signedEvent: string;
        caption?: string;
      }>;
      if (Array.isArray(parsed)) {
        const mapped = parsed
          .filter((p) => typeof p.scheduledFor === "number" && p.signedEvent)
          .map((p) => ({
            scheduledFor: p.scheduledFor,
            signedEvent: parseSignedEvent(
              typeof p.signedEvent === "string"
                ? p.signedEvent
                : JSON.stringify(p.signedEvent)
            ),
            caption: p.caption,
          }))
          .filter((p) => p.signedEvent != null);
        list = mapped as Array<{
          scheduledFor: number;
          signedEvent: NonNullable<ReturnType<typeof parseSignedEvent>>;
          caption?: string;
        }>;
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    resumeData.alsoScheduleQuote &&
    resumeData.quoteSignedEvent &&
    resumeData.quoteScheduledFor
  ) {
    const quoteSignedEvent = parseSignedEvent(resumeData.quoteSignedEvent);
    const scheduledForUnix = parseInt(resumeData.quoteScheduledFor, 10);
    if (quoteSignedEvent && !Number.isNaN(scheduledForUnix)) {
      list = [
        {
          scheduledFor: scheduledForUnix,
          signedEvent: quoteSignedEvent,
          caption: resumeData.quoteCaption ?? "",
        },
      ];
    }
  }
  return list;
}
