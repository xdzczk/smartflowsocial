/**
 * Scheduled posts action handlers
 * Centralized action processing for scheduled posts page
 */

import {
  scheduledActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";

export async function handleScheduledAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, scheduledActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "delete") {
    const deletedPost = await deletePost({ id: result.data.postId, userId });
    // Return success even if post was already deleted (idempotent operation)
    return { success: true, deleted: deletedPost !== null };
  }

  if (_action === "deleteLongForm") {
    const deletedPost = await deleteLongFormPost({
      id: result.data.postId,
      userId,
    });
    // Return success even if post was already deleted (idempotent operation)
    return { success: true, deleted: deletedPost !== null };
  }

  if (_action === "bulkDelete") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) => deletePost({ id, userId }))
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  if (_action === "bulkDeleteLongForm") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) =>
        deleteLongFormPost({ id, userId })
      )
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  // TypeScript guarantees this is "bulkDeleteMixed" after previous checks
  const promises = result.data.itemData.map((item) => {
    if (item.type === "post") {
      return deletePost({ id: item.id, userId });
    } else {
      return deleteLongFormPost({ id: item.id, userId });
    }
  });
  const results = await Promise.all(promises);
  const deletedCount = results.filter((post) => post !== null).length;
  return { success: true, deletedCount };
}
