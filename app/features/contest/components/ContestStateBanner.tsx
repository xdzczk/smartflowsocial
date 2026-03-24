import { contestCopy } from "../contest-copy";
import type { ContestStatus } from "../types";

const styles: Record<ContestStatus, { wrap: string; title: string }> = {
  DRAFT: {
    wrap: "border-border bg-muted/40 text-foreground border",
    title: contestCopy.bannerDraft,
  },
  LIVE: {
    wrap: "border-blue-500/40 bg-blue-500/10 text-foreground border",
    title: contestCopy.bannerLive,
  },
  ENDED_REVIEW: {
    wrap: "border-amber-500/50 bg-amber-500/10 text-foreground border",
    title: contestCopy.bannerEndedReview,
  },
  LOCKED: {
    wrap: "border-orange-500/50 bg-orange-500/10 text-foreground border",
    title: contestCopy.bannerLocked,
  },
  PAYOUT_IN_PROGRESS: {
    wrap: "border-orange-500/50 bg-orange-500/10 text-foreground border",
    title: contestCopy.bannerPayout,
  },
  COMPLETED: {
    wrap: "border-emerald-500/50 bg-emerald-500/10 text-foreground border",
    title: contestCopy.bannerCompleted,
  },
  CANCELLED: {
    wrap: "border-border bg-muted/30 text-muted-foreground border",
    title: contestCopy.bannerCancelled,
  },
};

export function ContestStateBanner({ status }: { status: ContestStatus }) {
  const s = styles[status];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${s.wrap}`}>
      <p className="font-medium">{s.title}</p>
    </div>
  );
}
