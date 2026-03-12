/**
 * Pure helpers and types for the bulk composer modal.
 */

import type { User } from "~/features/user";
import type { UserData } from "~/lib/validation/user-data";

export type BulkComposerMode = "recycle" | "repost" | "quote" | "reschedule";

/** User shape accepted by bulk composer; full User is used internally for the hook. */
export type BulkComposerUser =
  | User
  | UserData
  | {
      id?: string;
      timezone?: string | null;
      scheduleInterval?: number[];
      timeFormat?: "12h" | "24h" | null;
    };

export function getModalTitle(mode: BulkComposerMode): string {
  switch (mode) {
    case "recycle":
      return "Recycle & Schedule Posts";
    case "repost":
      return "Schedule Reposts (Kind 6)";
    case "quote":
      return "Schedule Quote Posts";
    case "reschedule":
      return "Edit & Reschedule Posts";
    default:
      return "Bulk Schedule Posts";
  }
}

export function isRepostOrQuote(mode: BulkComposerMode): boolean {
  return mode === "repost" || mode === "quote";
}
