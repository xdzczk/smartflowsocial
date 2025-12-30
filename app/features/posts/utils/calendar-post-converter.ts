/**
 * Calendar Post Converter
 * 
 * Utility functions to convert PostData and LongFormPostData to CalendarPost format
 */

import type { CalendarPost } from "../components/Calendar/PostBlock.types";
import type { PostData, LongFormPostData } from "../types";
/**
 * Convert PostData to CalendarPost
 */
export function postDataToCalendarPost(post: PostData): CalendarPost {
  const publishedAtValue = "publishedAt" in post && post.publishedAt 
    ? (post.publishedAt instanceof Date ? post.publishedAt : typeof post.publishedAt === "string" ? post.publishedAt : null)
    : null;
  const result: CalendarPost = {
    ...post,
    scheduledFor: post.scheduledFor ?? null,
    postedAt: post.postedAt ?? null,
    publishedAt: publishedAtValue,
    queueType: post.queueType ?? null,
    manual_override: post.manual_override ?? false,
  };
  return result;
}

/**
 * Convert LongFormPostData to CalendarPost
 */
export function longFormPostDataToCalendarPost(post: LongFormPostData): CalendarPost {
  const publishedAtValue = "publishedAt" in post && post.publishedAt 
    ? (post.publishedAt instanceof Date ? post.publishedAt : typeof post.publishedAt === "string" ? post.publishedAt : null)
    : null;
  const templateIdValue = "templateId" in post && post.templateId 
    ? (typeof post.templateId === "string" ? post.templateId : null)
    : null;
  const hashtagsValue = post.tags && Array.isArray(post.tags) ? post.tags.join(" ") : undefined;
  const result: CalendarPost = {
    ...post,
    // Override specific fields for CalendarPost
    caption: post.content ?? null,
    fileUrl: [],
    hashtags: hashtagsValue,
    isScheduled: post.isScheduled ?? false,
    isPosted: post.isPublished ?? false,
    templateId: templateIdValue,
    isRecyclable: ("isRecyclable" in post && typeof post.isRecyclable === "boolean") ? post.isRecyclable : false,
    // CalendarPost specific fields
    title: post.title ?? undefined,
    summary: post.summary ?? undefined,
    image: post.image ?? undefined,
    publishedAt: publishedAtValue,
    postedAt: publishedAtValue,
    scheduledFor: post.scheduledFor ?? null,
    queueType: post.queueType ?? null,
    manual_override: false,
    isPast: false,
  };
  return result;
}

/**
 * Convert array of PostData to CalendarPost[]
 */
export function postsToCalendarPosts(posts: PostData[]): CalendarPost[] {
  return posts.map(postDataToCalendarPost);
}

/**
 * Convert array of LongFormPostData to CalendarPost[]
 */
export function longFormPostsToCalendarPosts(posts: LongFormPostData[]): CalendarPost[] {
  return posts.map(longFormPostDataToCalendarPost);
}

/**
 * Convert mixed array of PostData and LongFormPostData to CalendarPost[]
 */
export function mixedPostsToCalendarPosts(
  posts: PostData[],
  longFormPosts: LongFormPostData[],
): CalendarPost[] {
  return [
    ...posts.map(postDataToCalendarPost),
    ...longFormPosts.map(longFormPostDataToCalendarPost),
  ];
}



