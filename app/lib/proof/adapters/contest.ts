import type {
  ProofCardPayload,
  ProofCardType,
  ProofDisplayOptions,
  ProofRatio,
} from "../types";

export interface ContestProofStudioDto {
  id: string;
  title: string;
  rankingMetric: string;
  statusLabel: string;
  winnerCount: number;
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
  tieBreakRule: string | null;
  entryType: string;
  eligibleEntries: number | null;
  durationLabel: string;
}

function payoutMethodSummary(dto: ContestProofStudioDto): string {
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
  dto: ContestProofStudioDto,
  opts: ProofDisplayOptions | undefined,
  includeRef: boolean
): ProofCardPayload["footer"] {
  const lines: ProofCardPayload["footer"] = {
    productLabel: "SmartFlow Social",
    snapshotLabel:
      opts?.showTimestamp !== false ? dto.completedAtLabel : undefined,
  };
  if (includeRef && opts?.showReferenceId) {
    lines.referenceLabel = `Ref · ${dto.id.slice(0, 8)}…`;
  }
  return lines;
}

export function buildContestProofPayload(
  dto: ContestProofStudioDto,
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
  const metric = dto.rankingMetric.toLowerCase();

  if (cardType === "public-summary") {
    const stats: ProofCardPayload["stats"] = [
      { label: "Winners", value: String(dto.winnerCount) },
      { label: "Metric", value: metric },
      { label: "Window", value: dto.durationLabel },
      { label: "Completed", value: dto.completedAtLabel },
    ];

    return {
      domain: "contest",
      cardType,
      ratio,
      metricFirst: true,
      title: dto.title,
      eyebrow: "Contest complete",
      heroValue: dto.satsPlanned.toLocaleString(),
      heroLabel: "sats planned payout",
      subtitle: `${metric} · ${dto.durationLabel}`,
      stats: stats.slice(0, 4),
      statusBadge: { label: dto.statusLabel, tone: "success" },
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
        label: "Eligible entries",
        value: dto.eligibleEntries != null ? String(dto.eligibleEntries) : "—",
      },
      { label: "Winners", value: String(dto.winnerCount) },
      {
        label: "Unresolved",
        value: String(dto.unresolvedCount),
        emphasis: dto.unresolvedCount > 0,
      },
      { label: "Entry type", value: String(dto.entryType).replace(/_/g, " ") },
    ];

    return {
      domain: "contest",
      cardType,
      ratio,
      title: dto.title,
      eyebrow: "Fairness proof",
      subtitle: payoutMethodSummary(dto),
      stats,
      statusBadge: settlementComplete
        ? { label: "Payouts resolved", tone: "success" }
        : { label: `${dto.unresolvedCount} unresolved`, tone: "warning" },
      footer: buildFooter(dto, options, true),
      branding,
      payoutMethodSummary: payoutMethodSummary(dto),
      unresolvedCount: dto.unresolvedCount,
      winnersCount: dto.winnerCount,
      referenceId: dto.id,
      selectionSummary: dto.tieBreakRule
        ? `Tie-break: ${dto.tieBreakRule}`
        : undefined,
    };
  }

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
    domain: "contest",
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
