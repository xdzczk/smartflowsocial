import { handleErrorSafely } from "~/lib/error-handler.client";
import { fromDate, fromUnixTimestamp, nowUTC, toDate } from "~/lib/temporal";

import type {
  CalendarPost,
  QueueColorStyle,
  QueueType,
} from "./PostBlock.types";
export function getPostPreview(
  post: CalendarPost,
  isLongform: boolean
): string {
  if (isLongform) {
    if (post.title) {
      return post.title.length > 30
        ? post.title.substring(0, 30) + "..."
        : post.title;
    }
    return "Longform post";
  }

  if (post.caption) {
    return post.caption.length > 30
      ? post.caption.substring(0, 30) + "..."
      : post.caption;
  }

  // Check postType to provide accurate labels
  if (post.fileUrl.length > 0) {
    if (post.postType === "VIDEO") {
      return "Media post";
    } else if (post.postType === "CAROUSEL") {
      return "Media post";
    } else {
      return "Image post";
    }
  }

  return "Text post";
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
    return "bg-muted text-muted-foreground opacity-60";
  }

  if (isLongform) {
    if (post.signedEvent) {
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    }
    return "bg-secondary text-secondary-foreground";
  }

  // Fallback to original logic for regular posts
  const wasAutoScheduled = !post.manual_override;

  if (post.signedEvent) {
    return wasAutoScheduled
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-muted-foreground";
  }

  return "bg-secondary text-secondary-foreground";
}

export function getQueueColorStyle(
  post: CalendarPost,
  queueTypes: QueueType[] | undefined,
  isLongform: boolean,
  isPast: boolean
): QueueColorStyle | null {
  // Past posts get grayed styling regardless of queue color
  if (isPast) {
    return {
      backgroundColor: "hsl(var(--muted))",
      color: "hsl(var(--muted-foreground))",
      borderColor: "hsl(var(--border))",
      opacity: 0.6,
    };
  }

  // Longform posts don't have queue types
  if (isLongform) {
    return null;
  }

  // First try to use queue color if available
  if (post.queueType && queueTypes) {
    const queueTypeData = queueTypes.find(
      (qt) =>
        (qt.id && post.queueType?.id && qt.id === post.queueType.id) ??
        (qt.name && post.queueType?.name === qt.name)
    );
    if (queueTypeData?.color) {
      return {
        backgroundColor: `${queueTypeData.color}20`,
        color: queueTypeData.color,
        borderColor: queueTypeData.color,
      };
    }
  }

  // Fallback: try to use the color directly from post.queueType if it exists
  if (post.queueType?.color) {
    return {
      backgroundColor: `${post.queueType.color}20`,
      color: post.queueType.color,
      borderColor: post.queueType.color,
    };
  }

  return null;
}

export function getDisplayTime(
  post: CalendarPost,
  isLongform: boolean,
  isPast: boolean
): Date {
  try {
    if (isPast) {
      const postedAt = post.postedAt;
      if (typeof postedAt === "string") {
        const zoned = fromDate(new Date(postedAt), "UTC");
        return toDate(zoned);
      }
      // Use Temporal for consistency even in fallback
      return toDate(nowUTC());
    } else {
      if (isLongform) {
        const publishedAt = post.publishedAt;
        if (typeof publishedAt === "string") {
          const zoned = fromDate(new Date(publishedAt), "UTC");
          return toDate(zoned);
        }
        // Use Temporal for consistency even in fallback
        return toDate(nowUTC());
      } else {
        const scheduledFor = post.scheduledFor;
        if (typeof scheduledFor === "string") {
          const timestamp = Number(scheduledFor);
          if (!isNaN(timestamp)) {
            const zoned = fromUnixTimestamp(timestamp, "UTC");
            return toDate(zoned);
          }
        }
        // Use Temporal for consistency even in fallback
        return toDate(nowUTC());
      }
    }
  } catch {
    // Final fallback - still use Temporal
    try {
      return toDate(nowUTC());
    } catch {
      // Final fallback - still use Temporal
      return toDate(nowUTC());
    }
  }
}
