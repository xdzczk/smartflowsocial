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
  const postIdRaw = formData.get("postId");
  const postId = typeof postIdRaw === "string" ? postIdRaw : null;
  const _actionRaw = formData.get("_action");
  const _action = typeof _actionRaw === "string" ? _actionRaw : null;

  if (_action === "delete") {
    if (!postId || typeof postId !== "string") {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Post ID is required");
    }
    await deletePost({ id: postId, userId });
    return { success: true };
  }

  if (_action === "deleteLongForm") {
    if (!postId || typeof postId !== "string") {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Post ID is required");
    }
    await deleteLongFormPost({ id: postId, userId });
    return { success: true };
  }

  if (_action === "bulkDelete") {
    try {
      const postIdsRaw = formData.get("postIds");
      const postIdsStr = typeof postIdsRaw === "string" ? postIdsRaw : null;
      if (!postIdsStr) {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Post IDs are required");
      }
      const parsed: unknown = JSON.parse(postIdsStr);
      const postIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
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
      const postIdsRaw = formData.get("postIds");
      const postIdsStr = typeof postIdsRaw === "string" ? postIdsRaw : null;
      if (!postIdsStr) {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Post IDs are required");
      }
      const parsed: unknown = JSON.parse(postIdsStr);
      const postIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
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




