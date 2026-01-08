/**
 * Draft edit action handlers
 * Centralized action processing for draft edit page
 */

import {
  draftEditActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { updatePost } from "~/models/post.commands.server";

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
      draft: false,
      isScheduled: true,
      isPosted: false,
      hashTagPresetId,
    },
  });

  return { redirect: "/dashboard/scheduled" };
}
