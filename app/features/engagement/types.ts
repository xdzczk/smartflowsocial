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

/**
 * Base notification structure
 */
interface BaseNotification {
  id: string;
  eventId: string;
  content: string;
  createdAt: number;
  originalEventId: string;
  stats?: EventStats;
}

/**
 * Reply notification
 */
export interface NotificationReply extends BaseNotification {
  type: "reply";
  pubkey: string;
  authorName?: string;
  authorPicture?: string | null;
  authorNip05?: string;
}

/**
 * Zap notification
 */
export interface NotificationZap extends BaseNotification {
  type: "zap";
  senderPubkey: string;
  receiverPubkey: string;
  amountSats: number;
  senderName?: string;
  senderPicture?: string | null;
  senderNip05?: string;
  pubkey: string; // For compatibility - same as senderPubkey
  authorName?: string; // Alias for senderName
  authorPicture?: string | null; // Alias for senderPicture
  authorNip05?: string; // Alias for senderNip05
}

/**
 * Mention notification
 */
export interface NotificationMention extends BaseNotification {
  type: "mention";
  pubkey: string;
  authorName?: string;
  authorPicture?: string | null;
  authorNip05?: string;
}

/**
 * Quote repost notification
 */
export interface NotificationQuoteRepost extends BaseNotification {
  type: "quote";
  pubkey: string;
  authorName?: string;
  authorPicture?: string | null;
  authorNip05?: string;
}

/**
 * Union type for all notification types
 */
export type Notification =
  | NotificationReply
  | NotificationZap
  | NotificationMention
  | NotificationQuoteRepost;

/**
 * Parent post data structure
 */
export interface ParentPost {
  id: string;
  eventId: string;
  pubkey: string;
  caption?: string | null;
  fileUrl?: string | string[] | null;
  title?: string | null;
  content?: string | null;
  postedAt: Date | null;
  isLongform: boolean;
  stats?: EventStats;
}

/**
 * Grouped notification structure with parent post
 */
export interface GroupedNotification {
  parentPost: ParentPost;
  notifications: Notification[];
}

/**
 * Array of grouped notifications
 */
export type GroupedNotifications = GroupedNotification[];

/**
 * User profile type (alias for EngagementProfile)
 */
export type UserProfile = EngagementProfile;

/**
 * Trust score user data structure
 */
export interface TrustScoreUser {
  pubkey: string;
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud16?: string;
  followsCount: number;
  followersCount: number;
  noteCount: number;
  replyCount: number;
  timeJoined: number;
  zapCount: number;
  totalSatsZapped: number;
  mediaCount: number;
}

/**
 * Engagement data structure returned by loadEngagementFeedData
 */
export interface EngagementData {
  posts: unknown[];
  stats: Record<string, EventStats>;
  user: unknown;
  notifications: {
    all: Notification[];
    replies: Notification[];
    mentions: Notification[];
    zaps: Notification[];
    quotes: Notification[];
  };
  groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  };
  trustScores: Record<string, number>;
}

/**
 * Notification item component props
 */
export interface NotificationItem {
  notification: Notification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
}
