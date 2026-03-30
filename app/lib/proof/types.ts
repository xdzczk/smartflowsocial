/**
 * Normalized proof card model — templates and copy helpers read only this shape.
 */

export type ProofDomain = "admin" | "giveaway" | "contest";

/** Logical ratio; maps to 4:5, 1:1, 16:9 in ratios.ts */
export type ProofRatio = "portrait" | "square" | "landscape";

export type ProofCardType =
  | "public-summary"
  | "fairness-proof"
  | "receipt"
  | "milestone"
  | "reliability"
  | "adoption"
  | "product"
  | "range";

export type ProofStatusTone = "neutral" | "success" | "warning";

export interface ProofCardFooter {
  productLabel?: string;
  snapshotLabel?: string;
  timeRangeLabel?: string;
  referenceLabel?: string;
}

export interface ProofCardBranding {
  showLogo?: boolean;
  showDomainLabel?: boolean;
}

/** Optional display toggles (rail); adapters strip sensitive parts when false */
export interface ProofDisplayOptions {
  showTimestamp?: boolean;
  showReferenceId?: boolean;
  showLogo?: boolean;
}

export interface ProofCardPayload {
  domain: ProofDomain;
  cardType: ProofCardType;
  ratio: ProofRatio;
  title: string;
  /** Template / section label above title */
  eyebrow?: string;
  subtitle?: string;
  heroValue?: string;
  heroLabel?: string;
  stats?: Array<{ label: string; value: string; emphasis?: boolean }>;
  statusBadge?: { label: string; tone: ProofStatusTone };
  footer?: ProofCardFooter;
  branding?: ProofCardBranding;
  /** Admin: dashboard range scope for milestone/range cards */
  adminScope?: "all-time" | "selected-range" | "hybrid";
  /** Giveaway / contest settlement (optional) */
  winnersCount?: number;
  satsPlanned?: number;
  satsPaid?: number;
  paidViaWalletCount?: number;
  paidManuallyCount?: number;
  unresolvedCount?: number;
  finalizedAtLabel?: string;
  referenceId?: string;
  selectionSummary?: string;
  payoutMethodSummary?: string;
  finalizationFeeSats?: number;
  planTierLabel?: string;
  autoPayoutUsed?: boolean;
  /** Admin: show big metric before optional title line */
  metricFirst?: boolean;
}

export type AdminProofCardType =
  | "milestone"
  | "reliability"
  | "adoption"
  | "product"
  | "range";

/** Map legacy admin proof-card-build types to shared ProofCardType */
export function adminCardTypeToShared(
  t:
    | "milestone"
    | "range_performance"
    | "reliability"
    | "adoption"
    | "product_progress"
): ProofCardType {
  switch (t) {
    case "range_performance":
      return "range";
    case "product_progress":
      return "product";
    default:
      return t;
  }
}
