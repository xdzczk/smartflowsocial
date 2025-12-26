/**
 * Draft edit action handlers
 * Centralized action processing for draft edit page
 */

import { updatePost } from "~/models/post.commands.server";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";

export async function handleDraftEditAction(
  formData: FormData,
  userId: string,
  postId: string,
) {
  const _action = formData.get("_action");

  if (_action === "update") {
    const content = formData.get("content");
    const caption = formData.get("caption");
    const queueType = formData.get("queueType");
    const queueTypeId = formData.get("queueTypeId");
    const useHashtagPresets = formData.get("useHashtagPresets") === "on";
    const hashTagPresetId = useHashtagPresets
      ? formData.get("hashTagPresetId") || null
      : null;

    // Resolve queue type ID in feature layer (business logic)
    const resolvedQueueTypeId = await resolveQueueTypeId(
      userId,
      queueTypeId as string | null,
      queueType as string | null,
    );

    await updatePost({
      id: postId,
      userId,
      data: {
        content: content as string,
        caption: caption as string,
        queueTypeId: resolvedQueueTypeId,
        hashTagPresetId: hashTagPresetId as string | null,
      },
    });

    return { redirect: "/dashboard/drafts" };
  }

  if (_action === "resume") {
    const content = formData.get("content");
    const caption = formData.get("caption");
    const queueType = formData.get("queueType");
    const queueTypeId = formData.get("queueTypeId");
    const scheduledFor = formData.get("scheduledFor");
    const signedEvent = formData.get("signedEvent");
    const nostrEvent = formData.get("nostrEvent");
    const useHashtagPresets = formData.get("useHashtagPresets") === "on";
    const hashTagPresetId = useHashtagPresets
      ? formData.get("hashTagPresetId") || null
      : null;

    // Ensure the post is signed before resuming
    if (!signedEvent || !nostrEvent) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Post must be signed before resuming", {
        postId,
        hasSignedEvent: !!signedEvent,
        hasNostrEvent: !!nostrEvent,
      });
    }

    // Resolve queue type ID in feature layer (business logic)
    const resolvedQueueTypeId = await resolveQueueTypeId(
      userId,
      queueTypeId as string | null,
      queueType as string | null,
    );

    await updatePost({
      id: postId,
      userId,
      data: {
        content: content as string,
        caption: caption as string,
        queueTypeId: resolvedQueueTypeId,
        scheduledFor: scheduledFor as string,
        signedEvent: JSON.parse(signedEvent as string),
        nostrEvent: JSON.parse(nostrEvent as string),
        draft: false,
        isScheduled: true,
        isPosted: false,
        hashTagPresetId: hashTagPresetId as string | null,
      },
    });

    return { redirect: "/dashboard/scheduled" };
  }

  return { error: "Invalid action" };
}


