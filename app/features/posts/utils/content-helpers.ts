/**
 * Helper functions for content listing components
 */

import type { SignedEvent } from "~/features/nostr/types";
import { isPollPostItem } from "~/features/polls";
import {
  deriveIsDraftLongForm,
  deriveIsScheduledLongForm,
  deriveIsPublishedLongForm,
  getStatusTextFromStateLongForm,
} from "~/features/posts/longform/state-machine/longform-post-state";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  formatForDisplay,
  type DateDisplayLocale,
  type Temporal,
} from "~/lib/temporal";

import type { CombinedContent } from "../combined.server";
import {
  getQueueColor,
  getQueueColorBundle,
  QUEUE_PILL_OPACITY_CLASS,
  QUEUE_PILL_SHAPE_CLASS,
} from "../queue-colors";
import {
  deriveIsDraft,
  deriveIsScheduled,
  deriveIsPublished,
  getStatusTextFromState,
} from "../state-machine/post-state";
import type { PostData } from "../types";

import { isPureRepostSourcePost } from "./repost-chain-policy";

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
const STATUS_OUTLINE_BASE = "border bg-transparent dark:border-transparent";
const STATUS_BORDER_DEFAULT = "border-border";
const STATUS_DARK_BG_MUTED = "dark:bg-muted";

const DRAFT_COLOR = `${STATUS_OUTLINE_BASE} ${STATUS_BORDER_DEFAULT} text-foreground ${STATUS_DARK_BG_MUTED} dark:text-foreground`;
const PUBLISHED_COLOR = `${STATUS_OUTLINE_BASE} border-success text-success dark:bg-success/20 dark:text-success`;
const SCHEDULED_COLOR = `${STATUS_OUTLINE_BASE} ${STATUS_BORDER_DEFAULT} text-muted-foreground ${STATUS_DARK_BG_MUTED} dark:text-muted-foreground`;

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
      if (deriveIsPublished(state)) {
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

  return "border border-border bg-transparent text-muted-foreground dark:bg-muted dark:text-muted-foreground dark:border-transparent";
}

const STATUS_TONE_MUTED = "text-muted-foreground";

/** Text-only classes for lifecycle status (distinct from queue chips). */
export function getStatusTextToneClass(item: CombinedContent): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- originalData may be absent on partial test fixtures
  const currentState = item.currentState ?? item.originalData?.currentState;

  if (currentState) {
    const state = currentState;

    if (item.type === "longform") {
      if (deriveIsDraftLongForm(state)) return "text-foreground";
      if (deriveIsPublishedLongForm(state)) return "text-success";
      if (deriveIsScheduledLongForm(state)) return STATUS_TONE_MUTED;
    } else {
      if (deriveIsDraft(state)) return "text-foreground";
      if (deriveIsPublished(state)) return "text-success";
      if (deriveIsScheduled(state)) return STATUS_TONE_MUTED;
    }

    if (state === "FAILED") return "text-destructive";
    if (state === "CANCELLED") return STATUS_TONE_MUTED;
  }

  return STATUS_TONE_MUTED;
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
  timeFormat?: "12h" | "24h" | null,
  dateLocale?: DateDisplayLocale
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
      timeFormat,
      dateLocale ?? "en-GB"
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
      timeFormat,
      dateLocale ?? "en-GB"
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
  const colorToken = (queueType as { colorToken?: string | null } | undefined)
    ?.colorToken;

  if (colorToken) {
    const bundle = getQueueColorBundle(colorToken);
    return {
      className: `${QUEUE_PILL_SHAPE_CLASS} ${QUEUE_PILL_OPACITY_CLASS}`,
      style: {
        backgroundColor: bundle.surface,
        color: bundle.accent,
        borderColor: bundle.accent,
      },
      name,
    };
  }

  const colors = getQueueColor(name, colorToken);
  return {
    className: `${QUEUE_PILL_SHAPE_CLASS} ${QUEUE_PILL_OPACITY_CLASS} ${colors.bg} ${colors.text} ${colors.border}`,
    name,
  };
}

const POST_KIND_BADGE_CLASS =
  "inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground dark:text-foreground";

/**
 * True if the post is a repost (kind 6). Quotes are treated as normal posts (posts with links to other content).
 * Used to show Reposts as a separate category from Posts.
 */
export function isRepostPost(post: PostData): boolean {
  const kind =
    "postKind" in post && typeof post.postKind === "string"
      ? post.postKind
      : (post as { postKind?: string }).postKind;
  return kind === "REPOST";
}

/**
 * True when the row is a pure Nostr repost (not a quote). Repost/quote actions must not target these.
 */
export function isPureRepostSourceContent(item: CombinedContent): boolean {
  if (item.type !== "post") return false;
  const od = item.originalData as PostData;
  return isPureRepostSourcePost({
    postKind: item.postKind ?? od.postKind,
    repost: item.repost ?? od.repost,
    isQuotedPost: item.isQuotedPost ?? od.isQuotedPost,
  });
}

/**
 * True if the combined content item is a repost (REPOST only). Quotes are normal posts for filtering.
 */
export function isRepostContent(item: CombinedContent): boolean {
  if (item.type !== "post") return false;
  const kind =
    item.postKind ??
    (item.originalData as { postKind?: string } | undefined)?.postKind;
  return kind === "REPOST";
}

/**
 * Center label for list/table thumbnails when there is no image (or image fallback).
 * Matches calendar/flow semantics: polls use POLL, not TEXT.
 */
export function getPostRowThumbnailBadge(input: {
  contentKind: "post" | "longform";
  postType?: string;
  /** Full event or minimal shape from table rows (poll check uses `kind` only). */
  signedEvent?: SignedEvent | { kind?: number } | null;
  repost?: boolean;
  postKind?: string | null;
}): "REPOST" | "POLL" | "TEXT" | "ART" {
  if (input.contentKind === "longform") return "ART";
  if (input.repost === true || input.postKind === "REPOST") return "REPOST";
  if (
    isPollPostItem({
      type: "post",
      postType: input.postType,
      signedEvent: input.signedEvent ?? undefined,
    })
  ) {
    return "POLL";
  }
  return "TEXT";
}

export function getContentTypeBadge(item: CombinedContent): {
  className: string;
  text: string;
} {
  // Prefer postKind when present (single source for "what is this post?")
  const postKind =
    item.postKind ??
    (item.originalData as { postKind?: string } | undefined)?.postKind;
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
    return { className: POST_KIND_BADGE_CLASS, text: "ARTICLE" };
  }

  if (
    item.type === "post" &&
    isPollPostItem({
      type: "post",
      postType: item.postType,
      signedEvent: item.signedEvent ?? undefined,
    })
  ) {
    return { className: POST_KIND_BADGE_CLASS, text: "POLL" };
  }

  // Default: uniform badge (same size/color as REPOST)
  return {
    className: POST_KIND_BADGE_CLASS,
    text: item.type === "post" ? "POST" : "Article",
  };
}
