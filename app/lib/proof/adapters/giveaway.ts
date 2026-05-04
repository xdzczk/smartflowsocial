import { BRAND_NAME } from "~/lib/brand";

import type {
  ProofCardPayload,
  ProofCardType,
  ProofDisplayOptions,
  ProofRatio,
} from "../types";

export interface GiveawayProofStudioDto {
  id: string;
  title: string;
  scopeSummaryLabel: string;
  statusLabel: string;
  winnerCount: number;
  /** Planned payout from snapshot / budget */
  satsPlanned: number;
  satsPaid: number;
  paidViaWalletCount: number;
  paidManuallyCount: number;
  unresolvedCount: number;
  finalizationFeeSats: number | null;
  planAtFinalization: string | null;
  payoutWalletMode: "manual" | "nwc_creator";
  payoutAutoRunEnabled: boolean;
  completedAtLabel: string;
  selectionMode: string;
  eligiblePoolSize?: number | null;
}

function selectionModeLabel(mode: string): string {
  return mode === "WEIGHTED_BY_ENGAGEMENT"
    ? "Weighted by engagement"
    : "Unique user";
}

function payoutMethodSummary(dto: GiveawayProofStudioDto): string {
  if (dto.payoutWalletMode === "nwc_creator") {
    if (dto.payoutAutoRunEnabled) return "Auto-paid via wallet (NWC)";
    return "Paid via wallet (NWC), manual trigger";
  }
  if (dto.paidViaWalletCount > 0 && dto.paidManuallyCount > 0) {
    return "Manual + wallet split";
  }
  return "Manual confirmation";
}

function buildFooter(
  dto: GiveawayProofStudioDto,
  opts: ProofDisplayOptions | undefined,
  includeRef: boolean
): ProofCardPayload["footer"] {
  const lines: ProofCardPayload["footer"] = {
    productLabel: BRAND_NAME,
    snapshotLabel:
      opts?.showTimestamp !== false ? dto.completedAtLabel : undefined,
  };
  if (includeRef && opts?.showReferenceId) {
    lines.referenceLabel = `Ref · ${dto.id.slice(0, 8)}…`;
  }
  return lines;
}

export function buildGiveawayProofPayload(
  dto: GiveawayProofStudioDto,
  cardType: Extract<
    ProofCardType,
    "public-summary" | "fairness-proof" | "receipt"
  >,
  ratio: ProofRatio,
  options?: ProofDisplayOptions
): ProofCardPayload {
  const branding = {
    showLogo: options?.showLogo !== false,
    showDomainLabel: true,
  };

  const settlementComplete = dto.unresolvedCount === 0;

  if (cardType === "public-summary") {
    const stats: ProofCardPayload["stats"] = [
      { label: "Winners", value: String(dto.winnerCount) },
      { label: "Scope", value: dto.scopeSummaryLabel },
      { label: "Completed", value: dto.completedAtLabel },
    ];
    if (dto.payoutAutoRunEnabled && dto.payoutWalletMode === "nwc_creator") {
      stats.push({ label: "Payout", value: "Auto (wallet)" });
    }

    const planTrim = dto.planAtFinalization?.trim();
    if (planTrim && stats.length < 4 && planTrim.toLowerCase() !== "free") {
      stats.push({ label: "Plan", value: planTrim });
    }

    return {
      domain: "giveaway",
      cardType,
      ratio,
      metricFirst: true,
      title: dto.title,
      eyebrow: "Giveaway complete",
      heroValue: dto.satsPlanned.toLocaleString(),
      heroLabel: "sats distributed",
      subtitle: dto.scopeSummaryLabel,
      stats: stats.slice(0, 4),
      statusBadge: {
        label: dto.statusLabel,
        tone: "success",
      },
      footer: buildFooter(dto, options, true),
      branding,
      winnersCount: dto.winnerCount,
      satsPlanned: dto.satsPlanned,
      finalizedAtLabel: dto.completedAtLabel,
      referenceId: dto.id,
      autoPayoutUsed:
        dto.payoutWalletMode === "nwc_creator" && dto.payoutAutoRunEnabled,
      planTierLabel: dto.planAtFinalization ?? undefined,
    };
  }

  if (cardType === "fairness-proof") {
    const stats: ProofCardPayload["stats"] = [
      {
        label: "Eligible (last preview)",
        value:
          dto.eligiblePoolSize != null ? String(dto.eligiblePoolSize) : "—",
      },
      { label: "Winners", value: String(dto.winnerCount) },
      {
        label: "Unresolved",
        value: String(dto.unresolvedCount),
        emphasis: dto.unresolvedCount > 0,
      },
      { label: "Selection", value: selectionModeLabel(dto.selectionMode) },
    ];

    return {
      domain: "giveaway",
      cardType,
      ratio,
      title: dto.title,
      eyebrow: "Fairness proof",
      subtitle: payoutMethodSummary(dto),
      stats,
      statusBadge: settlementComplete
        ? { label: "Selection finalized", tone: "success" }
        : { label: `${dto.unresolvedCount} unresolved`, tone: "warning" },
      footer: buildFooter(dto, options, true),
      branding,
      selectionSummary: selectionModeLabel(dto.selectionMode),
      payoutMethodSummary: payoutMethodSummary(dto),
      unresolvedCount: dto.unresolvedCount,
      winnersCount: dto.winnerCount,
      referenceId: dto.id,
    };
  }

  // receipt  -  merge into ≤4 stats per product rules
  const fee = dto.finalizationFeeSats ?? 0;
  const stats: ProofCardPayload["stats"] = [
    { label: "Recipients", value: String(dto.winnerCount) },
    {
      label: "Sats planned / paid",
      value: `${dto.satsPlanned.toLocaleString()} / ${dto.satsPaid.toLocaleString()}`,
    },
    {
      label: "Wallet · manual",
      value: `${dto.paidViaWalletCount} · ${dto.paidManuallyCount}`,
    },
    {
      label: fee > 0 ? "Fee · completed" : "Completed",
      value:
        fee > 0
          ? `${fee.toLocaleString()} sats · ${dto.completedAtLabel}`
          : dto.completedAtLabel,
    },
  ];

  return {
    domain: "giveaway",
    cardType,
    ratio,
    title: dto.title,
    eyebrow: "Settlement receipt",
    subtitle: payoutMethodSummary(dto),
    stats,
    statusBadge: settlementComplete
      ? { label: "Settlement complete", tone: "success" }
      : { label: "Settlement incomplete", tone: "warning" },
    footer: buildFooter(dto, options, true),
    branding,
    winnersCount: dto.winnerCount,
    satsPlanned: dto.satsPlanned,
    satsPaid: dto.satsPaid,
    paidViaWalletCount: dto.paidViaWalletCount,
    paidManuallyCount: dto.paidManuallyCount,
    unresolvedCount: dto.unresolvedCount,
    finalizationFeeSats: fee > 0 ? fee : undefined,
    finalizedAtLabel: dto.completedAtLabel,
    referenceId: dto.id,
  };
}
