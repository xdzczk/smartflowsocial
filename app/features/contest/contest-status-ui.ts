import type { ContestStatus } from "./types";

export function formatContestStatusLabel(status: ContestStatus): string {
  switch (status) {
    case "ENDED_REVIEW":
      return "Ended - review winners";
    case "PAYOUT_IN_PROGRESS":
      return "Payout in progress";
    default:
      return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase());
  }
}
