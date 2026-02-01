/**
 * Skeleton loader for dashboard index.
 * Mirrors layout: 4 KPI cards, header row, Flow strip, Queue Health + Top Posts.
 */

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-12rem)] animate-pulse flex-col">
      {/* KPI row */}
      <div className="mt-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`kpi-${i}`}
              className="border-border bg-card min-h-[64px] rounded-xl border p-3 shadow"
            >
              <div className="flex min-h-[48px] items-center justify-between">
                <div className="bg-muted size-12 rounded-lg" />
                <div className="flex flex-col items-end gap-1">
                  <div className="bg-muted h-6 w-16 rounded" />
                  <div className="bg-muted h-3 w-20 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Header row: title + tabs */}
      <div className="mt-2 flex flex-col gap-0 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="mb-2 flex flex-col gap-1">
          <div className="bg-muted h-5 w-24 rounded" />
          <div className="bg-muted h-4 w-40 rounded" />
        </div>
        <div className="bg-muted h-9 w-48 rounded" />
      </div>

      {/* Flow section */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 pt-6 pb-8">
        <div className="min-h-[232px] flex-1 overflow-hidden pb-2">
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={`flow-${i}`}
                className="border-border bg-card flex h-[232px] w-[352px] flex-shrink-0 overflow-hidden rounded-lg border"
              >
                <div className="bg-muted w-24 flex-shrink-0 rounded-l-md" />
                <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                  <div className="bg-muted h-4 w-20 rounded" />
                  <div className="bg-muted h-4 w-32 rounded" />
                  <div className="bg-muted h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Queue Health + Top Posts */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:gap-4">
        <div className="border-border bg-card min-w-0 flex-1 flex-col rounded-xl border shadow">
          <div className="px-4 pt-3 pb-1">
            <div className="bg-muted h-3 w-24 rounded" />
          </div>
          <div className="flex flex-col gap-1.5 px-4 pt-0 pb-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={`qh-${i}`} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="bg-muted h-3 w-20 rounded" />
                  <div className="bg-muted h-3 w-6 rounded" />
                </div>
                <div className="bg-muted h-1 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-border bg-card min-w-0 flex-1 flex-col rounded-xl border shadow">
          <div className="flex flex-row items-center justify-between gap-1.5 px-4 pt-3 pb-1">
            <div className="bg-muted h-3 w-20 rounded" />
            <div className="flex gap-1">
              <div className="bg-muted h-4 w-8 rounded" />
              <div className="bg-muted h-4 w-8 rounded" />
            </div>
          </div>
          <div className="flex flex-col gap-1 px-4 pt-0 pb-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={`tp-${i}`}
                className="border-border/60 rounded border p-1.5"
              >
                <div className="bg-muted h-3 w-full rounded" />
                <div className="bg-muted mt-0.5 h-3 w-24 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
