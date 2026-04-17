/**
 * Use Case Types
 *
 * Type definitions for post use cases
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { Temporal } from "~/lib/temporal";

import type {
  Post,
  PostKind,
  PostType,
} from "../data/posts-prisma-types.server";

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
  scheduledFor?: number; // Unix timestamp in seconds (actual; when random window used, this is the randomized time)
  /** When random schedule window was used: nominal time in Unix seconds (for queue "next slot"). */
  nominalScheduledFor?: number;
  hashTagPresetTags?: string;
  showHashTagsinPosts?: boolean;
  tags?: string[]; // Tags extracted from signedEvent
  repost?: boolean; // Mark as repost if kind 6
  isQuotedPost?: boolean; // Mark as quoted post
  correlationId?: string; // For request tracking
  /** Source post id when this post is a scheduled repost */
  repostOfPostId?: string | null;
  /** Source post id when this post is a scheduled quote */
  quoteOfPostId?: string | null;
  /** What is this post? (POST, THREAD, REPLY, REPOST, QUOTE). Default POST. */
  postKind?: PostKind;
  /** Thread: group id when this post is a thread segment */
  threadGroupId?: string | null;
  /** When creating/scheduling a new post: also create a scheduled repost */
  alsoScheduleRepost?: boolean;
  repostScheduledFor?: number; // Unix timestamp in seconds
  repostSignedEvent?: SignedEvent;
  /** Multiple scheduled reposts: [{ scheduledFor, signedEvent, repostConditions? }, ...] */
  repostSchedules?: Array<{
    scheduledFor: number;
    signedEvent: SignedEvent;
    repostConditions?: {
      minReactions?: number;
      minZaps?: number;
      minComments?: number;
      minReposts?: number;
      minSats?: number;
    } | null;
  }>;
  /** When creating/scheduling a new post: also create a scheduled quote */
  alsoScheduleQuote?: boolean;
  quoteScheduledFor?: number; // Unix timestamp in seconds
  quoteSignedEvent?: SignedEvent;
  quoteCaption?: string;
  /** Multiple scheduled quotes: [{ scheduledFor, signedEvent, caption? }, ...] */
  quoteSchedules?: Array<{
    scheduledFor: number;
    signedEvent: SignedEvent;
    caption?: string;
  }>;
  /**
   * Internal optimization for bulk flows that already checked capacity.
   * Keeps per-post checks enabled by default for single-item actions.
   */
  skipScheduleCapacityCheck?: boolean;
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
  /** When random schedule window was used: user-chosen time (for queue "next slot"). */
  nominalScheduledAtUtc?: Temporal.ZonedDateTime;
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
