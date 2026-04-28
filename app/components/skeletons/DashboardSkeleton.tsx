/**
 * Skeleton loader for dashboard index.
 * Mirrors layout: 4 KPI cards, header row, Flow strip, Queues + Next 7 days.
 */

import { Skeleton } from "~/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      {/* KPI row */}
      <div className="mt-2.5 lg:mt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`kpi-${i}`}
              className="border-border-subtle/80 bg-surface shadow-1 min-h-[80px] rounded-lg border p-4"
            >
              <div className="flex min-h-[48px] items-center justify-between gap-4">
                <Skeleton className="size-10 rounded-lg sm:size-11" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-7 w-16 rounded-xs" />
                  <Skeleton className="h-3 w-20 rounded-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Header row: title + tabs */}
      <div className="mt-2 flex flex-col gap-0 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="mb-2 flex flex-col gap-1">
          <Skeleton className="h-5 w-24 rounded-xs" />
          <Skeleton className="h-4 w-40 rounded-xs" />
        </div>
        <Skeleton className="h-9 w-48 rounded-xs" />
      </div>

      {/* Flow section */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">
        <div className="border-border-subtle/75 bg-surface-hover/82 dark:bg-surface-hover/28 min-h-[232px] flex-1 overflow-hidden border-y py-3">
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={`flow-${i}`}
                className="border-border-subtle bg-surface-raised shadow-1 flex h-[232px] w-[352px] flex-shrink-0 overflow-hidden rounded-lg border"
              >
                <Skeleton className="w-24 flex-shrink-0 rounded-l-lg" />
                <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                  <Skeleton className="h-4 w-14 rounded-xs" />
                  <Skeleton className="h-5 w-28 rounded-xs" />
                  <Skeleton className="h-3 w-24 rounded-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Next 7 days + Queues */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
        <div className="border-border-subtle bg-surface shadow-1 flex w-full min-w-0 flex-col rounded-xl border lg:flex-1">
          <div className="flex flex-row items-center justify-between gap-2 px-4 pt-3 pb-2">
            <Skeleton className="h-3 w-20 rounded-xs" />
            <Skeleton className="h-4 w-16 rounded-xs" />
          </div>
          <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={`n7-${i}`}
                className="border-border-subtle/80 bg-surface-hover/38 dark:bg-surface-hover/18 flex min-h-[2.25rem] items-center justify-between rounded-lg border px-3 py-2"
              >
                <Skeleton className="h-3 w-12 rounded-xs" />
                <Skeleton className="h-3 w-10 rounded-xs" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-border-subtle bg-surface shadow-1 flex w-full min-w-0 flex-col rounded-xl border lg:flex-1">
          <div className="px-4 pt-3 pb-2">
            <Skeleton className="h-3 w-24 rounded-xs" />
          </div>
          <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={`qh-${i}`}
                className="border-border-subtle/80 bg-surface-hover/38 dark:bg-surface-hover/18 flex flex-col gap-1.5 rounded-lg border px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20 rounded-xs" />
                  <Skeleton className="h-3 w-6 rounded-xs" />
                </div>
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
