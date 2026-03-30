/**
 * Drafts action handlers
 * Centralized action processing for drafts page
 */

import {
  cloneDraftPost,
  deleteLongFormPost,
  deletePost,
  getDraftPostIdsForUser,
  updatePost,
} from "~/features/posts/server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { createTemplate } from "~/features/templates/services/template-data.server";
import {
  draftsActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

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

  if (_action === "bulkAssignQueue") {
    const data = result.data;
    const allowedIds = await getDraftPostIdsForUser(userId, data.postIds);
    if (allowedIds.length !== data.postIds.length) {
      return { error: "One or more drafts were not found." };
    }
    const resolved = await resolveQueueTypeId(
      userId,
      data.queueTypeId ?? null,
      data.queueType
    );
    await Promise.all(
      data.postIds.map((id) =>
        updatePost({
          id,
          userId,
          data: { queueTypeId: resolved },
        })
      )
    );
    return { success: true };
  }

  if (_action === "duplicateDraftPost") {
    const r = await cloneDraftPost(userId, result.data.postId);
    if (!r.ok) {
      return { error: r.error };
    }
    return { success: true, newPostId: r.postId };
  }

  if (_action === "convertDraftToTemplate") {
    const data = result.data;
    const clone = await cloneDraftPost(userId, data.postId);
    if (!clone.ok) {
      return { error: clone.error };
    }
    const name =
      data.templateName && data.templateName.trim().length > 0
        ? data.templateName.trim()
        : "Template from draft";
    await createTemplate({
      userId,
      name,
      templateType: "POST",
      postId: clone.postId,
      longFormPostId: null,
    });
    await deletePost({ id: data.postId, userId });
    return { success: true };
  }

  if (_action === "bulkDuplicateDrafts") {
    const data = result.data;
    const allowedIds = await getDraftPostIdsForUser(userId, data.postIds);
    if (allowedIds.length !== data.postIds.length) {
      return { error: "One or more drafts were not found." };
    }
    const newPostIds: string[] = [];
    for (const id of data.postIds) {
      const r = await cloneDraftPost(userId, id);
      if (r.ok) {
        newPostIds.push(r.postId);
      }
    }
    return { success: true, newPostIds };
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

      const rawScheduled = bulkData.scheduledFors[index];
      const scheduledAtUtc =
        rawScheduled != null && String(rawScheduled).trim() !== ""
          ? parseInt(String(rawScheduled), 10)
          : undefined;
      if (scheduledAtUtc !== undefined && Number.isNaN(scheduledAtUtc)) {
        throw new Error("Invalid scheduledFor in bulk resume data");
      }

      // Update post data (without flags - flags will be set by state machine)
      await updatePost({
        id,
        userId,
        data: {
          content: bulkData.contents[index],
          caption: bulkData.captions[index],
          queueTypeId: resolvedQueueTypeId,
          ...(scheduledAtUtc !== undefined && { scheduledAtUtc }),
          signedEvent: bulkData.signedEvents[index],
          nostrEvent: bulkData.nostrEvents[index],
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
