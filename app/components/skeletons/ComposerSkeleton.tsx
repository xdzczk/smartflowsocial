/**
 * Placeholder layout while compose route loader catches up to the URL (e.g. Article tab).
 */

import { Skeleton } from "~/components/ui/skeleton";

export function ComposerSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 lg:flex-row lg:items-start"
      aria-busy="true"
      aria-label="Loading composer"
    >
      <div className="min-w-0 flex-1 space-y-4">
        <Skeleton className="h-[180px] w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md md:max-w-md" />
        </div>
      </div>
      <aside
        className="border-border flex w-full shrink-0 flex-col bg-transparent lg:w-[312px] xl:w-[344px]"
        aria-hidden
      >
        <div className="border-border bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm">
          <Skeleton className="h-11 w-full rounded-none rounded-t-xl" />
          <div className="space-y-3 p-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <div className="mt-auto space-y-2 border-t p-3">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </aside>
    </div>
  );
}
