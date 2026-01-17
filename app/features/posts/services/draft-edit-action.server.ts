/**
 * Draft edit action handlers
 * Centralized action processing for draft edit page
 */

import {
  draftEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { updatePost } from "~/models/post.commands.server";

import { PostStateMachine } from "../state-machine/post-state-machine.server";

import { resolveQueueTypeId } from "./queue-type-resolver.server";

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

  return { redirect: "/dashboard/scheduled" };
}
