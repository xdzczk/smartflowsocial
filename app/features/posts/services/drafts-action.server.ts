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

import { PostStateMachine } from "../state-machine/post-state-machine.server";

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

  if (_action === "bulkDeleteMixed") {
    const promises = result.data.itemData.map(
      (item: { id: string; type: "post" | "longform" }) => {
        if (item.type === "post") {
          return deletePost({ id: item.id, userId });
        }
        return deleteLongFormPost({ id: item.id, userId });
      }
    );
    await Promise.all(promises);
    return { success: true };
  }

  // TypeScript guarantees this is "bulkSignAndResume" after previous checks
  const bulkData = result.data;
  const stateMachine = new PostStateMachine();

  await Promise.all(
    bulkData.postIds.map(async (id, index) => {
      // Resolve queue type ID in feature layer (business logic)
      // Convert empty strings to null for queueTypeIds
      const queueTypeId =
        bulkData.queueTypeIds[index] &&
        bulkData.queueTypeIds[index].trim() !== ""
          ? bulkData.queueTypeIds[index]
          : null;
      const resolvedQueueTypeId = await resolveQueueTypeId(
        userId,
        queueTypeId,
        bulkData.queueTypes[index] ?? null
      );

      // Update post data (without flags - flags will be set by state machine)
      await updatePost({
        id,
        userId,
        data: {
          content: bulkData.contents[index],
          caption: bulkData.captions[index],
          queueTypeId: resolvedQueueTypeId,
          scheduledFor: bulkData.scheduledFors[index],
          signedEvent: bulkData.signedEvents[index],
          nostrEvent: bulkData.nostrEvents[index],
          // @deprecated - Flags removed. State machine will set them via transition.
        },
      });

      // Use state machine to transition to SCHEDULED state
      // This will automatically sync the flags
      await stateMachine.transition(
        id,
        userId,
        "SCHEDULED",
        "Draft signed and scheduled"
      );
    })
  );
  return { success: true };
}
