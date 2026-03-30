export type UnifiedCampaignPhase =
  | "Draft"
  | "Reviewing"
  | "Locked"
  | "Paying"
  | "Completed"
  | "Completed with issues"
  | "Canceled";

export type UnifiedPayoutItemPhase =
  | "Pending"
  | "Paying"
  | "Paid via wallet"
  | "Paid manually"
  | "Failed"
  | "Skipped"
  | "Needs review";

type GiveawayStatus =
  | "DRAFT"
  | "PREVIEWED"
  | "LOCKED"
  | "PAID_OUT"
  | "CANCELLED";
type ContestStatus =
  | "DRAFT"
  | "SCHEDULED_LAUNCH"
  | "LIVE"
  | "ENDED_REVIEW"
  | "LOCKED"
  | "PAYOUT_IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export function mapGiveawayCampaignPhase(
  status: GiveawayStatus,
  hasIssues = false
): UnifiedCampaignPhase {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PREVIEWED":
      return "Reviewing";
    case "LOCKED":
      return "Locked";
    case "PAID_OUT":
      return hasIssues ? "Completed with issues" : "Completed";
    case "CANCELLED":
      return "Canceled";
    default:
      return "Draft";
  }
}

export function mapContestCampaignPhase(
  status: ContestStatus,
  hasIssues = false
): UnifiedCampaignPhase {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SCHEDULED_LAUNCH":
      return "Draft";
    case "ENDED_REVIEW":
      return "Reviewing";
    case "LOCKED":
      return "Locked";
    case "PAYOUT_IN_PROGRESS":
      return "Paying";
    case "COMPLETED":
      return hasIssues ? "Completed with issues" : "Completed";
    case "CANCELLED":
      return "Canceled";
    case "LIVE":
      return "Draft";
    default:
      return "Draft";
  }
}

export function mapPayoutItemPhase(status: string): UnifiedPayoutItemPhase {
  switch (status) {
    case "paying":
    case "running":
      return "Paying";
    case "sent":
    case "paid":
      return "Paid via wallet";
    case "marked_paid":
      return "Paid manually";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "claim_needed":
    case "needs_review":
      return "Needs review";
    case "pending":
    default:
      return "Pending";
  }
}

export function isPayoutItemSettled(status: string): boolean {
  const phase = mapPayoutItemPhase(status);
  return phase === "Paid via wallet" || phase === "Paid manually";
}
