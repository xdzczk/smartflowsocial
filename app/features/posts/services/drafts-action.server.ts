/**
 * Drafts action handlers
 * Centralized action processing for drafts page
 */

import {
  draftsActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { deletePost, updatePost } from "~/models/post.commands.server";

import { resolveQueueTypeId } from "./queue-type-resolver.server";

export async function handleDraftsAction(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, draftsActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "delete") {
    await deletePost({ id: result.data.postId, userId });
    return { success: true };
  }

  if (_action === "deleteLongForm") {
    await deleteLongFormPost({ id: result.data.postId, userId });
    return { success: true };
  }

  if (_action === "bulkDelete") {
    await Promise.all(
      result.data.postIds.map((id: string) => deletePost({ id, userId }))
    );
    return { success: true };
  }

  if (_action === "bulkDeleteLongForm") {
    await Promise.all(
      result.data.postIds.map((id: string) =>
        deleteLongFormPost({ id, userId })
      )
    );
    return { success: true };
  }

  if (_action === "bulkSignAndResume") {
    const bulkData = result.data;

    await Promise.all(
      bulkData.postIds.map(async (id, index) => {
        // Resolve queue type ID in feature layer (business logic)
        const resolvedQueueTypeId = await resolveQueueTypeId(
          userId,
          bulkData.queueTypeIds[index] ?? null,
          bulkData.queueTypes[index] ?? null
        );

        return updatePost({
          id,
          userId,
          data: {
            content: bulkData.contents[index],
            caption: bulkData.captions[index],
            queueTypeId: resolvedQueueTypeId,
            scheduledFor: bulkData.scheduledFors[index],
            signedEvent: bulkData.signedEvents[index],
            nostrEvent: bulkData.nostrEvents[index],
            draft: false,
            isScheduled: true,
            isPosted: false,
          },
        });
      })
    );
    return { success: true };
  }

  return { error: "Invalid action" };
}
