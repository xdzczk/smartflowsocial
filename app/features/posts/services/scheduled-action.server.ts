/**
 * Scheduled posts action handlers
 * Centralized action processing for scheduled posts page
 */

import {
  deleteLongFormPost,
} from "~/models/longformpost.server";
import {
  deletePost,
} from "~/models/post.server";

export async function handleScheduledAction(
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
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
    return { success: true };
  }

  if (_action === "bulkDeleteLongForm") {
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deleteLongFormPost({ id, userId })));
    return { success: true };
  }

  if (_action === "bulkDeleteMixed") {
    const itemData = JSON.parse(formData.get("itemData") as string);
    const promises = itemData.map((item: { id: string; type: string }) => {
      if (item.type === "post") {
        return deletePost({ id: item.id, userId });
      } else {
        return deleteLongFormPost({ id: item.id, userId });
      }
    });
    await Promise.all(promises);
    return { success: true };
  }

  return { error: "Invalid action" };
}

