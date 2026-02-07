/**
 * Helper functions for content listing components
 */

import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  formatForDisplay,
  type Temporal,
} from "~/lib/temporal";

import type { CombinedContent } from "../combined.server";
import { getQueueColor } from "../queue-colors";
import {
  deriveIsDraftLongForm,
  deriveIsScheduledLongForm,
  deriveIsPublishedLongForm,
  getStatusTextFromStateLongForm,
} from "../state-machine/longform-post-state";
import {
  deriveIsDraft,
  deriveIsScheduled,
  deriveIsPosted,
  getStatusTextFromState,
} from "../state-machine/post-state";

export function getImageUrls(fileUrl: string[] | undefined): string[] {
  if (!fileUrl || fileUrl.length === 0) return [];

  if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
    try {
      return JSON.parse(fileUrl[0]) as string[];
    } catch (e) {
      handleErrorSafely(e, {
        component: "AllContentListing",
        action: "parseFileUrl",
      });
      return [];
    }
  }

  return fileUrl;
}

/** Returns up to `max` media URLs for preview (e.g. Flow Card / list card thumbnails). Longform: single image; posts: from fileUrl. */
export function getMediaPreviewUrls(item: CombinedContent, max = 4): string[] {
  if (item.type === "longform") {
    return item.image ? [item.image].slice(0, max) : [];
  }
  return getImageUrls(item.fileUrl).slice(0, max);
}

export function getContentTitle(item: CombinedContent): string {
  if (item.type === "longform") {
    return item.title ?? "Untitled Article";
  }
  return item.caption?.length && item.caption.length > 50
    ? item.caption.substring(0, 50) + "..."
    : (item.caption ?? "No caption");
}

export function getContentPreview(item: CombinedContent): string | null {
  if (item.type === "longform") {
    return (
      item.summary ??
      (item.content?.length && item.content.length > 100
        ? item.content.substring(0, 100) + "..."
        : item.content) ??
      "No content"
    );
  }
  return null; // Posts show caption in title column
}

// Status color constants - neutral outline style for light mode
const DRAFT_COLOR =
  "border border-border bg-transparent text-foreground dark:bg-muted dark:text-foreground dark:border-transparent";
const PUBLISHED_COLOR =
  "border border-success bg-transparent text-success dark:bg-success/20 dark:text-success dark:border-transparent";
const SCHEDULED_COLOR =
  "border border-border bg-transparent text-muted-foreground dark:bg-muted dark:text-muted-foreground dark:border-transparent";

export function getStatusColor(item: CombinedContent): string {
  // Use currentState as single source of truth
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Optional chaining needed for runtime safety (tests may create incomplete objects)
  const currentState = item.currentState ?? item.originalData?.currentState;

  if (currentState) {
    // Use state machine as source of truth
    const state = currentState;

    // Use appropriate derive functions based on post type
    if (item.type === "longform") {
      if (deriveIsDraftLongForm(state)) {
        return DRAFT_COLOR;
      }
      if (deriveIsPublishedLongForm(state)) {
        return PUBLISHED_COLOR;
      }
      if (deriveIsScheduledLongForm(state)) {
        return SCHEDULED_COLOR;
      }
    } else {
      if (deriveIsDraft(state)) {
        return DRAFT_COLOR;
      }
      if (deriveIsPosted(state)) {
        return PUBLISHED_COLOR;
      }
      if (deriveIsScheduled(state)) {
        return SCHEDULED_COLOR;
      }
    }

    if (state === "FAILED") {
      return "border border-destructive bg-transparent text-destructive dark:bg-destructive/20 dark:text-destructive dark:border-transparent";
    }
    if (state === "CANCELLED") {
      return "border border-border bg-transparent text-muted-foreground dark:bg-muted dark:text-muted-foreground dark:border-transparent";
    }
  }

  return "border border-gray-300 bg-transparent text-gray-700 dark:bg-muted dark:text-muted-foreground dark:border-transparent";
}

export function getStatusText(item: CombinedContent): string {
  // Use currentState as single source of truth
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Optional chaining needed for runtime safety (tests may create incomplete objects)
  const currentState = item.currentState ?? item.originalData?.currentState;

  if (currentState) {
    // Use appropriate function based on post type
    if (item.type === "longform") {
      return getStatusTextFromStateLongForm(currentState);
    }
    return getStatusTextFromState(currentState);
  }

  return "Unknown";
}

const DATE_FORMAT_OPTIONS = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  // hour12 is determined dynamically based on timeFormat parameter
} as const;

/**
 * Convert date input to Temporal ZonedDateTime
 */
