/**
 * NIP-88 poll types (shared client/server).
 * @see https://nips.nostr.com/88
 */

export type PollType = "singlechoice" | "multiplechoice";

export interface PollOption {
  id: string;
  label: string;
}

export interface PollDefinition {
  id: string;
  pubkey: string;
  question: string;
  options: PollOption[];
  pollType: PollType;
  /** Unix seconds when poll closes; undefined if open-ended */
  endsAt?: number;
  relayUrls: string[];
  createdAt: number;
}

export interface PollTallyResult {
  /** Votes per option id */
  counts: Record<string, number>;
  /** Distinct pubkeys counted after NIP-88 rules */
  totalVoters: number;
}
