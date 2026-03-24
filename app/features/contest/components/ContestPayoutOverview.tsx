import { Form } from "@remix-run/react";

import { CampaignPayoutOverviewShell } from "~/features/campaign-ui";

import { contestCopy } from "../contest-copy";

export function ContestPayoutOverview({
  summary,
  feeLabel,
}: {
  summary: {
    winnerSlots: number;
    paidOrSent: number;
    pending: number;
    failed: number;
    plannedSats: number;
  };
  feeLabel: string;
}) {
  const done = summary.paidOrSent;
  const total = summary.winnerSlots;

  return (
    <CampaignPayoutOverviewShell
      title={contestCopy.payoutOverview}
      stats={[
        { label: "Winners", value: summary.winnerSlots },
        {
          label: "Paid / sent",
          value: summary.paidOrSent,
          valueClassName:
            "font-semibold text-emerald-600 dark:text-emerald-400",
        },
        { label: "Pending", value: summary.pending },
        {
          label: "Failed",
          value: summary.failed,
          valueClassName: "font-semibold text-destructive",
        },
      ]}
      done={done}
      total={total}
      footer={
        <>
          Planned payout: {summary.plannedSats.toLocaleString()} sats ·{" "}
          {feeLabel}
        </>
      }
    />
  );
}

export function ContestPayoutWinnerRow({
  winner,
  profile,
  payoutStatus,
}: {
  winner: {
    rank: number;
    rewardSats: number;
    score: number;
    authorPubkey: string;
    entryEventId: string;
    replySnippet: string | null;
  };
  profile?: {
    displayName: string;
    picture: string | null;
    npub: string;
  };
  payoutStatus: string;
}) {
  const npubShort = profile?.npub
    ? `${profile.npub.slice(0, 12)}…`
    : `${winner.authorPubkey.slice(0, 8)}…`;

  return (
    <Form
      method="post"
      className="border-border bg-background flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <div className="bg-muted h-9 w-9 shrink-0 overflow-hidden rounded-full">
          {profile?.picture ? (
            <img
              src={profile.picture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs">
              ?
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            #{winner.rank} · {profile?.displayName ?? npubShort}
          </p>
          <p className="text-muted-foreground text-xs">
            {winner.rewardSats.toLocaleString()} sats · score {winner.score}
          </p>
        </div>
      </div>
      <input type="hidden" name="intent" value="payout" />
      <input type="hidden" name="winnerPubkey" value={winner.authorPubkey} />
      <select
        name="payoutStatus"
        defaultValue={payoutStatus}
        className="border-border bg-background rounded-md border px-3 py-2 text-sm"
      >
        <option value="pending">Pending</option>
        <option value="sent">Sent</option>
        <option value="failed">Failed</option>
        <option value="marked_paid">Marked paid</option>
      </select>
      <button
        type="submit"
        className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
      >
        Update
      </button>
    </Form>
  );
}
