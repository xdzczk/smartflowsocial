/**
 * Longform Post Status Calculator
 *
 * Business logic for determining longform post status and publishedAt dates.
 * This logic was moved from the model layer to maintain clear boundaries.
 */

import type { SignedEvent } from "~/features/nostr/types";
export type LongFormStatus = "DRAFT" | "ACTIVE" | "SCHEDULED";

export interface LongFormStatusCalculation {
  status: LongFormStatus;
  isScheduled: boolean;
  isDraft: boolean;
  publishedAt: Date | null;
  nostrEventId: string | null;
  finalScheduledFor: string | null;
}

/**
 * Calculate longform post status and related fields
 */
export function calculateLongFormStatus({
  isPublished,
  scheduledFor,
  signedEvent,
}: {
  isPublished: boolean;
  scheduledFor?: string | null;
  signedEvent?: SignedEvent | null;
}): LongFormStatusCalculation {
  // Extract published_at from NOSTR event tags if not provided as scheduledFor
  let finalScheduledFor = scheduledFor;
  if (!finalScheduledFor && !isPublished && signedEvent?.tags) {
    const publishedAtTag = signedEvent.tags.find(
      (tag) => Array.isArray(tag) && tag[0] === "published_at",
    );
    if (publishedAtTag?.[1]) {
      finalScheduledFor = publishedAtTag[1].toString();
    }
  }

  // Determine status based on publishing state and scheduling
  const isScheduled = Boolean(finalScheduledFor && !isPublished);
  const isDraft = !isPublished && !isScheduled;

  let status: LongFormStatus;
  if (isPublished) {
    status = "ACTIVE";
  } else if (isScheduled) {
    status = "SCHEDULED";
  } else {
    status = "DRAFT";
  }

  // Extract nostrEventId from signedEvent if available
  const nostrEventId = signedEvent?.id ?? null;

  // Calculate publishedAt based on scheduling
  let publishedAt: Date | null = null;
  if (isPublished) {
    // For published posts, extract published_at from tags if available, otherwise current time
    let publishedAtTimestamp: number | null = null;
    if (signedEvent?.tags) {
      const publishedAtTag = signedEvent.tags.find(
        (tag: unknown) => Array.isArray(tag) && tag[0] === "published_at",
      );
      if (
        publishedAtTag &&
        Array.isArray(publishedAtTag) &&
        publishedAtTag[1]
      ) {
        publishedAtTimestamp =
          typeof publishedAtTag[1] === "number"
            ? publishedAtTag[1]
            : parseInt(String(publishedAtTag[1]), 10);
      }
    }
    publishedAt = publishedAtTimestamp
      ? new Date(publishedAtTimestamp * 1000)
      : new Date();
  } else if (isScheduled && finalScheduledFor) {
    // For scheduled posts, set publishedAt to the scheduled time
    publishedAt = new Date(parseInt(finalScheduledFor) * 1000);
  }

  return {
    status,
    isScheduled,
    isDraft,
    publishedAt,
    nostrEventId,
    finalScheduledFor: finalScheduledFor ?? null,
  };
}
