/**
 * Skeleton loader for dashboard index.
 * Mirrors layout: 4 KPI cards, header row, Flow strip, Queue Health + Next 7 days.
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
              className="border-border bg-surface shadow-1 min-h-[64px] rounded-xl border p-3"
            >
              <div className="flex min-h-[48px] items-center justify-between">
                <Skeleton className="size-12 rounded-lg" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-6 w-16 rounded-xs" />
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
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 pt-6 pb-8">
        <div className="min-h-[232px] flex-1 overflow-hidden pb-2">
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={`flow-${i}`}
                className="border-border bg-surface flex h-[232px] w-[352px] flex-shrink-0 overflow-hidden rounded-lg border"
              >
                <Skeleton className="w-24 flex-shrink-0 rounded-l-md" />
                <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                  <Skeleton className="h-4 w-20 rounded-xs" />
                  <Skeleton className="h-4 w-32 rounded-xs" />
                  <Skeleton className="h-3 w-24 rounded-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Next 7 days + Queue Health */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
        <div className="border-border bg-surface shadow-1 flex w-full min-w-0 flex-col rounded-xl border lg:flex-1">
          <div className="flex flex-row items-center justify-between gap-1.5 px-3.5 pt-2 pb-1 sm:px-4">
            <Skeleton className="h-3 w-20 rounded-xs" />
            <Skeleton className="h-4 w-16 rounded-xs" />
          </div>
          <div className="flex flex-col gap-1 px-3.5 pt-0 pb-3 sm:px-4 sm:pb-3.5">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={`n7-${i}`}
                className="border-border/60 flex min-h-[2rem] items-center justify-between rounded-xs border px-2 py-1 sm:py-1.5"
              >
                <Skeleton className="h-3 w-12 rounded-xs" />
                <Skeleton className="h-3 w-10 rounded-xs" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-border bg-surface shadow-1 flex w-full min-w-0 flex-col rounded-xl border lg:flex-1">
          <div className="px-3.5 pt-2 pb-1 sm:px-4">
            <Skeleton className="h-3 w-24 rounded-xs" />
          </div>
          <div className="flex flex-col gap-1.5 px-3.5 pt-0 pb-3 sm:px-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={`qh-${i}`} className="flex flex-col gap-0.5">
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
