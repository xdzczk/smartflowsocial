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