function convertToZonedDateTime(
  date: Date | string,
  isUnixTimestamp: boolean,
  timezone: string
): Temporal.ZonedDateTime | null {
  try {
    if (isUnixTimestamp && typeof date === "string") {
      return fromUnixTimestamp(parseInt(date), timezone);
    }
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return fromDate(dateObj, timezone);
  } catch {
    return null;
  }
}

/**
 * Convert date input to Temporal ZonedDateTime with fallback
 */
function convertToZonedDateTimeWithFallback(
  date: Date | string,
  isUnixTimestamp: boolean,
  timezone: string
): Temporal.ZonedDateTime | null {
  const zoned = convertToZonedDateTime(date, isUnixTimestamp, timezone);
  if (zoned) return zoned;

  // Fallback - try alternative parsing
  try {
    if (isUnixTimestamp && typeof date === "string") {
      return fromUnixTimestamp(parseInt(date), timezone);
    }
    if (typeof date === "string") {
      return fromISOString(date, timezone);
    }
    return fromDate(date, timezone);
  } catch {
    return null;
  }
}

export function formatDate(
  date: Date | string | undefined,
  isUnixTimestamp = false,
  userTimezone?: string,
  timeFormat?: "12h" | "24h" | null
): string {
  if (!date) return "-";

  // Handle invalid Date objects (NaN)
  if (date instanceof Date && isNaN(date.getTime())) {
    return "-";
  }

  const timezone = userTimezone ?? "UTC";
  const zonedDateTime = convertToZonedDateTime(date, isUnixTimestamp, "UTC");

  if (zonedDateTime) {
    return formatForDisplay(
      zonedDateTime,
      timezone,
      DATE_FORMAT_OPTIONS,
      timeFormat
    );
  }

  // Fallback - still use Temporal for consistency
  const fallbackZoned = convertToZonedDateTimeWithFallback(
    date,
    isUnixTimestamp,
    timezone
  );
  if (fallbackZoned) {
    return formatForDisplay(
      fallbackZoned,
      timezone,
      DATE_FORMAT_OPTIONS,
      timeFormat
    );
  }

  // Final fallback
  return "-";
}

export function getQueueTypeDisplay(queueType: CombinedContent["queueType"]): {
  className: string;
  style?: React.CSSProperties;
  name: string;
} {
  const name = queueType?.name ?? "unassigned";

  if (queueType?.color) {
    return {
      className:
        "inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm",
      style: {
        backgroundColor: `${queueType.color}20`,
        color: queueType.color,
        borderColor: queueType.color,
      },
      name,
    };
  }

  const colors = getQueueColor(name);
  // getQueueColor always returns a value (has fallback to "unassigned")
  const safeColors = colors ?? getQueueColor("unassigned");
  if (!safeColors) {
    // This should never happen, but TypeScript needs this check
    return {
      className: `inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm`,
      name,
    };
  }
  return {
    className: `inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${safeColors.bg} ${safeColors.text} ${safeColors.border} shadow-sm`,
    name,
  };
}

const POST_KIND_BADGE_CLASS =
  "inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground dark:text-foreground";

export function getContentTypeBadge(item: CombinedContent): {
  className: string;
  text: string;
} {
  // Prefer postKind when present (single source for "what is this post?")
  const postKind =
    item.postKind ?? (item.originalData as { postKind?: string }).postKind;
  if (postKind === "REPOST") {
    return { className: POST_KIND_BADGE_CLASS, text: "REPOST" };
  }
  if (postKind === "QUOTE") {
    return { className: POST_KIND_BADGE_CLASS, text: "QUOTE" };
  }
  if (postKind === "THREAD") {
    return { className: POST_KIND_BADGE_CLASS, text: "THREAD" };
  }
  if (postKind === "REPLY") {
    return { className: POST_KIND_BADGE_CLASS, text: "REPLY" };
  }

  // Fallback: check signedEvent.kind (e.g. kind 6 = repost)
  const kind =
    item.signedEvent?.kind ??
    (typeof item.originalData === "object" &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check needed: typeof null === "object" in JavaScript
    item.originalData !== null &&
    "signedEvent" in item.originalData
      ? (item.originalData as { signedEvent?: { kind?: number } }).signedEvent
          ?.kind
      : undefined);

  if (kind === 6) {
    return { className: POST_KIND_BADGE_CLASS, text: "REPOST" };
  }
  if (kind === 30023) {
    return {
      className:
        "inline-flex rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent-foreground",
      text: "LONG-FORM",
    };
  }

  // Default: postType for content shape, or "Post" / "Article"
  return {
    className: `inline-flex rounded-full px-2 py-1 text-xs font-medium ${
      item.type === "post"
        ? "bg-muted text-muted-foreground"
        : "bg-muted text-muted-foreground"
    }`,
    text: item.type === "post" ? "Post" : "Article",
  };
}
