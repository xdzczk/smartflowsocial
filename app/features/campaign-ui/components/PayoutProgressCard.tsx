import type { BatchPayoutProgressSnapshot } from "~/features/payments/components/BatchPayoutStatusBanner";

import { payoutCopy } from "../payout-copy";

export function PayoutProgressCard({
  active,
  progress,
}: {
  active: boolean;
  progress?: BatchPayoutProgressSnapshot | null;
}) {
  if (!active && !progress) return null;

  const processed =
    progress && progress.totalSteps > 0
      ? Math.min(progress.stepIndex + 1, progress.totalSteps)
      : 0;
  const totalSteps = progress?.totalSteps ?? 0;
  const pct = totalSteps > 0 ? Math.round((100 * processed) / totalSteps) : 0;

  return (
    <div className="border-border bg-primary/5 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">
        {active ? "Payout in progress" : "Payout summary"}
      </p>
      <p className="text-muted-foreground text-xs">
        {active
          ? "Your connected wallet processes each winner in order. Keep this tab open until payout completes."
          : "Latest payout execution details."}
      </p>
      {totalSteps > 0 ? (
        <>
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              Processed: {processed} / {totalSteps}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-muted-foreground text-xs">
            Ledger: {progress?.totals.paid ?? 0} {payoutCopy.paidViaWallet} ·{" "}
            {progress?.totals.failed ?? 0} {payoutCopy.failed.toLowerCase()} ·{" "}
            {progress?.totals.claimNeeded ?? 0}{" "}
            {payoutCopy.needsReview.toLowerCase()} ·{" "}
            {progress?.totals.skipped ?? 0} {payoutCopy.skipped.toLowerCase()}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">Starting payout run…</p>
      )}
    </div>
  );
}
