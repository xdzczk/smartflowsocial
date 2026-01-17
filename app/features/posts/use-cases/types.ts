/**
 * Use Case Types
 *
 * Type definitions for post use cases
 */

import type { Post, PostType } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { Temporal } from "~/lib/temporal";

export interface CreatePostInput {
  userId: string;
  content: string;
  caption?: string;
  fileUrl: string[];
  postType: PostType;
  queueTypeId?: string | null;
  queueType?: string; // Queue type name for resolution
  hashTagPresetId?: string | null;
  isRecyclable: boolean;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  scheduledFor?: number; // Unix timestamp in seconds
  hashTagPresetTags?: string;
  showHashTagsinPosts?: boolean;
  tags?: string[]; // Tags extracted from signedEvent
  repost?: boolean; // Mark as repost if kind 6
  isQuotedPost?: boolean; // Mark as quoted post
  correlationId?: string; // For request tracking
}

export interface CreatePostResult {
  post: Post;
  needsScheduling: boolean;
}

export interface SchedulePostInput {
  postId: string;
  userId: string;
  scheduledAtUtc: Temporal.ZonedDateTime; // Use Temporal for better timezone handling
  signedEvent: SignedEvent;
  correlationId?: string; // For request tracking
}

export interface PublishNowInput {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  relays: string[];
  correlationId?: string; // For request tracking
}

export interface CancelPostInput {
  postId: string;
  userId: string;
}
