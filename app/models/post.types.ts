/**
 * Post Model - Shared Types
 * 
 * Shared type definitions for Post model operations.
 */

import type { Post, PostType, QueueType } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
export interface CreatePostData {
  userId: string;
  content?: string;
  postedAt?: Date;
  fileUrl: string[];
  scheduledFor?: Date | string;
  nostrEventId?: string;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  postType: PostType;
  tags: string[];
  caption?: string;
  isScheduled: boolean;
  isPosted: boolean;
  manual_override?: boolean;
  /** Resolved queue type ID. Use resolveQueueTypeId() from features layer before calling. */
  queueTypeId?: string | null;
  draft?: boolean;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  hashTagPresetId?: string | null;
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








