import type React from "react";

import { isPollPostItem } from "~/features/polls";
import { getQueueColorBundle } from "~/features/posts/queue-colors";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowUTC,
  toDate,
} from "~/lib/temporal";

import type {
  CalendarPost,
  QueueColorStyle,
  QueueType,
} from "./PostBlock.types";
const DEFAULT_PREVIEW_MAX_LENGTH = 30;

function truncatePreview(text: string, maxLength: number): string {
  const len = Math.max(1, maxLength);
  const addEllipsis = len <= DEFAULT_PREVIEW_MAX_LENGTH;
  return text.length > len
    ? text.substring(0, len) + (addEllipsis ? "..." : "")
    : text;
}

function getMediaFallbackLabel(
  postType: string | undefined,
  isRepost: boolean
): string {
  if (postType === "VIDEO" || postType === "CAROUSEL") {
    return isRepost ? "Repost (media)" : "Media post";
  }
  return isRepost ? "Repost (image)" : "Image post";
}

export function getPostPreview(
  post: CalendarPost,
  isLongform: boolean,
  maxLength: number = DEFAULT_PREVIEW_MAX_LENGTH
): string {
  const len = Math.max(1, maxLength);

  if (isLongform) {
    if (post.title) return truncatePreview(post.title, len);
    return "Article";
  }

  if (
    isPollPostItem({
      type: "post",
      postType: post.postType,
      signedEvent: post.signedEvent ?? undefined,
    })
  ) {
    const q =
      post.signedEvent &&
      typeof post.signedEvent.content === "string" &&
      post.signedEvent.content.trim()
        ? post.signedEvent.content.trim()
        : (post.content?.trim() ?? post.caption?.trim() ?? "Poll");
    return truncatePreview(`Poll: ${q}`, len);
  }

  if (post.caption) return truncatePreview(post.caption, len);

  const isRepost = post.repost === true || post.postKind === "REPOST";
  if (post.fileUrl.length > 0) {
    return getMediaFallbackLabel(post.postType, isRepost);
  }

  return isRepost ? "Repost" : "Text post";
}

