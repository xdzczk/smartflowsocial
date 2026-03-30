/**
 * Normalized scheduled-post shape for shared modals (Dashboard, Calendar, Scheduled).
 * Source entity is kept for mutations; adapters map page-specific types here.
 */

import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";
import type { Post } from "~/features/posts/data/posts-prisma-types.server";
import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/types";
import { fromDate, fromUnixTimestamp, toDate } from "~/lib/temporal";

import {
  getScheduledPostCapabilities,
  type ScheduledPostCapabilities,
} from "./scheduled-post-capabilities";

export type ScheduledPostEntityKind = "post" | "longform";

/** Display kind for header chips (canonical labels). */
export type ScheduledPostDisplayKind =
  | "Post"
  | "Reply"
  | "Quote"
  | "Repost"
  | "Poll"
  | "Article"
  | "Thread item";

export interface ScheduledPostTechnicalDetails {
  eventId?: string | null;
  noteId?: string | null;
  threadGroupId?: string | null;
  raw?: Record<string, unknown>;
}

export interface ScheduledPostViewModel {
  id: string;
  entityKind: ScheduledPostEntityKind;
  /** Original row for API / signing (PostData, LongFormPostData, or calendar-shaped post). */
  entity: PostData | LongFormPostData;
  displayKind: ScheduledPostDisplayKind;
  statusLabel: string;
  captionText: string | null;
  titleText: string | null;
  summaryText: string | null;
  mediaUrls: string[];
  scheduledAtUtc: Date | null;
  queueId: string | null;
  queueName: string | null;
  manualOverride: boolean;
  postKind: string | null | undefined;
  hashtags: string[];
  technicalDetails: ScheduledPostTechnicalDetails;
  /** Capability flags (centralized; do not re-derive per page). */
  capabilities: ReturnType<typeof getScheduledPostCapabilities>;
}

function parseFileUrlEntries(fileUrl: string[] | undefined): string[] {
  if (!fileUrl?.length) return [];
  const out: string[] = [];
  for (const entry of fileUrl) {
    if (typeof entry !== "string") continue;
    try {
      const parsed = JSON.parse(entry) as string[] | string;
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          if (typeof u === "string" && u) out.push(u);
        }
      } else if (typeof parsed === "string" && parsed) {
        out.push(parsed);
      }
    } catch {
      if (entry) out.push(entry);
    }
  }
  return out;
}

