/**
 * Dashboard action handlers
 * Centralized action processing for dashboard index page
 */

import {
  dashboardActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { deleteLongFormPost } from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";

export async function handleDashboardAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, dashboardActionSchema);
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
    await deleteLongFormPost({ id: result.data.postId, userId });
    return { success: true };
  }

  if (_action === "bulkDelete") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) => deletePost({ id, userId }))
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  // TypeScript guarantees this is "bulkDeleteLongForm" after previous checks
  await Promise.all(
    result.data.postIds.map((id: string) => deleteLongFormPost({ id, userId }))
  );
  return { success: true };
}
