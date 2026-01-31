/**
 * Draft edit action handlers
 * Centralized action processing for draft edit page
 */

import {
  draftEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  createPostWithOutbox,
  updatePost,
} from "~/models/post.commands.server";
import { getPostById } from "~/models/post.queries.server";

import { PostStateMachine } from "../state-machine/post-state-machine.server";

import { resolveQueueTypeId } from "./queue-type-resolver.server";

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

  // Update post data (flags will be set by state machine transition)
  await updatePost({
    id: postId,
    userId,
    data: {
      content: resumeData.content,
      caption: resumeData.caption,
      queueTypeId: resolvedQueueTypeId,
      scheduledFor: resumeData.scheduledFor,
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

  // Optional: create repost/quote posts when "also schedule repost/quote" was selected
  const sourcePost = await getPostById({ id: postId, userId });
  if (!sourcePost) {
    return { redirect: "/dashboard/scheduled" };
  }

  if (
    resumeData.alsoScheduleRepost &&
    resumeData.repostSignedEvent &&
    resumeData.repostScheduledFor
  ) {
    const repostSignedEvent = parseSignedEvent(resumeData.repostSignedEvent);
    if (repostSignedEvent) {
      const scheduledForUnix = parseInt(resumeData.repostScheduledFor, 10);
      if (!Number.isNaN(scheduledForUnix)) {
        const scheduledAtUtc = new Date(scheduledForUnix * 1000);
        const repostPost = await createPostWithOutbox(
          {
            userId,
            content: "",
            caption: "",
            fileUrl: [],
            postType: sourcePost.postType,
            queueTypeId: sourcePost.queueTypeId,
            scheduledFor: scheduledAtUtc,
            tags: [],
            repost: true,
            isQuotedPost: false,
            repostOfPostId: postId,
            signedEvent: repostSignedEvent,
          },
          scheduledForUnix
        );
        await stateMachine.transition(
          repostPost.id,
          userId,
          "SCHEDULED",
          "Repost created"
        );
      }
    }
  }

  if (
    resumeData.alsoScheduleQuote &&
    resumeData.quoteSignedEvent &&
    resumeData.quoteScheduledFor
  ) {
    const quoteSignedEvent = parseSignedEvent(resumeData.quoteSignedEvent);
    if (quoteSignedEvent) {
      const scheduledForUnix = parseInt(resumeData.quoteScheduledFor, 10);
      if (!Number.isNaN(scheduledForUnix)) {
        const scheduledAtUtc = new Date(scheduledForUnix * 1000);
        const quoteCaption = resumeData.quoteCaption ?? "";
        const quotePost = await createPostWithOutbox(
          {
            userId,
            content: quoteCaption,
            caption: quoteCaption,
            fileUrl: [],
            postType: sourcePost.postType,
            queueTypeId: sourcePost.queueTypeId,
            scheduledFor: scheduledAtUtc,
            tags: [],
            repost: false,
            isQuotedPost: true,
            quoteOfPostId: postId,
            signedEvent: quoteSignedEvent,
          },
          scheduledForUnix
        );
        await stateMachine.transition(
          quotePost.id,
          userId,
          "SCHEDULED",
          "Quote post created"
        );
      }
    }
  }

  return { redirect: "/dashboard/scheduled" };
}