function eventIdFromSigned(
  signed: PostData["signedEvent"] | LongFormPostData["signedEvent"]
): string | null {
  if (!signed || typeof signed !== "object" || !("id" in signed)) return null;
  const id = (signed as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function displayKindFromPost(
  post: PostData | CalendarPost,
  isPoll: boolean
): ScheduledPostDisplayKind {
  if (isPoll) return "Poll";
  const kind = post.postKind;
  if (kind === "REPLY") return "Reply";
  if (kind === "QUOTE" || post.isQuotedPost) return "Quote";
  if (kind === "REPOST" || post.repost === true) return "Repost";
  if (post.threadGroupId) return "Thread item";
  return "Post";
}

function isPollPost(post: PostData | CalendarPost): boolean {
  if (post.postType === "POLL") return true;
  const se = post.signedEvent;
  if (se && typeof se === "object" && "kind" in se) {
    return (se as { kind?: number }).kind === 6969;
  }
  return false;
}

export function scheduledPostViewModelFromPostData(
  post: PostData
): ScheduledPostViewModel {
  const isPoll = isPollPost(post);
  const tags =
    typeof post.hashtags === "string" && post.hashtags.trim()
      ? post.hashtags.split(/\s+/).filter(Boolean)
      : [];
  const qt = post.queueType;
  return {
    id: post.id,
    entityKind: "post",
    entity: post,
    displayKind: displayKindFromPost(post, isPoll),
    statusLabel: "Scheduled",
    captionText: post.caption ?? null,
    titleText: null,
    summaryText: null,
    mediaUrls: parseFileUrlEntries(post.fileUrl),
    scheduledAtUtc:
      post.scheduledAtUtc instanceof Date ? post.scheduledAtUtc : null,
    queueId: qt?.id ?? null,
    queueName: qt?.name ?? null,
    manualOverride: Boolean(post.manual_override),
    postKind: post.postKind,
    hashtags: tags,
    technicalDetails: {
      eventId: eventIdFromSigned(post.signedEvent),
      noteId: eventIdFromSigned(post.signedEvent),
      threadGroupId: post.threadGroupId ?? null,
    },
    capabilities: getScheduledPostCapabilities({
      entityKind: "post",
      postKind: post.postKind,
      repost: post.repost,
      isQuotedPost: post.isQuotedPost,
    }),
  };
}

export function scheduledPostViewModelFromLongForm(
  post: LongFormPostData
): ScheduledPostViewModel {
  const qt = post.queueType;
  return {
    id: post.id,
    entityKind: "longform",
    entity: post,
    displayKind: "Article",
    statusLabel: "Scheduled",
    captionText: null,
    titleText: post.title ?? null,
    summaryText: post.summary ?? null,
    mediaUrls: post.image ? [post.image] : [],
    scheduledAtUtc:
      post.scheduledAtUtc instanceof Date ? post.scheduledAtUtc : null,
    queueId: qt?.id ?? null,
    queueName: qt?.name ?? null,
    manualOverride: true,
    postKind: undefined,
    hashtags: [],
    technicalDetails: {
      eventId: eventIdFromSigned(post.signedEvent),
      noteId: eventIdFromSigned(post.signedEvent),
    },
    capabilities: getScheduledPostCapabilities({
      entityKind: "longform",
    }),
  };
}

/**
 * Calendar posts are PostData-shaped; normalize to view model + entity typed for hooks.
 */
export function scheduledPostViewModelFromCalendarPost(
  post: CalendarPost,
  options: { treatAsLongform: boolean }
): ScheduledPostViewModel {
  if (options.treatAsLongform) {
    const lf = calendarPostAsLongFormEntity(post);
    return scheduledPostViewModelFromLongForm(lf);
  }
  const pd = calendarPostAsPostData(post);
  return scheduledPostViewModelFromPostData(pd);
}

/** Best-effort: calendar row → PostData for edit/reschedule hooks. */
export function calendarPostAsPostData(post: CalendarPost): PostData {
  return post as unknown as PostData;
}

export function calendarPostAsLongFormEntity(
  post: CalendarPost
): LongFormPostData {
  const base = post as unknown as LongFormPostData;
  return {
    ...base,
    title: post.title ?? base.title,
    summary: post.summary ?? base.summary,
    image: post.image ?? base.image,
  };
}

export function scheduledAtFromCalendarPost(
  post: CalendarPost,
  isLongform: boolean
): Date | null {
  if (isLongform) {
    if (!post.publishedAt) return null;
    try {
      return new Date(post.publishedAt);
    } catch {
      return null;
    }
  }
  const raw = post.scheduledFor;
  if (raw == null || raw === "") return null;
  try {
    const ts = Number(raw);
    if (!Number.isNaN(ts)) {
      return toDate(fromUnixTimestamp(ts, "UTC"));
    }
    return toDate(fromDate(new Date(raw), "UTC"));
  } catch {
    return null;
  }
}

export function mergeViewModelEntity<T extends PostData | LongFormPostData>(
  vm: ScheduledPostViewModel,
  entity: T
): ScheduledPostViewModel {
  if (vm.entityKind === "longform") {
    return scheduledPostViewModelFromLongForm(entity as LongFormPostData);
  }
  return scheduledPostViewModelFromPostData(entity as PostData);
}

/**
 * Infer capabilities for PostDetailsModal / CombinedContent without an explicit view model.
 */
export function inferScheduledCapabilitiesFromModalPost(
  post: Post | PostData | CombinedContent
): ScheduledPostCapabilities {
  if (
    typeof post === "object" &&
    "type" in post &&
    post.type === "longform" &&
    "originalData" in post
  ) {
    return scheduledPostViewModelFromLongForm(
      post.originalData as LongFormPostData
    ).capabilities;
  }
  if (
    typeof post === "object" &&
    "type" in post &&
    post.type === "post" &&
    "originalData" in post
  ) {
    return scheduledPostViewModelFromPostData(post.originalData as PostData)
      .capabilities;
  }
  if (typeof post === "object" && Array.isArray((post as PostData).fileUrl)) {
    return scheduledPostViewModelFromPostData(post as PostData).capabilities;
  }
  return scheduledPostViewModelFromLongForm(post as unknown as LongFormPostData)
    .capabilities;
}
