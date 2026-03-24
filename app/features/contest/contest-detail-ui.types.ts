/**
 * Serializable shapes for contest detail UI (safe to import from client components).
 */

export type ContestProfileMap = Record<
  string,
  { pubkey: string; npub: string; displayName: string; picture: string | null }
>;

export interface ContestWinnerRow {
  id: string;
  rank: number;
  rewardSats: number;
  isAlternate: boolean;
  score: number;
  authorPubkey: string;
  entryEventId: string;
  replySnippet: string | null;
  payoutStatus: string;
}

export interface ContestLeaderboardEntryRow {
  rank: number | null;
  score: number;
  authorPubkey: string;
  entryEventId: string;
  replySnippet: string | null;
  createdAtUnix: number;
  reactionsCount: number;
  zapCount: number;
  satsZapped: number;
}

export interface ContestLivePreviewRow {
  rank: number;
  entryEventId: string;
  authorPubkey: string;
  replySnippet: string | null;
  score: number;
  reactionsCount: number;
  zapCount: number;
  satsZapped: number;
  createdAtUnix: number;
}

export type ContestLeaderboardRow =
  | ContestLeaderboardEntryRow
  | ContestLivePreviewRow;
