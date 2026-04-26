import { PublishingFilterRow } from "~/features/posts/components/publishing-suite/PublishingFilterRow";

import { EngagementHeader } from "./EngagementHeader";

export function EngagementFeedSkeleton() {
  return (
    <div
      className="animate-pulse"
      aria-busy="true"
      aria-label="Loading engagement feed"
    >
      <EngagementHeader />

      <PublishingFilterRow>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-4">
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 pb-1">
            <div className="bg-surface-hover h-5 w-10 rounded-sm" />
            <div className="bg-surface-hover h-5 w-24 rounded-sm" />
            <div className="bg-surface-hover h-5 w-36 rounded-sm" />
            <div className="bg-surface-hover h-5 w-32 rounded-sm" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="bg-surface-hover h-7 w-28 rounded-full" />
            <div className="bg-surface-hover h-7 w-28 rounded-full" />
            <div className="bg-surface-hover h-7 w-32 rounded-full" />
            <div className="bg-surface-hover h-8 w-28 rounded-md" />
          </div>
        </div>
      </PublishingFilterRow>

      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="bg-surface-hover shadow-1 border-border h-28 rounded-xl border"
          />
        ))}
      </div>
    </div>
  );
}
