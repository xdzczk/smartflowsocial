/**
 * Placeholder layout while compose route loader catches up to the URL.
 * Mirrors UnifiedComposer + PublishingSummaryRail spacing (card, padding, rail width, mb-4) to reduce CLS.
 */

import { Skeleton } from "~/components/ui/skeleton";

export function ComposerSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 lg:flex-row lg:items-start"
      aria-busy="true"
      aria-label="Loading composer"
    >
      <div className="mb-4 min-w-0 flex-1">
        <div className="border-border bg-card rounded-xl border shadow-sm">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 sm:gap-6">
              <Skeleton className="h-40 w-full rounded-lg sm:h-44" />
              <Skeleton className="h-40 w-full rounded-lg sm:h-44" />
              <Skeleton className="h-9 w-36 rounded-md" />
              <div className="bg-border/50 h-px w-full shrink-0" aria-hidden />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
              <div className="bg-border/50 h-px w-full shrink-0" aria-hidden />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <aside
        className="border-border flex w-full shrink-0 flex-col bg-transparent lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100vh-5.75rem)] lg:w-[312px] xl:w-[344px]"
        aria-hidden
      >
        <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Skeleton className="h-11 w-full rounded-none rounded-t-xl" />
            <div className="space-y-3 p-3">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
          <div className="shrink-0 space-y-2 border-t p-3">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </aside>
    </div>
  );
}
