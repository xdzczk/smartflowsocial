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

/** All engagement types; used when the scope does not allow narrowing which types count as entries. */
export const ALL_GIVEAWAY_ENGAGEMENT_TYPES: readonly GiveawayEngagementType[] =
  ["REACTION", "REPOST", "COMMENT", "ZAP"];

/**
 * Period- and single-post giveaways let creators choose which engagement types
 * count as entries. Queue-scoped giveaways use all types (no separate picker in the builder).
 */
export function scopeAllowsEngagementEntryTypePick(scopeType: string): boolean {
  return scopeType === "PERIOD" || scopeType === "SINGLE_POST";
}

/** Followers / following giveaways pick random accounts from the graph — not engagement-based. */
export function scopeIsFollowGraphAccountPool(scopeType: string): boolean {
  return scopeType === "FOLLOWERS" || scopeType === "FOLLOWING";
}

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
 * Simple payout mode: one pool of winners (any selected engagement type), same sats each.
 * Stored in Json alongside per-type configs; selection uses {@link isSimpleUnifiedEngagementConfig}.
 */
export interface SimpleUnifiedEngagementConfig {
  _simpleUnified: { satsPerWinner: number };
}

export function isSimpleUnifiedEngagementConfig(
  config: unknown
): config is SimpleUnifiedEngagementConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  const c = config as Record<string, unknown>;
  const su = c["_simpleUnified"];
  if (!su || typeof su !== "object" || Array.isArray(su)) return false;
  const sats = (su as { satsPerWinner?: unknown }).satsPerWinner;
  return typeof sats === "number" && sats >= 0;
}

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
