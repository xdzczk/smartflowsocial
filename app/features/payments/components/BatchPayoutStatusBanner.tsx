import { Loader2 } from "lucide-react";

import { cn } from "~/lib/utils";

export interface BatchPayoutProgressSnapshot {
  stepIndex: number;
  totalSteps: number;
  totals: {
    paid: number;
    failed: number;
    claimNeeded: number;
    skipped: number;
  };
}

/**
 * Shown while a campaign batch NWC payout request is in flight (server pays invoices sequentially).
 * Optional `progress` shows per-step counts after each round-trip (stepped batch mode).
 */
export function BatchPayoutStatusBanner({
  active,
  className,
  progress,
}: {
  active: boolean;
  className?: string;
  progress?: BatchPayoutProgressSnapshot | null;
}) {
  if (!active) return null;

  const processed =
    progress && progress.totalSteps > 0
      ? Math.min(progress.stepIndex + 1, progress.totalSteps)
      : null;
  const pct =
    progress && progress.totalSteps > 0 && processed !== null
      ? (100 * processed) / progress.totalSteps
      : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "border-border bg-brand/5 relative overflow-hidden rounded-lg border",
        className
      )}
    >
      <div
        className="bg-surface-hover pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden"
        aria-hidden
      >
        <div className="bg-brand/45 h-full w-full animate-pulse" />
      </div>
      <div className="flex items-start gap-3 p-3 pt-4">
        <Loader2
          className="text-link mt-0.5 h-4 w-4 shrink-0 animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="text-text text-sm font-medium">
              Batch payout in progress
            </p>
            <p className="text-text-secondary text-xs leading-relaxed">
              Your wallet is paying each Lightning invoice. Progress updates
              after each payment - keep this tab open until it finishes.
            </p>
          </div>
          {progress && progress.totalSteps > 0 ? (
            <>
              <p className="text-text-secondary text-xs">
                Winners processed: {processed} / {progress.totalSteps}
              </p>
              <div className="bg-surface-hover h-2 overflow-hidden rounded-full">
                <div
                  className="bg-brand h-full transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-text-secondary text-xs">
                Ledger: {progress.totals.paid} paid · {progress.totals.failed}{" "}
                failed · {progress.totals.claimNeeded} need claim ·{" "}
                {progress.totals.skipped} skipped
              </p>
            </>
          ) : (
            <p className="text-text-secondary text-xs">Starting batch…</p>
          )}
        </div>
      </div>
    </div>
  );
}
