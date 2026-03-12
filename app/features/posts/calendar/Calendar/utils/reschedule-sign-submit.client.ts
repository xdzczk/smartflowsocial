/**
 * Reschedule modal: sign event with new timestamp and submit FormData.
 */

import type { FetcherWithComponents } from "@remix-run/react";
import { toast } from "react-hot-toast";

import { handleErrorSafely } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { fromDate, toUnixTimestamp } from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";

export async function handleSignAndSubmitLogic(
  editableDateTime: Date,
  post: CalendarPost,
  selectedQueueType: string | null,
  shouldOverride: boolean,
  fetcher: FetcherWithComponents<{
    success?: boolean;
    needsSigning?: boolean;
    error?: string;
  }>,
  setIsSigningEvent: (isSigning: boolean) => void,
  setSigningError: (error: string | null) => void,
  clearPendingRetry?: () => void
): Promise<void> {
  const editableZoned = fromDate(editableDateTime, "UTC");
  const newTimeUnix = toUnixTimestamp(editableZoned);

  try {
    setIsSigningEvent(true);

    const originalSignedEvent = post.signedEvent as
      | { content: string; kind?: number; tags?: string[][] }
      | undefined;
    const originalNostrEvent = post.nostrEvent;

    if (!originalSignedEvent || !originalNostrEvent) {
      throw new Error(
        "Original event not found. Cannot reschedule unsigned posts."
      );
    }

    const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
      content: originalSignedEvent.content,
      created_at: newTimeUnix,
      kind: originalSignedEvent.kind ?? 1,
      tags: originalSignedEvent.tags ?? [],
    });

    const formData = new FormData();
    formData.append("action", "reschedule");
    formData.append("postId", post.id);
    formData.append("newTime", newTimeUnix.toString());
    formData.append("overrideQueue", shouldOverride.toString());
    formData.append("signedEvent", JSON.stringify(signedEvent));
    formData.append("nostrEvent", JSON.stringify(nostrEvent));
    if (selectedQueueType) {
      formData.append("queueTypeId", selectedQueueType);
    }

    clearPendingRetry?.();
    fetcher.submit(formData, { method: "post" });
  } catch (error) {
    handleErrorSafely(error, {
      component: "RescheduleModal",
      action: "reSignEvent",
      message: "Error re-signing event",
    });
    clearPendingRetry?.();
    setIsSigningEvent(false);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to sign event. Please try again.";
    setSigningError(errorMessage);
    toast.error(errorMessage);
  }
}
