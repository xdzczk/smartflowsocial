/**
 * Giveaway Types
 * Shared TypeScript interfaces for giveaway features
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
 * Related event for giveaways
 */
export interface RelatedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content?: string;
  tags?: NostrTag[];
  sig?: string;
}

/**
 * Profile data from Primal API
 */
export interface GiveawayProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Stats data from Primal API
 */
export interface GiveawayStats {
  followers_count?: number;
  follows_count?: number;
  note_count?: number;
  total_zap_count?: number;
  total_satszapped?: number;
  [key: string]: unknown;
}

/**
 * Giveaway state data
 */
export type GiveawayStateData = Record<string, unknown>;

/**
 * Scope for a giveaway: which posts (or users) are in scope for participant selection.
 */
export type GiveawayScope =
  | {
      type: "PERIOD";
      reference: {
        days?: number;
        from?: Date;
        to?: Date;
        /** Optional queue filter (scope is still period; posts limited to this queue). */
        queueId?: string;
      };
    }
  | { type: "SINGLE_POST"; reference: { postId: string } }
  | {
      type: "QUEUE";
      reference: { queueId: string; from?: Date; to?: Date };
    }
  | { type: "FOLLOWERS"; reference: Record<string, unknown> }
  | { type: "FOLLOWING"; reference: Record<string, unknown> };

/**
 * Engagement type for giveaway eligibility.
 */
export type GiveawayEngagementType = "REACTION" | "REPOST" | "COMMENT" | "ZAP";

/**
 * Per-engagement config: winner count and sats per winner for one engagement type.
 */
export interface EngagementTypeConfig {
  winnerCount: number;
  satsPerWinner: number;
}

/**
 * Optional per-engagement winner counts and sats. When set, selection uses this instead of single winnerCount.
 */
export type GiveawayEngagementConfig = Partial<
  Record<GiveawayEngagementType, EngagementTypeConfig>
>;

/**
 * Single winner entry in winner snapshot (stored at lock).
 */
export interface GiveawayWinnerEntry {
  pubkey: string;
  npub: string;
  qualifyingActions: Array<{ kind: number; eventId: string; postId?: string }>;
  /** Suggested sats to zap (when engagementConfig was used). */
  satsPerWinner?: number;
  /** Engagement type this winner was selected for (when per-type selection). */
  engagementType?: GiveawayEngagementType;
}
