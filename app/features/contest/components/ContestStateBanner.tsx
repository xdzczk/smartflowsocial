import { CampaignStateBanner } from "~/features/campaign-ui";

import { contestCopy } from "../contest-copy";
import type { ContestStatus } from "../types";

const styles: Record<ContestStatus, { title: string }> = {
  DRAFT: {
    title: contestCopy.bannerDraft,
  },
  SCHEDULED_LAUNCH: {
    title: contestCopy.bannerScheduledLaunch,
  },
  LIVE: {
    title: contestCopy.bannerLive,
  },
  ENDED_REVIEW: {
    title: contestCopy.bannerEndedReview,
  },
  LOCKED: {
    title: contestCopy.bannerLocked,
  },
  PAYOUT_IN_PROGRESS: {
    title: contestCopy.bannerPayout,
  },
  COMPLETED: {
    title: contestCopy.bannerCompleted,
  },
  CANCELLED: {
    title: contestCopy.bannerCancelled,
  },
};

export function ContestStateBanner({ status }: { status: ContestStatus }) {
  const s = styles[status];
  const tone =
    status === "LIVE"
      ? "blue"
      : status === "SCHEDULED_LAUNCH"
        ? "blue"
        : status === "ENDED_REVIEW"
          ? "amber"
          : status === "LOCKED" || status === "PAYOUT_IN_PROGRESS"
            ? "orange"
            : status === "COMPLETED"
              ? "green"
              : status === "CANCELLED"
                ? "muted"
                : "neutral";
  return <CampaignStateBanner title={s.title} tone={tone} />;
}
