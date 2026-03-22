/**
 * Finalization fee (plan-based) and lock config hash for giveaway anti-gaming.
 * UI copy: "Finalization fee"; internal: bps / sats.
 */

import { createHash } from "node:crypto";

import type { PlanType } from "~/features/payments/types";

import {
  computeFinalizationFeeSats,
  getFinalizationFeeRateBps,
} from "./giveaway-finalization-fee.shared";
import type { GiveawayWinnerEntry } from "./types";

export {
  computeFinalizationFeeSats,
  getFinalizationFeeRateBps,
} from "./giveaway-finalization-fee.shared";

function stableValue(v: unknown): unknown {
  if (v === null || typeof v !== "object") {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map((x) => stableValue(x));
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = stableValue(o[k]);
  }
  return out;
}

export function canonicalWinnerRowsForLockHash(
  snapshot: GiveawayWinnerEntry[]
): Array<{ pubkey: string; satsPerWinner: number }> {
  return [...snapshot]
    .map((w) => ({
      pubkey: w.pubkey,
      satsPerWinner: w.satsPerWinner ?? 0,
    }))
    .sort((a, b) => a.pubkey.localeCompare(b.pubkey));
}

/** Hash bound to preview snapshot + rules that affect payout and selection. */
export function buildLockConfigHash(g: {
  winnerSnapshot: unknown;
  engagementConfig: unknown;
  winnerCount: number;
  selectionMode: string;
  scopeType: string;
  scopeReference: unknown;
  engagementTypes: unknown;
  filters: unknown;
  engagementWeights: unknown;
}): string {
  const snapshot = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  const types = Array.isArray(g.engagementTypes)
    ? [...(g.engagementTypes as string[])].sort()
    : g.engagementTypes;

  const payload = {
    snapshot: canonicalWinnerRowsForLockHash(snapshot),
    engagementConfig: stableValue(g.engagementConfig),
    winnerCount: g.winnerCount,
    selectionMode: g.selectionMode,
    scopeType: g.scopeType,
    scopeReference: stableValue(g.scopeReference),
    engagementTypes: stableValue(types),
    filters: stableValue(g.filters),
    engagementWeights: stableValue(g.engagementWeights),
  };

  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}

export interface GiveawayFinalizationQuote {
  plannedPayoutSats: number;
  feeRateBps: number;
  feeSats: number;
  dueNowSats: number;
  waivedByPlan: boolean;
  lockConfigHash: string;
}

export function quoteGiveawayFinalization(input: {
  giveaway: {
    winnerSnapshot: unknown;
    engagementConfig: unknown;
    winnerCount: number;
    selectionMode: string;
    scopeType: string;
    scopeReference: unknown;
    engagementTypes: unknown;
    filters: unknown;
    engagementWeights: unknown;
  };
  planType: PlanType;
}): GiveawayFinalizationQuote {
  const snapshot =
    (input.giveaway.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  const plannedPayoutSats = snapshot.reduce(
    (acc, w) => acc + (w.satsPerWinner ?? 0),
    0
  );
  const feeRateBps = getFinalizationFeeRateBps(input.planType);
  const { feeSats, waivedByPlan } = computeFinalizationFeeSats(
    plannedPayoutSats,
    feeRateBps
  );
  const lockConfigHash = buildLockConfigHash(input.giveaway);

  return {
    plannedPayoutSats,
    feeRateBps,
    feeSats,
    dueNowSats: feeSats,
    waivedByPlan,
    lockConfigHash,
  };
}
