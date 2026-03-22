import type { BroadcastCampaignStatus } from "@prisma/client";

const STATUS_LABEL: Record<BroadcastCampaignStatus, string> = {
  DRAFT: "Draft",
  AWAITING_SIGNATURE: "Awaiting signature",
  SCHEDULED: "Scheduled",
  QUEUED: "Queued",
  SENDING: "Sending",
  COMPLETED: "Completed",
  COMPLETED_WITH_FAILURES: "Completed with failures",
  PAUSED: "Paused",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

/** Tailwind-oriented badge token for dashboards (neutral / info / warn / success / danger / mixed). */
const STATUS_BADGE: Record<BroadcastCampaignStatus, string> = {
  DRAFT: "neutral",
  AWAITING_SIGNATURE: "info",
  SCHEDULED: "info",
  QUEUED: "warn",
  SENDING: "warn",
  COMPLETED: "success",
  COMPLETED_WITH_FAILURES: "mixed",
  PAUSED: "neutral",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function formatBroadcastCampaignStatus(
  status: BroadcastCampaignStatus
): string {
  return STATUS_LABEL[status];
}

export function broadcastStatusBadgeKind(
  status: BroadcastCampaignStatus
): string {
  return STATUS_BADGE[status];
}

export function isBroadcastCampaignTerminal(
  status: BroadcastCampaignStatus
): boolean {
  return (
    status === "COMPLETED" ||
    status === "COMPLETED_WITH_FAILURES" ||
    status === "CANCELLED" ||
    status === "FAILED"
  );
}

export function isBroadcastInFlight(status: BroadcastCampaignStatus): boolean {
  return (
    status === "SCHEDULED" ||
    status === "QUEUED" ||
    status === "SENDING" ||
    status === "PAUSED"
  );
}
