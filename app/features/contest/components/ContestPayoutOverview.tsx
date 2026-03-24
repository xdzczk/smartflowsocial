import { useFetcher } from "@remix-run/react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import ZapButton from "~/components/dashboard/ZapButton";
import { Button } from "~/components/ui/button";
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
          {feeLabel}. Zap each winner from the row actions, then mark payouts
          when done.
        </>
      }
    />
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  const label =
    status === "marked_paid"
      ? "Marked paid"
      : status === "sent"
        ? "Sent"
        : status === "failed"
          ? "Failed"
          : "Pending";
  const cls =
    status === "sent" || status === "marked_paid"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

export function ContestPayoutWinnerRow({
  winner,
  profile,
  payoutStatus,
  getProfileUrl,
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
  getProfileUrl: (npub: string) => string;
}) {
  const payoutFetcher = useFetcher();
  const [copied, setCopied] = useState(false);

  const npub = (profile?.npub ?? "").trim();
  const hasNpub = npub.length > 0;
  const profileHref = hasNpub ? getProfileUrl(npub) : "";

  const submitPayout = (status: string) => {
    const fd = new FormData();
    fd.set("intent", "payout");
    fd.set("winnerPubkey", winner.authorPubkey);
    fd.set("payoutStatus", status);
    payoutFetcher.submit(fd, { method: "post" });
  };

  const npubShort =
    npub.length > 24 ? `${npub.slice(0, 12)}…${npub.slice(-8)}` : npub;
  const pubkeyShort = `${winner.authorPubkey.slice(0, 12)}…`;
  const displayName = (profile?.displayName ?? "").trim();
  const primaryLabel =
    displayName !== ""
      ? displayName
      : hasNpub && npubShort !== ""
        ? npubShort
        : pubkeyShort;
  const showNpubSecondary = displayName !== "" && hasNpub;

  const handleCopyNpub = async () => {
    if (!hasNpub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const st = payoutStatus;
  const zapAmount = winner.rewardSats > 0 ? winner.rewardSats : undefined;

  return (
    <li className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-start gap-3">
          {profile?.picture ? (
            <img
              src={profile.picture}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
              width={32}
              height={32}
            />
          ) : (
            <div
              className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
              aria-hidden
            >
              {primaryLabel.slice(0, 1).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-foreground truncate text-sm font-medium">
                #{winner.rank} · {primaryLabel}
              </span>
              {showNpubSecondary ? (
                <span
                  className="text-muted-foreground truncate font-mono text-xs"
                  title={npub}
                >
                  {npubShort}
                </span>
              ) : null}
              {hasNpub ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleCopyNpub()}
                    className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
                    aria-label="Copy npub"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <a
                    href={profileHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary shrink-0 text-xs"
                  >
                    Profile
                  </a>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PayoutStatusBadge status={st} />
              {winner.rewardSats > 0 ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {winner.rewardSats.toLocaleString()} sats
                </span>
              ) : null}
              <span className="text-muted-foreground text-xs">
                score {winner.score}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {hasNpub ? (
          <ZapButton
            npub={npub}
            amountSats={zapAmount}
            size="sm"
            onZapped={() => {
              submitPayout("sent");
            }}
          />
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={payoutFetcher.state !== "idle"}
          onClick={() => {
            submitPayout("sent");
          }}
        >
          Mark as sent
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={payoutFetcher.state !== "idle"}
          onClick={() => {
            submitPayout("marked_paid");
          }}
        >
          Mark paid
        </Button>
        {st === "failed" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={payoutFetcher.state !== "idle"}
            onClick={() => {
              submitPayout("pending");
            }}
          >
            Retry
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={payoutFetcher.state !== "idle"}
            onClick={() => {
              submitPayout("failed");
            }}
          >
            Failed
          </Button>
        )}
      </div>
    </li>
  );
}
