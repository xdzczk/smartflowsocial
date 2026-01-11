/**
 * Long Form Post Use Case Types
 *
 * Type definitions for long form post use cases
 */

import type { LongFormPost } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";

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
  scheduledAtUtc: Date;
  signedEvent: SignedEvent;
  correlationId?: string; // For request tracking
}

export interface PublishLongFormNowInput {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
  relays: string[];
  correlationId?: string; // For request tracking
}
