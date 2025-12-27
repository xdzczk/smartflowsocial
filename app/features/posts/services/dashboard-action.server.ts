/**
 * Dashboard action handlers
 * Centralized action processing for dashboard index page
 */

import {
  deleteLongFormPost,
} from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";

export async function handleDashboardAction(
  formData: FormData,
  userId: string,
) {
  const postId = formData.get("postId");
  const _action = formData.get("_action");

  if (_action === "delete") {
    await deletePost({ id: postId as string, userId });
    return { success: true };
  }

  if (_action === "deleteLongForm") {
    await deleteLongFormPost({ id: postId as string, userId });
    return { success: true };
  }

  if (_action === "bulkDelete") {
    try {
      const postIds = JSON.parse(formData.get("postIds") as string) as string[];
      await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
      return { success: true };
    } catch (parseError) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Invalid postIds format", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }
  }

  if (_action === "bulkDeleteLongForm") {
    try {
      const postIds = JSON.parse(formData.get("postIds") as string) as string[];
      await Promise.all(postIds.map((id: string) => deleteLongFormPost({ id, userId })));
      return { success: true };
    } catch (parseError) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Invalid postIds format", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }
  }

  return { error: "Invalid action" };
}




