/**
 * Engagement Types
 * Shared TypeScript interfaces for engagement features
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";

/**
 * Nostr event tag structure
 */
export type NostrTag = string[];

/**
 * Primal API event structure
 */
export interface PrimalEvent {
  [0]: string;
  [1]: string;
  [2]: NostrEvent | SignedEvent;
}

/**
 * Thread view data from Primal API
 */
export interface ThreadViewData {
  events?: NostrEvent[];
  stats?: {
    replies?: number;
    likes?: number;
    reposts?: number;
    zaps?: number;
    satszapped?: number;
  };
}

/**
 * Notification event structure
 */
export interface NotificationEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: NostrTag[];
  sig?: string;
  eventId?: string;
  authorName?: string;
  authorImage?: string | null;
}

/**
 * Grouped notification structure
 */
export interface GroupedNotification {
  eventId: string;
  event: NotificationEvent;
  replies?: NotificationEvent[];
  quotes?: NotificationEvent[];
  mentions?: NotificationEvent[];
}

/**
 * Profile data from Primal API
 */
export interface EngagementProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Stats data from Primal API
 */
export interface EngagementStats {
  followers_count?: number;
  follows_count?: number;
  note_count?: number;
  total_zap_count?: number;
  total_satszapped?: number;
  [key: string]: unknown;
}

/**
 * Event statistics structure
 */
export interface EventStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

/**
 * Muted list data structure
 * Stored as Json in Prisma User.mutedList field
 */
export interface MutedListData {
  npubs: string[];
  lastSynced: string;
}
