/**
 * Calendar Post Converter
 *
 * Utility functions to convert PostData and LongFormPostData to CalendarPost format
 */

import { fromDate, fromUnixTimestamp, toUnixTimestamp } from "~/lib/temporal";

import type { CalendarPost } from "../components/Calendar/PostBlock.types";
import {
  deriveIsScheduledLongForm,
  deriveIsPublishedLongForm,
} from "../state-machine/longform-post-state";
import { deriveIsScheduled, deriveIsPosted } from "../state-machine/post-state";
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
  if (post.scheduledFor) {
    try {
      const scheduledZoned =
        post.scheduledFor &&
        typeof post.scheduledFor === "object" &&
        "getTime" in post.scheduledFor
          ? fromDate(post.scheduledFor as Date, "UTC")
          : typeof post.scheduledFor === "string"
            ? fromUnixTimestamp(parseInt(post.scheduledFor, 10), "UTC")
            : typeof post.scheduledFor === "number"
              ? fromUnixTimestamp(Math.floor(post.scheduledFor / 1000), "UTC")
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
  const isPosted = deriveIsPosted(currentState);

  const result: CalendarPost = {
    ...post,
    currentState,
    scheduledFor: scheduledForValue,
    postedAt: post.postedAt ?? null,
    publishedAt: publishedAtValue,
    queueType: post.queueType ?? null,
    manual_override: post.manual_override || false,
    isScheduled,
    isPosted,
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
  const templateIdValue =
    "templateId" in post && post.templateId
      ? typeof post.templateId === "string"
        ? post.templateId
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
    // Override specific fields for CalendarPost
    caption: post.content ?? null,
    currentState,
    fileUrl: [],
    hashtags: hashtagsValue,
    isScheduled,
    isPosted,
    templateId: templateIdValue,
    isRecyclable:
      "isRecyclable" in post && typeof post.isRecyclable === "boolean"
        ? post.isRecyclable
        : false,
    // CalendarPost specific fields
    title: post.title ?? undefined,
    summary: post.summary ?? undefined,
    image: post.image ?? undefined,
    publishedAt: publishedAtValue,
    postedAt: publishedAtValue,
    scheduledFor: (() => {
      if (!post.scheduledFor) return null;
      try {
        const scheduledZoned =
          post.scheduledFor &&
          typeof post.scheduledFor === "object" &&
          "getTime" in post.scheduledFor
            ? fromDate(post.scheduledFor as Date, "UTC")
            : typeof post.scheduledFor === "string"
              ? fromUnixTimestamp(parseInt(post.scheduledFor, 10), "UTC")
              : typeof post.scheduledFor === "number"
                ? fromUnixTimestamp(Math.floor(post.scheduledFor / 1000), "UTC")
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
