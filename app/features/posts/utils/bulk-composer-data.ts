/**
 * Helpers to convert server / session data into BulkPost[] for the bulk composer (page or modal).
 */

import { formatForDateTimeLocal, fromDate } from "~/lib/temporal";

import type { BulkPost } from "../types";

import { createBulkPostClientId } from "./client-id";

export interface RepostDataItem {
  fileUrl?: string | string[];
  caption?: string;
  queueType?: string;
  scheduledFor?: string;
  isRecyclable?: boolean;
  originalPostId?: string;
}

export interface ScheduledRepostDataItem {
  caption?: string;
  queueType?: string;
  scheduledFor?: string;
  originalPostId?: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  isRecyclable?: boolean;
}

export interface QuotePostDataItem {
  fileUrl?: string | string[];
  caption?: string;
  queueType?: string;
  scheduledFor?: string;
  isQuotePost?: boolean;
  isLongformQuote?: boolean;
  naddr?: string;
  originalPostId?: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  originalCaption?: string;
  originalTitle?: string;
  isRecyclable?: boolean;
}

interface OriginalPost {
  id: string;
  fileUrl?: string | string[];
  caption?: string;
}

function normalizeFileUrl(
  fileUrl: string | string[] | undefined
): string | undefined {
  if (typeof fileUrl === "string") {
    try {
      const parsed = JSON.parse(fileUrl) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch {
      // keep as is
    }
    return fileUrl.trim() ? fileUrl : undefined;
  }
  if (Array.isArray(fileUrl) && fileUrl.length > 0) {
    return fileUrl[0];
  }
  return undefined;
}

export function convertRepostDataToBulkPosts(
  items: RepostDataItem[]
): BulkPost[] {
  return items.map((item) => {
    const fileUrl = normalizeFileUrl(item.fileUrl);
    return {
      clientId: createBulkPostClientId(),
      files: [],
      caption: item.caption ?? "",
      queueType: item.queueType ?? "unassigned",
      scheduledFor: item.scheduledFor ?? "",
      fileUrl,
      isRepost: true,
      isRecyclable: item.isRecyclable ?? false,
      originalPostId: item.originalPostId,
    };
  });
}

export function convertQuoteDataToBulkPosts(
  items: QuotePostDataItem[]
): BulkPost[] {
  return items.map((item) => {
    const fileUrl = normalizeFileUrl(item.fileUrl);
    return {
      clientId: createBulkPostClientId(),
      files: [],
      caption: item.caption ?? "",
      queueType: item.queueType ?? "unassigned",
      scheduledFor: item.scheduledFor ?? "",
      fileUrl,
      isQuotePost: true,
      isLongformQuote: item.isLongformQuote ?? false,
      naddr: item.naddr ?? "",
      originalPostId: item.originalPostId,
      originalEventId: item.originalEventId,
      originalEventPubkey: item.originalEventPubkey,
      originalCaption: item.originalCaption ?? "",
      originalTitle: item.originalTitle ?? "",
      isRecyclable: item.isRecyclable ?? false,
    };
  });
}

export async function loadScheduledRepostDataAsBulkPosts(
  items: ScheduledRepostDataItem[]
): Promise<BulkPost[]> {
  const postIds = items
    .map((item) => item.originalPostId)
    .filter((id): id is string => id !== undefined);

  let originalPosts: OriginalPost[] = [];
  if (postIds.length > 0) {
    try {
      const response = await fetch("/api/posts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds }),
      });
      if (response.ok) {
        const dataRaw: unknown = await response.json();
        originalPosts = Array.isArray(dataRaw)
          ? (dataRaw as OriginalPost[])
          : [];
      }
    } catch {
      // leave originalPosts empty
    }
  }

  return items.map((item) => {
    const originalPost = originalPosts.find(
      (p) => p.id === item.originalPostId
    );
    const originalFileUrl = originalPost?.fileUrl;
    const fileUrlString = Array.isArray(originalFileUrl)
      ? originalFileUrl.length > 0
        ? originalFileUrl[0]
        : undefined
      : originalFileUrl;

    return {
      clientId: createBulkPostClientId(),
      files: [],
      caption: item.caption ?? "",
      queueType: item.queueType ?? "unassigned",
      scheduledFor: item.scheduledFor ?? "",
      fileUrl: fileUrlString,
      originalFileUrl: originalFileUrl ?? [],
      isKind6Repost: true,
      originalPostId: item.originalPostId,
      originalEventId: item.originalEventId,
      originalEventPubkey: item.originalEventPubkey,
      originalCaption: originalPost?.caption ?? "",
      isRecyclable: item.isRecyclable ?? false,
    };
  });
}

/** Scheduled post shape (minimal for conversion) */
export interface ScheduledPostForBulk {
  id: string;
  caption?: string | null;
  fileUrl?: string[] | string;
  queueType?: { name: string } | null;
  scheduledAtUtc?: Date | string | null;
  isRecyclable?: boolean;
}

export function convertScheduledPostsToBulkPosts(
  posts: ScheduledPostForBulk[],
  userTimezone: string
): BulkPost[] {
  return posts.map((p) => {
    const scheduledAt =
      p.scheduledAtUtc instanceof Date
        ? p.scheduledAtUtc
        : typeof p.scheduledAtUtc === "string"
          ? new Date(p.scheduledAtUtc)
          : null;
    const scheduledFor = scheduledAt
      ? formatForDateTimeLocal(
          fromDate(scheduledAt, userTimezone),
          userTimezone
        )
      : "";
    const fileUrl = Array.isArray(p.fileUrl)
      ? p.fileUrl
      : typeof p.fileUrl === "string" && p.fileUrl
        ? [p.fileUrl]
        : [];
    return {
      clientId: createBulkPostClientId(),
      files: [],
      caption: p.caption ?? "",
      queueType: p.queueType?.name ?? "unassigned",
      scheduledFor,
      isRecyclable: p.isRecyclable ?? false,
      fileUrl: fileUrl.length > 0 ? fileUrl : undefined,
    };
  });
}
