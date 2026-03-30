import { useFetcher } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import ZapButton from "~/components/dashboard/ZapButton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  PayoutProgressCard,
  mapPayoutItemPhase,
  payoutCopy,
} from "~/features/campaign-ui";
import type { BatchPayoutProgressSnapshot } from "~/features/payments/components/BatchPayoutStatusBanner";

import type { GiveawayWinnerEntry } from "../../types";

import type {
  GiveawayPayoutProgress,
  WinnerProfileDisplay,
} from "./giveaway-detail-types";
import {
  NEEDS_REVIEW_PHASE,
  PAID_MANUALLY_PHASE,
} from "./giveaway-detail-utils";
import { GiveawayDetailPayoutStatusBadge } from "./GiveawayDetailPayoutStatusBadge";
import { WinnerNpubRow } from "./WinnerNpubRow";

export function GiveawayDetailBatchZapFlow({
  giveawayId: _giveawayId,
  winners,
  winnerProfiles,
  lockedAt,
  payoutProgress,
  payoutState = {},
  paidFetcher,
  getProfileUrl,
  nwcEnabled,
}: {
  giveawayId: string;
  winners: GiveawayWinnerEntry[];
  winnerProfiles: Record<string, WinnerProfileDisplay>;
  lockedAt: string | null;
  payoutProgress?: GiveawayPayoutProgress | null;
  payoutState?: Record<
    string,
    { status: string; updatedAt?: string; note?: string }
  >;
  paidFetcher: ReturnType<
    typeof useFetcher<{ success?: boolean; error?: string }>
  >;
  getProfileUrl: (npub: string) => string;
  nwcEnabled: boolean;
}) {
  const payoutFetcher = useFetcher();
  const batchPayoutFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    done?: boolean;
    nextStep?: number | null;
    stepIndex?: number;
    totalSteps?: number;
    totals?: {
      items: number;
      paid: number;
      failed: number;
      claimNeeded: number;
      skipped: number;
    };
  }>();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const isBatchPayoutPending = batchPayoutFetcher.state !== "idle";
  const payoutControlsBusy =
    payoutFetcher.state !== "idle" || batchPayoutFetcher.state !== "idle";

  const batchProgressSnapshot: BatchPayoutProgressSnapshot | null =
    batchPayoutFetcher.data &&
    batchPayoutFetcher.data.success === true &&
    batchPayoutFetcher.data.totals &&
    typeof batchPayoutFetcher.data.stepIndex === "number" &&
    typeof batchPayoutFetcher.data.totalSteps === "number"
      ? {
          stepIndex: batchPayoutFetcher.data.stepIndex,
          totalSteps: batchPayoutFetcher.data.totalSteps,
          totals: {
            paid: batchPayoutFetcher.data.totals.paid,
            failed: batchPayoutFetcher.data.totals.failed,
            claimNeeded: batchPayoutFetcher.data.totals.claimNeeded,
            skipped: batchPayoutFetcher.data.totals.skipped,
          },
        }
      : null;

  useEffect(() => {
    if (batchPayoutFetcher.state !== "idle") return;
    const d = batchPayoutFetcher.data;
    if (!d || d.success !== true) return;
    if (d.done !== false || typeof d.nextStep !== "number") return;
    const fd = new FormData();
    fd.set("intent", "runBatchPayout");
    fd.set("stepIndex", String(d.nextStep));
    batchPayoutFetcher.submit(fd, { method: "post" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chained batch steps; deps are state/data only
  }, [batchPayoutFetcher.state, batchPayoutFetcher.data]);

  const allSettled =
    winners.length > 0 &&
    winners.every((w) => {
      const s = payoutState[w.pubkey]?.status;
      return s === "sent" || s === "marked_paid";
    });
  const payoutTally = winners.reduce(
    (acc, w) => {
      const phase = mapPayoutItemPhase(
        payoutState[w.pubkey]?.status ?? "pending"
      );
      if (phase === "Paid via wallet" || phase === "Paid manually")
        acc.paid += 1;
      else if (phase === "Failed") acc.failed += 1;
      else if (phase === NEEDS_REVIEW_PHASE) acc.needsReview += 1;
      else if (phase === "Skipped") acc.skipped += 1;
      else acc.pending += 1;
      return acc;
    },
    { paid: 0, failed: 0, needsReview: 0, skipped: 0, pending: 0 }
  );

  const submitPayout = (pubkey: string, status: string) => {
    const fd = new FormData();
    fd.set("intent", "updatePayout");
    fd.set("winnerPubkey", pubkey);
    fd.set("payoutStatus", status);
    payoutFetcher.submit(fd, { method: "post" });
  };

  return (
    <div className="space-y-4">
      <div className="border-border rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-foreground font-semibold">Winners locked</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Winners fixed at{" "}
          {lockedAt ? new Date(lockedAt).toLocaleString() : "—"}.{" "}
          {payoutCopy.lockTrustNote}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!nwcEnabled || payoutControlsBusy}
            onClick={() => {
              const fd = new FormData();
              fd.set("intent", "runBatchPayout");
              fd.set("stepIndex", "0");
              batchPayoutFetcher.submit(fd, { method: "post" });
            }}
            className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"
            title={
              nwcEnabled
                ? "Pay all winners using your connected wallet"
                : "Connect NWC in Settings to enable auto payouts"
            }
          >
            {isBatchPayoutPending ? (
              <>
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin"
                  aria-hidden
                />
                Paying winners…
              </>
            ) : (
              payoutCopy.payWinnersNow
            )}
          </button>
          {!nwcEnabled ? (
            <span className="text-muted-foreground text-xs">
              Auto payout requires NWC. Manual zaps still work.
            </span>
          ) : null}
        </div>
        <PayoutProgressCard
          active={isBatchPayoutPending}
          progress={batchProgressSnapshot}
        />
        {batchPayoutFetcher.data &&
        batchPayoutFetcher.data.success === false &&
        batchPayoutFetcher.data.error ? (
          <p className="text-destructive mt-2 text-xs">
            {batchPayoutFetcher.data.error}
          </p>
        ) : null}
        {payoutProgress ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                Progress: {payoutProgress.settledCount}/
                {payoutProgress.totalWinners} marked sent or paid
              </span>
              <span className="text-muted-foreground">
                {payoutProgress.settledSats.toLocaleString()} /{" "}
                {payoutProgress.budgetSats.toLocaleString()} sats (budget)
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{
                  width: `${payoutProgress.totalWinners > 0 ? (100 * payoutProgress.settledCount) / payoutProgress.totalWinners : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-border bg-card space-y-2 rounded-lg border p-3 text-sm">
        <p className="font-medium">
          {payoutTally.paid} paid · {payoutTally.failed} failed ·{" "}
          {payoutTally.needsReview} needs review · {payoutTally.skipped} skipped
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={payoutControlsBusy}
            onClick={() => {
              winners.forEach((w) => {
                const phase = mapPayoutItemPhase(
                  payoutState[w.pubkey]?.status ?? "pending"
                );
                if (phase === "Failed" || phase === NEEDS_REVIEW_PHASE) {
                  submitPayout(w.pubkey, "pending");
                }
              });
            }}
          >
            Retry failed
          </Button>
        </div>
      </div>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {winners.map((w) => {
          const st = payoutState[w.pubkey]?.status ?? "pending";
          const phase = mapPayoutItemPhase(st);
          const canRetry = phase === "Failed" || phase === NEEDS_REVIEW_PHASE;
          const canMarkFailed =
            phase === "Pending" || phase === PAID_MANUALLY_PHASE;
          const canMarkManual = phase === "Pending" || phase === "Failed";
          const canUseWallet =
            phase === "Pending" || phase === NEEDS_REVIEW_PHASE;
          return (
            <li
              key={w.pubkey}
              className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <WinnerNpubRow
                  npub={w.npub}
                  displayName={winnerProfiles[w.pubkey]?.displayName}
                  picture={winnerProfiles[w.pubkey]?.picture}
                  profileUrl={getProfileUrl(w.npub)}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <GiveawayDetailPayoutStatusBadge status={st} />
                  {w.satsPerWinner != null && w.satsPerWinner > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {w.satsPerWinner.toLocaleString()} sats
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canUseWallet ? (
                  <ZapButton
                    npub={w.npub}
                    amountSats={w.satsPerWinner}
                    size="sm"
                    onZapped={() => {
                      submitPayout(w.pubkey, "sent");
                    }}
                  />
                ) : null}
                {canMarkManual ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "marked_paid");
                    }}
                  >
                    {payoutCopy.markPaidManually}
                  </Button>
                ) : null}
                {canRetry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "pending");
                    }}
                  >
                    {payoutCopy.retry}
                  </Button>
                ) : null}
                {canMarkFailed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "failed");
                    }}
                  >
                    {payoutCopy.markFailed}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={paidFetcher.state !== "idle"}
          onClick={() => {
            if (allSettled) {
              const fd = new FormData();
              fd.set("intent", "markPaidOut");
              paidFetcher.submit(fd, { method: "post" });
            } else {
              setOverrideReason("");
              setShowCompleteDialog(true);
            }
          }}
        >
          Finish campaign
        </Button>
        {paidFetcher.data &&
        typeof paidFetcher.data === "object" &&
        "error" in paidFetcher.data &&
        paidFetcher.data.error ? (
          <p className="text-destructive text-sm">
            {String(paidFetcher.data.error)}
          </p>
        ) : null}
      </div>
      <AlertDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete with pending payouts?</AlertDialogTitle>
            <AlertDialogDescription>
              Not all winners are marked paid or sent. SmartFlowSocial does not
              custody prizes — you are responsible for actual payouts. Complete
              anyway only if you accept leaving some payouts untracked here.
              Enter a short reason (at least 10 characters); it is stored in
              your audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={overrideReason}
            onChange={(e) => {
              setOverrideReason(e.target.value);
            }}
            rows={3}
            className="border-border bg-background w-full rounded-md border p-2 text-sm"
            placeholder="Reason for completing before all payouts are marked…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={
                paidFetcher.state !== "idle" ||
                overrideReason.trim().length < 10
              }
              onClick={() => {
                const fd = new FormData();
                fd.set("intent", "markPaidOut");
                fd.set("completeOverrideReason", overrideReason.trim());
                paidFetcher.submit(fd, { method: "post" });
                setShowCompleteDialog(false);
              }}
            >
              Complete anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
