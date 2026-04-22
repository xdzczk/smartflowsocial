import { mapPayoutItemPhase } from "~/features/campaign-ui";

import {
  NEEDS_REVIEW_PHASE,
  PAID_MANUALLY_PHASE,
  PAID_VIA_WALLET_PHASE,
} from "./giveaway-detail-utils";

export function GiveawayDetailPayoutStatusBadge({
  status,
}: {
  status: string;
}) {
  const phase = mapPayoutItemPhase(status);
  const label = phase;
  const cls =
    phase === PAID_VIA_WALLET_PHASE || phase === PAID_MANUALLY_PHASE
      ? "bg-success/15 text-success-text"
      : phase === "Failed"
        ? "bg-danger/15 text-danger"
        : phase === NEEDS_REVIEW_PHASE
          ? "bg-warning/15 text-warning-text"
          : "bg-surface-hover text-text-secondary";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
