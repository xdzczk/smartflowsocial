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
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : phase === "Failed"
        ? "bg-destructive/15 text-destructive"
        : phase === NEEDS_REVIEW_PHASE
          ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
