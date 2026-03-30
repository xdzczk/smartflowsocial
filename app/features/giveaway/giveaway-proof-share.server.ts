/**
 * Text proof lines for sharing completed giveaways.
 * Copy is derived from the same payload shape as Proof Studio cards.
 */

import { buildProofSummary } from "~/lib/proof";
import {
  buildGiveawayProofPayload,
  type GiveawayProofStudioDto,
} from "~/lib/proof/adapters/giveaway";

function summaryLinesFromPayload(
  ...args: Parameters<typeof buildGiveawayProofPayload>
): string[] {
  const text = buildProofSummary(buildGiveawayProofPayload(...args));
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function buildGiveawayPublicSummaryLines(input: {
  title: string;
  scopeLine: string;
  winnerCount: number;
  budgetSats: number;
  completedAtLabel: string;
}): string[] {
  const dto: GiveawayProofStudioDto = {
    id: "share",
    title: input.title,
    scopeSummaryLabel: input.scopeLine,
    statusLabel: "Paid out",
    winnerCount: input.winnerCount,
    satsPlanned: input.budgetSats,
    satsPaid: input.budgetSats,
    paidViaWalletCount: 0,
    paidManuallyCount: 0,
    unresolvedCount: 0,
    finalizationFeeSats: null,
    planAtFinalization: null,
    payoutWalletMode: "manual",
    payoutAutoRunEnabled: false,
    completedAtLabel: input.completedAtLabel,
    selectionMode: "UNIQUE_USER",
    eligiblePoolSize: null,
  };
  return summaryLinesFromPayload(dto, "public-summary", "portrait", {});
}

/** One-line receipt for copy (includes fee and plan for the organizer). */
export function buildGiveawayReceiptSummaryLine(input: {
  scopeSummaryLabel: string;
  winnerCount: number;
  plannedPayoutSats: number;
  finalizationFeeSats: number;
  planAtFinalization: string | null;
  completedAtLabel: string;
}): string {
  const planTrim = input.planAtFinalization?.trim();
  const plan = planTrim && planTrim.length > 0 ? planTrim : "—";
  return `${input.scopeSummaryLabel} · ${input.winnerCount} winner${input.winnerCount === 1 ? "" : "s"} · ${input.plannedPayoutSats.toLocaleString()} sats planned · ${input.finalizationFeeSats.toLocaleString()} sats finalization fee · Plan: ${plan} · Completed ${input.completedAtLabel}`;
}

export function buildGiveawayFairnessProofLines(input: {
  title: string;
  eligiblePoolSize?: number;
  selectionModeLabel: string;
  lockedOrCompletedAt: string;
}): string[] {
  const dto: GiveawayProofStudioDto = {
    id: "share",
    title: input.title,
    scopeSummaryLabel: "—",
    statusLabel: "Paid out",
    winnerCount: 0,
    satsPlanned: 0,
    satsPaid: 0,
    paidViaWalletCount: 0,
    paidManuallyCount: 0,
    unresolvedCount: 0,
    finalizationFeeSats: null,
    planAtFinalization: null,
    payoutWalletMode: "manual",
    payoutAutoRunEnabled: false,
    completedAtLabel: input.lockedOrCompletedAt,
    selectionMode:
      input.selectionModeLabel === "Weighted by engagement"
        ? "WEIGHTED_BY_ENGAGEMENT"
        : "UNIQUE_USER",
    eligiblePoolSize: input.eligiblePoolSize,
  };
  return summaryLinesFromPayload(dto, "fairness-proof", "portrait", {});
}
