/**
 * Shared types for public proof-of-work cards (client + server shape alignment).
 */

import type { RangePreset } from "./metrics/date-range";

export type ProofCardScope = "all-time" | "selected-range" | "hybrid";

export type ProofCardType =
  | "milestone"
  | "range_performance"
  | "reliability"
  | "adoption"
  | "product_progress";

/** Export / preview aspect ratio  -  layout rules differ per ratio, not just crop. */
export type ProofCardAspectRatio = "4:5" | "1:1" | "16:9";

export interface ProofCardData {
  rangePreset: RangePreset;
  rangeLabel: string;
  generatedAt: string;
  allTime: {
    postsPublished: number;
    longFormPublished: number;
    creatorsEverPublished: number;
    postsScheduled: number;
    referralSatsPaid: number;
  };
  inRange: {
    postsPublished: number;
    longFormPublished: number;
    referredSignups: number;
    postsWithMedia: number;
    publishersInRange: number;
    scheduledReposts: number;
    giveawaysLockedOrPaid: number;
  };
  last30d: {
    publishSuccessRate: number;
    successfulShortPublishes: number;
    failedShortPublishes: number;
  };
  reliability30d: {
    failedReferralPayouts: number;
  };
}
