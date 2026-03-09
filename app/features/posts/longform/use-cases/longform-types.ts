/**
 * Long Form Post Use Case Types
 *
 * Type definitions for long form post use cases
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { Temporal } from "~/lib/temporal";

import type { LongFormPost } from "../../data/posts-prisma-types.server";

export interface CreateLongFormPostInput {
  userId: string;
  title: string;
  summary?: string;
  content: string;
  image?: string;
  tags?: string[];
  queueTypeId?: string | null;
  queueType?: string; // Queue type name for resolution
  hashTagPresetId?: string | null;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  scheduledFor?: number; // Unix timestamp in seconds
  isPublished?: boolean; // If true, publish immediately
}

export interface CreateLongFormPostResult {
  post: LongFormPost;
  needsScheduling: boolean;
}

export interface ScheduleLongFormPostInput {
  postId: string;
  userId: string;
  scheduledAtUtc: Temporal.ZonedDateTime; // Use Temporal for better timezone handling
  signedEvent: SignedEvent;
  correlationId?: string; // For request tracking
  /** When random schedule window was used: user-chosen time (for queue "next slot"). */
  nominalScheduledAtUtc?: Temporal.ZonedDateTime;
}

export interface PublishLongFormNowInput {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  relays: string[];
  correlationId?: string; // For request tracking
}
