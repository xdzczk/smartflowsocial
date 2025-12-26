/**
 * Drafts action handlers
 * Centralized action processing for drafts page
 */

import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import {
  deleteLongFormPost,
} from "~/models/longformpost.server";
import { deletePost, updatePost } from "~/models/post.commands.server";

export async function handleDraftsAction(
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

  if (_action === "bulkSignAndResume") {
    const postIds = formData.getAll("postIds");
    const contents = formData.getAll("contents");
    const captions = formData.getAll("captions");
    const queueTypes = formData.getAll("queueTypes");
    const queueTypeIds = formData.getAll("queueTypeIds");
    const scheduledFors = formData.getAll("scheduledFors");
    const signedEvents = formData.getAll("signedEvents");
    const nostrEvents = formData.getAll("nostrEvents");

    await Promise.all(
      postIds.map(async (id, index) => {
        // Resolve queue type ID in feature layer (business logic)
        const resolvedQueueTypeId = await resolveQueueTypeId(
          userId,
          (queueTypeIds[index] as string) || null,
          (queueTypes[index] as string) || null,
        );

        return updatePost({
          id: id as string,
          userId,
          data: {
            content: contents[index] as string,
            caption: captions[index] as string,
            queueTypeId: resolvedQueueTypeId,
            scheduledFor: scheduledFors[index] as string,
            signedEvent: JSON.parse(signedEvents[index] as string),
            nostrEvent: JSON.parse(nostrEvents[index] as string),
            draft: false,
            isScheduled: true,
            isPosted: false,
          },
        });
      }),
    );
    return { success: true };
  }

  return { error: "Invalid action" };
}