export function getFirstImage(
  post: CalendarPost,
  isLongform: boolean
): string | null {
  if (isLongform) {
    return post.image ?? null;
  }

  if (post.fileUrl.length > 0) {
    try {
      // Handle both JSON array format and direct URL format
      const firstFileUrl = post.fileUrl[0];
      if (typeof firstFileUrl === "string") {
        // Try to parse as JSON array first
        try {
          const parsed = JSON.parse(firstFileUrl) as string[] | string;
          const url = Array.isArray(parsed) ? parsed[0] : firstFileUrl;
          return url ?? null;
        } catch {
          // If parsing fails, treat as direct URL
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: firstFileUrl may be undefined if array is empty
          return firstFileUrl ?? null;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: firstFileUrl may be undefined if array is empty
      return firstFileUrl ?? null;
    } catch (error) {
      handleErrorSafely(error, {
        component: "PostBlock",
        action: "getFirstImage",
      });
      return null;
    }
  }
  return null;
}

export function getStatusColor(
  post: CalendarPost,
  isLongform: boolean,
  isPast: boolean
): string {
  // Past posts get grayed out styling regardless of other conditions
  if (isPast) {
    return "bg-surface-hover text-text-secondary opacity-60";
  }

  if (isLongform) {
    if (post.signedEvent) {
      return "bg-success/10 text-success dark:text-success";
    }
    return "bg-surface-hover text-text";
  }

  // Fallback to original logic for regular posts
  const wasAutoScheduled = !post.manual_override;

  if (post.signedEvent) {
    return wasAutoScheduled
      ? "bg-surface-hover text-text-secondary"
      : "bg-surface-hover text-text-secondary";
  }

  return "bg-surface-hover text-text";
}

/** Opacity for past (older) posts so they stay queue-colored but visually recede (same idea as Queue Health without hover). */
const PAST_POST_QUEUE_OPACITY = 0.65;

/**
 * Queue color base, surface tint, text color, border logic — locked system-wide for calendar.
 * Derives from getQueueColorBundle; no random color math in components.
 */
export function getQueueColorStyle(
  post: CalendarPost,
  queueTypes: QueueType[] | undefined,
  isLongform: boolean,
  isPast: boolean,
  /** When true, past posts render at full opacity (e.g. when expanded in weekly view). */
  forceOpaque?: boolean
): QueueColorStyle | null {
  // Longform posts don't have queue types
  if (isLongform) {
    return null;
  }

  let token: string | null = null;
  if (post.queueType && queueTypes) {
    const queueTypeData = queueTypes.find(
      (qt) =>
        (qt.id && post.queueType?.id && qt.id === post.queueType.id) ??
        (qt.name && post.queueType?.name === qt.name)
    );
    token =
      (queueTypeData as { colorToken?: string | null } | undefined)
        ?.colorToken ??
      (post.queueType as { colorToken?: string | null }).colorToken ??
      null;
  } else if (post.queueType) {
    token =
      (post.queueType as { colorToken?: string | null }).colorToken ?? null;
  }

  if (token) {
    const bundle = getQueueColorBundle(
      token as Parameters<typeof getQueueColorBundle>[0]
    );
    return {
      backgroundColor: bundle.surface,
      color: bundle.accent,
      borderColor: bundle.accent,
      ...(isPast && !forceOpaque ? { opacity: PAST_POST_QUEUE_OPACITY } : {}),
    };
  }

  // Unassigned: same greys as Next 7 days — lighter by default (opacity-65 equivalent), darker on hover/focus/touch (opacity-100)
  const unassignedBgDefault = "hsl(var(--muted-foreground) / 0.36)";
  const unassignedBgHover = "hsl(var(--muted-foreground) / 0.55)";
  return {
    backgroundColor: unassignedBgDefault,
    color: "hsl(var(--muted-foreground))",
    borderColor: "transparent",
    isUnassigned: true,
    hoverBackgroundColor: unassignedBgHover,
    ...(isPast && !forceOpaque ? { opacity: 0.6 } : {}),
  };
}

/** Unassigned blocks: class for background that transitions to darker grey on hover/focus/active. */
export const UNASSIGNED_BG_CLASS =
  "bg-[var(--calendar-unassigned-bg)] hover:bg-[var(--calendar-unassigned-bg-hover)] focus:bg-[var(--calendar-unassigned-bg-hover)] active:bg-[var(--calendar-unassigned-bg-hover)] motion-base";

/**
 * Style and optional class for applying QueueColorStyle to a block (handles unassigned hover state).
 */
export function getQueueColorStyleProps(style: QueueColorStyle | null): {
  style: React.CSSProperties;
  unassignedBgClass: string;
} {
  if (!style) return { style: {}, unassignedBgClass: "" };
  const isUnassigned =
    style.isUnassigned === true && style.hoverBackgroundColor;
  if (isUnassigned) {
    const styleObj: React.CSSProperties = {
      ["--calendar-unassigned-bg" as string]: style.backgroundColor,
      ["--calendar-unassigned-bg-hover" as string]: style.hoverBackgroundColor,
      color: style.color,
      ...(style.opacity != null ? { opacity: style.opacity } : {}),
    };
    return {
      style: styleObj,
      unassignedBgClass: UNASSIGNED_BG_CLASS,
    };
  }
  return {
    style: {
      backgroundColor: style.backgroundColor,
      color: style.color,
      ...(style.opacity != null ? { opacity: style.opacity } : {}),
    },
    unassignedBgClass: "",
  };
}

/**
 * Normalize publishedAt (string, Date, or number) to a Date in UTC.
 * Used so we don't fall back to "current time" when publishedAt is a Date object.
 */
function publishedAtToDate(
  publishedAt: string | Date | number | null | undefined
): Date | null {
  if (publishedAt == null) return null;
  try {
    if (typeof publishedAt === "string") {
      const zoned = fromDate(new Date(publishedAt), "UTC");
      return toDate(zoned);
    }
    if (publishedAt instanceof Date) {
      const zoned = fromDate(publishedAt, "UTC");
      return toDate(zoned);
    }
    if (typeof publishedAt === "number") {
      const zoned = fromUnixTimestamp(publishedAt, "UTC");
      return toDate(zoned);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Single source of truth for post schedule instant (epoch milliseconds).
 * Used for grid slot assignment and display time so they stay in sync.
 * Handles scheduledFor as numeric string (Unix seconds) or ISO string.
 */
export function getPostScheduleInstant(
  post: CalendarPost,
  isLongform: boolean,
  isPast: boolean
): number | null {
  try {
    if (isPast || isLongform) {
      const date = publishedAtToDate(post.publishedAt);
      return date ? date.getTime() : null;
    }
    const scheduledFor = post.scheduledFor;
    if (scheduledFor == null) return null;
    if (typeof scheduledFor === "string") {
      const numeric = Number(scheduledFor);
      if (!Number.isNaN(numeric)) {
        const zoned = fromUnixTimestamp(numeric, "UTC");
        return toDate(zoned).getTime();
      }
      try {
        const zoned = fromISOString(scheduledFor, "UTC");
        return toDate(zoned).getTime();
      } catch {
        const date = new Date(scheduledFor);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getDisplayTime(
  post: CalendarPost,
  isLongform: boolean,
  isPast: boolean
): Date {
  const ms = getPostScheduleInstant(post, isLongform, isPast);
  if (ms != null) return new Date(ms);
  return toDate(nowUTC());
}
