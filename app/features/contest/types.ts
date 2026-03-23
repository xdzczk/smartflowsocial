export type ContestRankingMetric = "REACTIONS" | "ZAPS" | "SATS_ZAPPED";
export type ContestPrizeMode = "EQUAL" | "RANKED";
export type ContestStatus =
  | "DRAFT"
  | "LIVE"
  | "ENDED_REVIEW"
  | "LOCKED"
  | "PAYOUT_IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface ContestFilters {
  excludeMuted?: boolean;
  excludeBlocked?: boolean;
  excludeLowTrust?: boolean;
  excludeNonFollowers?: boolean;
  minAccountAgeDays?: number;
  minFollowers?: number;
}

export interface ContestRankReward {
  rank: number;
  sats: number;
}

export interface ContestEntryScore {
  entryEventId: string;
  authorPubkey: string;
  authorNpub?: string;
  createdAtUnix: number;
  replySnippet?: string;
  reactionsCount: number;
  zapCount: number;
  satsZapped: number;
  score: number;
}
