/**
 * Utility functions for combining Post and LongFormPost data
 * Used by the "All" tab to display both types of content together
 */

import type { CombinedContent } from "~/features/posts/types";

// Re-export the type
export type { CombinedContent } from "~/features/posts/types";

/**
 * Converts a Post to CombinedContent format
 */
export function postToCombinedContent(post: any): CombinedContent {
  return {
    id: post.id,
    type: "post",
    caption: post.caption,
    content: post.content,
    fileUrl: post.fileUrl,
    scheduledFor: post.scheduledFor,
    postedAt: post.postedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    isScheduled: post.isScheduled,
    isPosted: post.isPosted,
    draft: post.draft,
    status: post.status,
    queueType: post.queueType,
    queueTypeId: post.queueTypeId,
    userId: post.userId,
    tags: post.tags,
    signedEvent: post.signedEvent,
    nostrEvent: post.nostrEvent,
    nostrEventId: post.nostrEventId,
    manual_override: post.manual_override,
    postType: post.postType,
    repost: post.repost,
    isQuotedPost: post.isQuotedPost,
    isRecyclable: post.isRecyclable,
    templateId: post.templateId,
    originalData: post,
  };
}

/**
 * Converts a LongFormPost to CombinedContent format
 */
export function longFormPostToCombinedContent(
  longFormPost: any,
): CombinedContent {
  return {
    id: longFormPost.id,
    type: "longform",
    title: longFormPost.title,
    content: longFormPost.content,
    summary: longFormPost.summary,
    image: longFormPost.image,
    scheduledFor: longFormPost.scheduledFor,
    publishedAt: longFormPost.publishedAt,
    postedAt: longFormPost.publishedAt, // Map publishedAt to postedAt for consistency
    createdAt: longFormPost.createdAt,
    updatedAt: longFormPost.updatedAt,
    isScheduled: longFormPost.isScheduled,
    isPublished: longFormPost.isPublished,
    isPosted: longFormPost.isPublished, // Map isPublished to isPosted for consistency
    draft: longFormPost.draft,
    status: longFormPost.status,
    queueType: longFormPost.queueType,
    queueTypeId: longFormPost.queueTypeId,
    userId: longFormPost.userId,
    tags: longFormPost.tags,
    signedEvent: longFormPost.signedEvent,
    nostrEvent: longFormPost.nostrEvent,
    nostrEventId: longFormPost.nostrEventId,
    originalData: longFormPost,
  };
}

/**
 * Combines posts and longform posts into a single sorted array
 */
export function combineContent(
  posts: any[] = [],
  longFormPosts: any[] = [],
  sortBy = "createdAt",
  sortDirection: "asc" | "desc" = "desc",
): CombinedContent[] {
  const combinedPosts = posts.map(postToCombinedContent);
  const combinedLongForm = longFormPosts.map(longFormPostToCombinedContent);
  const combined = [...combinedPosts, ...combinedLongForm];

  // Sort the combined array
  return combined.sort((a, b) => {
    let aValue, bValue;

    if (sortBy === "scheduledFor") {
      // Handle Unix timestamps for scheduledFor
      aValue = a.scheduledFor ? parseInt(a.scheduledFor) * 1000 : 0;
      bValue = b.scheduledFor ? parseInt(b.scheduledFor) * 1000 : 0;
    } else if (sortBy === "postedAt" || sortBy === "publishedAt") {
      // Handle dates for postedAt/publishedAt
      aValue = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      bValue = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    } else if (sortBy === "createdAt" || sortBy === "updatedAt") {
      // Handle dates for createdAt/updatedAt
      aValue = new Date(a[sortBy]).getTime();
      bValue = new Date(b[sortBy]).getTime();
    } else {
      // Handle other fields
      aValue = a[sortBy] || "";
      bValue = b[sortBy] || "";
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });
}

/**
 * Filters combined content by search term
 */
export function filterCombinedContent(
  content: CombinedContent[],
  searchTerm: string,
): CombinedContent[] {
  if (!searchTerm) return content;

  const searchLower = searchTerm.toLowerCase();
  return content.filter((item) => {
    return (
      item.caption?.toLowerCase().includes(searchLower) ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.content?.toLowerCase().includes(searchLower) ||
      item.summary?.toLowerCase().includes(searchLower)
    );
  });
}
