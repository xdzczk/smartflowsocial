import { Form } from "@remix-run/react";

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
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="border-border bg-card space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{contestCopy.payoutOverview}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Winners</dt>
          <dd className="font-semibold">{summary.winnerSlots}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid / sent</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
            {summary.paidOrSent}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pending</dt>
          <dd className="font-semibold">{summary.pending}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Failed</dt>
          <dd className="text-destructive font-semibold">{summary.failed}</dd>
        </div>
      </dl>
      <div>
        <div className="text-muted-foreground mb-1 flex justify-between text-xs">
          <span>Progress</span>
          <span>
            {done}/{total} ({pct}%)
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Planned payout: {summary.plannedSats.toLocaleString()} sats · {feeLabel}
      </p>
    </div>
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
