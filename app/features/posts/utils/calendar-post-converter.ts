/**
 * Calendar Post Converter
 *
 * Utility functions to convert PostData and LongFormPostData to CalendarPost format
 */

import { fromDate, toUnixTimestamp } from "~/lib/temporal";

import type { CalendarPost } from "../components/Calendar/PostBlock.types";
import {
  deriveIsScheduledLongForm,
  deriveIsPublishedLongForm,
} from "../state-machine/longform-post-state";
import {
  deriveIsScheduled,
  deriveIsPublished,
} from "../state-machine/post-state";
import type { PostData, LongFormPostData } from "../types";
/**
 * Convert PostData to CalendarPost
 */
export function postDataToCalendarPost(post: PostData): CalendarPost {
  const publishedAtValue =
    "publishedAt" in post && post.publishedAt
      ? post.publishedAt instanceof Date
        ? post.publishedAt
        : typeof post.publishedAt === "string"
          ? post.publishedAt
          : null
      : null;
  // Convert Date to Unix timestamp in seconds (as string) for CalendarPost
  let scheduledForValue: string | null = null;
  if (post.scheduledAtUtc) {
    try {
      const scheduledZoned =
        post.scheduledAtUtc instanceof Date
          ? fromDate(post.scheduledAtUtc, "UTC")
          : null;
      if (scheduledZoned) {
        scheduledForValue = String(toUnixTimestamp(scheduledZoned));
      }
    } catch {
      scheduledForValue = null;
    }
  }
  // Use currentState as single source of truth (flags removed from Post model)
  const currentState =
    (post as { currentState?: string }).currentState ?? "DRAFT";
  const isScheduled = deriveIsScheduled(currentState);
  const isPosted = deriveIsPublished(currentState);

  const result: CalendarPost = {
    ...post,
    currentState,
    scheduledFor: scheduledForValue,
    publishedAt: publishedAtValue,
    queueType: post.queueType ?? null,
    manual_override: post.manual_override || false,
    isScheduled,
    isPosted,
    postKind: post.postKind,
    replyToEventId: post.replyToEventId ?? null,
    replyToPostId: post.replyToPostId ?? null,
  };
  return result;
}

/**
 * Convert LongFormPostData to CalendarPost
 */
export function longFormPostDataToCalendarPost(
  post: LongFormPostData
): CalendarPost {
  const publishedAtValue =
    "publishedAt" in post && post.publishedAt
      ? post.publishedAt instanceof Date
        ? post.publishedAt
        : typeof post.publishedAt === "string"
          ? post.publishedAt
          : null
      : null;
  const hashtagsValue = Array.isArray(post.tags)
    ? post.tags.join(" ")
    : undefined;
  // Use currentState as single source of truth (flags removed from LongFormPost model)
  const currentState =
    (post as { currentState?: string }).currentState ?? "DRAFT";
  const isScheduled = deriveIsScheduledLongForm(currentState);
  const isPosted = deriveIsPublishedLongForm(currentState);

  const result: CalendarPost = {
    ...post,
    draftMeta: (post as { draftMeta?: unknown }).draftMeta ?? null,
    draftGroupId: null,
    threadGroupId:
      (post as { threadGroupId?: string | null }).threadGroupId ?? null,
    // Override specific fields for CalendarPost
    caption: post.content ?? null,
    currentState,
    fileUrl: [],
    hashtags: hashtagsValue,
    isScheduled,
    isPosted,
    isRecyclable:
      "isRecyclable" in post && typeof post.isRecyclable === "boolean"
        ? post.isRecyclable
        : false,
    // Longform has no repost/quote source link
    repostOfPostId: null,
    quoteOfPostId: null,
    quoteOfLongFormPostId:
      (post as { quoteOfLongFormPostId?: string | null })
        .quoteOfLongFormPostId ?? null,
    // CalendarPost specific fields
    title: post.title ?? undefined,
    summary: post.summary ?? undefined,
    image: post.image ?? undefined,
    publishedAt: publishedAtValue,
    scheduledFor: (() => {
      if (!post.scheduledAtUtc) return null;
      try {
        const scheduledZoned =
          post.scheduledAtUtc instanceof Date
            ? fromDate(post.scheduledAtUtc, "UTC")
            : null;
        return scheduledZoned ? String(toUnixTimestamp(scheduledZoned)) : null;
      } catch {
        return null;
      }
    })(),
    queueType: post.queueType ?? null,
    manual_override: false,
    isPast: false,
    publishAttemptId:
      "publishAttemptId" in post && typeof post.publishAttemptId === "string"
        ? post.publishAttemptId
        : null,
  };
  return result;
}

/**
 * Convert array of PostData to CalendarPost[]
 */
export function postsToCalendarPosts(posts: PostData[]): CalendarPost[] {
  return posts.map((post) => postDataToCalendarPost(post));
}

/**
 * Convert array of LongFormPostData to CalendarPost[]
 */
export function longFormPostsToCalendarPosts(
  posts: LongFormPostData[]
): CalendarPost[] {
  return posts.map((post) => longFormPostDataToCalendarPost(post));
}

/**
 * Convert mixed array of PostData and LongFormPostData to CalendarPost[]
 */
export function mixedPostsToCalendarPosts(
  posts: PostData[],
  longFormPosts: LongFormPostData[]
): CalendarPost[] {
  return [
    ...posts.map((post) => postDataToCalendarPost(post)),
    ...longFormPosts.map((post) => longFormPostDataToCalendarPost(post)),
  ];
}
