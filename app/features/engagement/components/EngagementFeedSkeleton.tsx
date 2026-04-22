import { EngagementHeader } from "./EngagementHeader";

export function EngagementFeedSkeleton() {
  return (
    <div
      className="animate-pulse"
      aria-busy="true"
      aria-label="Loading engagement feed"
    >
      <EngagementHeader />

      <div className="border-border mb-6 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap gap-2">
          <div className="bg-surface-hover h-9 w-24 rounded-md" />
          <div className="bg-surface-hover h-9 w-28 rounded-md" />
          <div className="bg-surface-hover h-9 w-32 rounded-md" />
        </div>
        <div className="bg-surface-hover h-9 w-40 rounded-md" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-surface-hover h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
