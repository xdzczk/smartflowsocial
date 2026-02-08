/**
 * Post Model - Shared Types
 *
 * Shared type definitions for Post model operations.
 */

import type { Post, PostKind, PostType, QueueType } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
export interface CreatePostData {
  userId: string;
  content?: string;
  publishedAt?: Date;
  fileUrl: string[];
  scheduledFor?: Date | string | number | null; // Supports string (legacy), Date, Unix timestamp, or null to clear
  nostrEventId?: string;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  postType: PostType;
  tags: string[];
  caption?: string;
  manual_override?: boolean;
  /** Resolved queue type ID. Use resolveQueueTypeId() from features layer before calling. */
  queueTypeId?: string | null;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  hashTagPresetId?: string | null;
  /** Idempotency key for post creation */
  creationIdempotencyKey?: string;
  /** Source post id when this post is a scheduled repost */
  repostOfPostId?: string | null;
  /** Source post id when this post is a scheduled quote */
  quoteOfPostId?: string | null;
  /** Source longform post id when this post is a kind 1 quote of a longform article */
  quoteOfLongFormPostId?: string | null;
  /** What is this post? (POST, THREAD, REPLY, REPOST, QUOTE). Default POST. */
  postKind?: PostKind;
  /** Thread: group id when this post is a thread segment */
  threadGroupId?: string | null;
  /** Reply: Nostr event id being replied to (for postKind REPLY) */
  replyToEventId?: string | null;
  /** Reply: our Post id when the replied-to event is one of our posts */
  replyToPostId?: string | null;
}

export type PostWithQueueType = Post & { queueType: QueueType | null };

export interface PostsWithPagination {
  posts: PostWithQueueType[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    limit: number;
  };
}

export interface PostStatistics {
  scheduledCount: number;
  successCount: number;
}
