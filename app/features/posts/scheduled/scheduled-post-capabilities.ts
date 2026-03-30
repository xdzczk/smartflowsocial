/**
 * Central rules for scheduled post actions — same on Dashboard, Calendar, Scheduled.
 */

import type { ScheduledPostEntityKind } from "./scheduled-post-view-model";

export interface ScheduledPostCapabilitiesInput {
  entityKind: ScheduledPostEntityKind;
  postKind?: string | null;
  repost?: boolean | null;
  isQuotedPost?: boolean | null;
}

export interface ScheduledPostCapabilities {
  canEditContent: boolean;
  canReschedule: boolean;
  canDelete: boolean;
  /** Nostr re-sign when time/queue changes */
  requiresResignOnScheduleChange: boolean;
  /** Nostr re-sign when caption/media/tags change */
  requiresResignOnContentChange: boolean;
}

/**
 * Pure repost (kind REPOST or repost flag without quote) — no meaningful caption/media edit.
 */
function isPureRepost(input: ScheduledPostCapabilitiesInput): boolean {
  if (input.entityKind === "longform") return false;
  if (input.isQuotedPost) return false;
  if (input.postKind === "REPOST") return true;
  return input.repost === true;
}

export function getScheduledPostCapabilities(
  input: ScheduledPostCapabilitiesInput
): ScheduledPostCapabilities {
  const isLongform = input.entityKind === "longform";
  const pureRepost = isPureRepost(input);

  return {
    canEditContent: isLongform || !pureRepost,
    canReschedule: true,
    canDelete: true,
    requiresResignOnScheduleChange: true,
    requiresResignOnContentChange: true,
  };
}
