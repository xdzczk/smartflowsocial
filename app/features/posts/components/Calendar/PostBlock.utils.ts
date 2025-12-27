import { handleErrorSafely } from "~/lib/error-handler.client";

import type { CalendarPost, QueueColorStyle, QueueType } from "./PostBlock.types";
export function getPostPreview(post: CalendarPost, isLongform: boolean): string {
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
  if (post.fileUrl && post.fileUrl.length > 0) {
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

export function getFirstImage(post: CalendarPost, isLongform: boolean): string | null {
  if (isLongform) {
    return post.image || null;
  }

  if (post.fileUrl && post.fileUrl.length > 0) {
    try {
      // Handle both JSON array format and direct URL format
      const firstFileUrl = post.fileUrl[0];
      if (typeof firstFileUrl === "string") {
        // Try to parse as JSON array first
        try {
          const parsed = JSON.parse(firstFileUrl) as string[] | string;
          const url = Array.isArray(parsed) ? parsed[0] : firstFileUrl;
          return url;
        } catch {
          // If parsing fails, treat as direct URL
          return firstFileUrl;
        }
      }
      return firstFileUrl as string;
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

export function getStatusColor(post: CalendarPost, isLongform: boolean, isPast: boolean): string {
  // Past posts get grayed out styling regardless of other conditions
  if (isPast) {
    return "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-600 opacity-60";
  }

  if (isLongform) {
    if (post.signedEvent) {
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }

  // Fallback to original logic for regular posts
  const wasAutoScheduled = !post.manual_override;

  if (post.signedEvent) {
    return wasAutoScheduled
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
  }

  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
}

export function getQueueColorStyle(
  post: CalendarPost,
  queueTypes: QueueType[] | undefined,
  isLongform: boolean,
  isPast: boolean,
): QueueColorStyle | null {
  // Past posts get grayed styling regardless of queue color
  if (isPast) {
    return {
      backgroundColor: "#f9fafb",
      color: "#9ca3af",
      borderColor: "#e5e7eb",
      opacity: 0.6,
    };
  }

  // Longform posts don't have queue types
  if (isLongform) {
    return null;
  }

  // First try to use queue color if available
  if (post.queueType && queueTypes && Array.isArray(queueTypes)) {
    const queueTypeData = queueTypes.find(
      (qt) =>
        (qt.id && post.queueType?.id && qt.id === post.queueType.id) ||
        (qt.name && post.queueType?.name && qt.name === post.queueType.name),
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
  isPast: boolean,
): Date {
  if (isPast) {
    return isLongform
      ? new Date(post.postedAt as string)
      : new Date(post.postedAt as string);
  } else {
    return isLongform
      ? new Date(post.publishedAt as string)
      : new Date(Number(post.scheduledFor) * 1000);
  }
}






