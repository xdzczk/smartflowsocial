/**
 * Calendar Post Converter
 * 
 * Utility functions to convert PostData and LongFormPostData to CalendarPost format
 */

import type { PostData, LongFormPostData } from "~/features/posts/types";
import type { CalendarPost } from "~/features/posts/components/Calendar/PostBlock.types";

/**
 * Convert PostData to CalendarPost
 */
export function postDataToCalendarPost(post: PostData): CalendarPost {
  return {
    ...post,
    scheduledFor: post.scheduledFor || null,
    postedAt: post.postedAt || null,
    publishedAt: post.publishedAt || null,
    queueType: post.queueType || null,
    manual_override: post.manual_override ?? false,
  } as CalendarPost;
}

/**
 * Convert LongFormPostData to CalendarPost
 */
export function longFormPostDataToCalendarPost(post: LongFormPostData): CalendarPost {
  return {
    id: post.id,
    userId: post.userId,
    caption: post.content || null,
    fileUrl: null,
    hashtags: post.tags?.join(" ") || null,
    isScheduled: post.isScheduled ?? false,
    isPosted: post.isPublished ?? false,
    draft: post.draft ?? false,
    status: post.status || "DRAFT",
    queueTypeId: post.queueTypeId || null,
    templateId: post.templateId || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    // CalendarPost specific fields
    title: post.title || undefined,
    summary: post.summary || undefined,
    image: post.image || undefined,
    publishedAt: post.publishedAt || null,
    postedAt: post.publishedAt || null,
    scheduledFor: post.scheduledFor || null,
    queueType: post.queueType || null,
    manual_override: false,
    isPast: false,
  } as CalendarPost;
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


