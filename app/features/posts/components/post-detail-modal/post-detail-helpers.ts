import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import {
  formatForDisplay,
  fromDate,
  type DateDisplayLocale,
} from "~/lib/temporal";

import type { Post } from "../../data/posts-prisma-types.server";
import type { CombinedContent, PostData } from "../../types";

export type PostDetailModalPost = Post | PostData | CombinedContent;

export function getPostEventId(
  post: PostDetailModalPost,
  type: string
): string | null {
  if (type !== "published") return null;
  const se = post.signedEvent;
  if (!se || typeof se !== "object" || !("id" in se)) return null;
  const id = (se as { id?: string }).id;
  return typeof id === "string" ? id : null;
}

/** Nostr note id for published long-form (stored id or signed event id). */
export function getLongFormPublishedEventId(post: {
  nostrEventId?: string | null;
  signedEvent?: unknown;
}): string | null {
  const nostrId = post.nostrEventId;
  if (typeof nostrId === "string" && nostrId.length > 0) return nostrId;
  const se = post.signedEvent;
  if (se && typeof se === "object" && "id" in se) {
    const id = (se as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

export function formatScheduledDate(
  scheduledAtUtc: Date | null | undefined,
  userTimezone: string | undefined,
  userTimeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale = "en-GB"
): string {
  if (!scheduledAtUtc) return "Not scheduled";
  try {
    const tz = userTimezone ?? "UTC";
    const zoned = fromDate(scheduledAtUtc, "UTC");
    const userZoned = zoned.withTimeZone(tz);
    return formatForDisplay(
      userZoned,
      tz,
      {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: userTimeFormat === "12h",
      },
      userTimeFormat,
      dateLocale
    );
  } catch {
    return scheduledAtUtc.toLocaleDateString(dateLocale, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: userTimeFormat === "12h",
    });
  }
}

export function getDeleteButtonLabel(
  type: "draft" | "published" | "scheduled"
): string {
  switch (type) {
    case "draft":
      return "Delete Draft";
    case "scheduled":
      return "Delete scheduled post (and attached follow-ups)";
    default:
      return "Delete Post";
  }
}

/**
 * Delete fetchers can return heterogeneous JSON shapes.
 * Treat a settled response as success unless it explicitly reports an error.
 */
export function didDeleteActionSucceed(data: {
  success?: boolean;
  error?: unknown;
}): boolean {
  if (typeof data.success === "boolean") {
    return data.success;
  }
  return !data.error;
}

export function hasOpenOnNostrLink(
  post: PostDetailModalPost
): post is Post & { signedEvent: { id: string } } {
  const se = post.signedEvent;
  return (
    !!se &&
    typeof se === "object" &&
    "id" in se &&
    typeof (se as { id?: string }).id === "string"
  );
}

export function getPostContextLine(
  type: "draft" | "published" | "scheduled",
  post: PostDetailModalPost,
  queueType: { name: string } | null | undefined,
  formatDateFn: (
    date: Date | string,
    short: boolean,
    tz?: string,
    fmt?: "12h" | "24h"
  ) => string,
  formatScheduledDateFn: (
    d: Date | null | undefined,
    tz: string | undefined,
    fmt: "12h" | "24h"
  ) => string,
  userTimezone: string | undefined,
  userTimeFormat: "12h" | "24h"
): string {
  const queueName = queueType?.name ?? "";
  const sep = queueName ? " · " : "";
  if (type === "draft") return `Draft${sep}${queueName}`.trim();
  if (type === "scheduled" && "scheduledAtUtc" in post && post.scheduledAtUtc)
    return `Scheduled for ${formatScheduledDateFn(post.scheduledAtUtc, userTimezone, userTimeFormat)}${sep}${queueName}`.trim();
  if (type === "published" && post.publishedAt)
    return `Posted ${formatDateFn(post.publishedAt, false, userTimezone, userTimeFormat)}${sep}${queueName}`.trim();
  return queueName || "—";
}

export function getThreadGroupId(post: PostDetailModalPost): string | null {
  if ("threadGroupId" in post && typeof post.threadGroupId === "string")
    return post.threadGroupId;
  return null;
}

export function getPostKind(post: PostDetailModalPost): string | undefined {
  if ("postKind" in post && post.postKind != null) return String(post.postKind);
  return undefined;
}

/** Note body: prefer content, then caption (matches kind-1 vs image caption). */
export function getPrimaryNoteText(post: PostDetailModalPost): string {
  const content =
    "content" in post && typeof post.content === "string"
      ? post.content.trim()
      : "";
  const caption = typeof post.caption === "string" ? post.caption.trim() : "";
  if (content) return content;
  return caption;
}

export function getSecondaryCaption(
  post: PostDetailModalPost,
  primary: string
): string | null {
  const content =
    "content" in post && typeof post.content === "string"
      ? post.content.trim()
      : "";
  const caption = typeof post.caption === "string" ? post.caption.trim() : "";
  if (!caption || caption === primary) return null;
  if (content && caption && content !== caption) return caption;
  return null;
}

export function hasMediaAttachments(post: PostDetailModalPost): boolean {
  return Boolean(post.fileUrl && post.fileUrl.length > 0);
}

/** Drop replies whose event id is a thread segment (continuations, not “real” replies). */
export function filterRepliesExcludingThreadSegments(
  replies: ChildReply[],
  segmentIds: ReadonlySet<string>
): ChildReply[] {
  if (segmentIds.size === 0) return replies;
  return replies.filter((r) => !r.id || !segmentIds.has(r.id));
}
