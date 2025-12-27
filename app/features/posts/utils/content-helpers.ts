/**
 * Helper functions for content listing components
 */

import type { CombinedContent } from "~/features/posts/combined.server";
import { getQueueColor } from "~/features/posts/queueColors";
import { handleErrorSafely } from "~/lib/error-handler.client";

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

export function getContentTitle(item: CombinedContent): string {
  if (item.type === "longform") {
    return item.title || "Untitled Article";
  }
  return item.caption?.length && item.caption.length > 50
    ? item.caption.substring(0, 50) + "..."
    : item.caption || "No caption";
}

export function getContentPreview(item: CombinedContent): string | null {
  if (item.type === "longform") {
    return (
      item.summary ||
      (item.content?.length && item.content.length > 100
        ? item.content.substring(0, 100) + "..."
        : item.content) ||
      "No content"
    );
  }
  return null; // Posts show caption in title column
}

export function getStatusColor(item: CombinedContent): string {
  if (item.draft) {
    return "bg-orange-100 text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200";
  }
  if (item.isPosted || item.isPublished) {
    return "bg-green-100 text-green-900 dark:border-green-900/75 dark:bg-green-700/10 dark:text-green-200";
  }
  if (item.isScheduled) {
    return "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200";
  }
  return "bg-gray-100 text-gray-900 dark:border-gray-900/75 dark:bg-gray-700/10 dark:text-gray-200";
}

export function getStatusText(item: CombinedContent): string {
  if (item.draft) return "Draft";
  if (item.isPosted || item.isPublished) return "Posted";
  if (item.isScheduled) return "Scheduled";
  return "Unknown";
}

export function formatDate(
  date: Date | string | undefined,
  isUnixTimestamp = false,
  userTimezone?: string,
): string {
  if (!date) return "-";

  let dateObj: Date;
  if (isUnixTimestamp && typeof date === "string") {
    dateObj = new Date(parseInt(date) * 1000);
  } else {
    dateObj = new Date(date);
  }

  return dateObj.toLocaleString("en-US", {
    timeZone: userTimezone || "UTC",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getQueueTypeDisplay(
  queueType: CombinedContent["queueType"],
): { className: string; style?: React.CSSProperties; name: string } {
  const name = queueType?.name ?? "unassigned";

  if (queueType?.color) {
    return {
      className: "inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm",
      style: {
        backgroundColor: `${queueType.color}20`,
        color: queueType.color,
        borderColor: queueType.color,
      },
      name,
    };
  }

  const colors = getQueueColor(name);
  return {
    className: `inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${colors.bg} ${colors.text} ${colors.border} shadow-sm`,
    name,
  };
}

export function getContentTypeBadge(item: CombinedContent): {
  className: string;
  text: string;
} {
  // Check for kind property in signedEvent or originalData.signedEvent
  const kind =
    item.signedEvent?.kind ||
    item.originalData?.signedEvent?.kind;

  if (kind === 6) {
    return {
      className: "inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      text: "REPOST",
    };
  } else if (kind === 30023) {
    return {
      className: "inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      text: "LONG-FORM",
    };
  } else {
    // Default behavior for other types
    return {
      className: `inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        item.type === "post"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      }`,
      text: item.type === "post" ? "Post" : "Article",
    };
  }
}




