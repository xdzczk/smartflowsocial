/**
 * Nostr Types
 * Shared TypeScript interfaces for Nostr-related operations
 */

/**
 * Core Nostr event data structure for creating events
 */
export interface NostrEventData {
  content: string;
  created_at: number;
  kind?: number;
  tags?: string[][];
}

/**
 * Unsigned Nostr event
 */
export interface NostrEvent {
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
}

/**
 * Signed Nostr event with signature and metadata
 */
export interface SignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Result from signing an event
 */
export interface SignEventResult {
  nostrEvent: NostrEvent;
  signedEvent: SignedEvent;
}

/**
 * Long-form event data for NIP-23 articles
 */
export interface LongFormEventData {
  title: string;
  content: string;
  summary?: string;
  image?: string;
  tags?: string[];
  publishedAt?: number;
  identifier?: string;
}

/**
 * Primal API event structure
 */
export interface PrimalEvent {
  [0]: string;
  [1]: string;
  [2]: {
    kind: number;
    content: string;
    [key: string]: unknown;
  };
}

/**
 * Profile data from Nostr kind 0 events
 */
export interface ProfileData {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
  [key: string]: unknown;
}

/**
 * Stats data from Primal API
 */
export interface StatsData {
  followers_count?: number;
  follows_count?: number;
  note_count?: number;
  total_zap_count?: number;
  total_satszapped?: number;
  [key: string]: unknown;
}

/**
 * Media data record
 */
export type MediaData = Record<string, unknown>;

/**
 * Processed profile with stats
 */
export interface ProcessedProfile extends ProfileData {
  followers_count: number;
  following_count: number;
  posts_count: number;
  zaps_count: number;
  total_satszapped: number;
  media: MediaData;
}

/**
 * Complete profile result from API
 */
export interface CompleteProfileResult {
  nostrProfile: ProcessedProfile;
  lud16?: string;
}

/**
 * Parameters for getting complete profile
 */
export interface GetCompleteProfileParams {
  npub: string;
}

/**
 * Nostr profile type for authentication
 */
export interface NostrProfileType {
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  [key: string]: string | undefined;
}

/**
 * Props for RelaysSettings component
 */
export interface RelaysSettingsProps {
  relays: string[];
  onRelaysChange: (relays: string[]) => void;
  isLoading?: boolean;
}
