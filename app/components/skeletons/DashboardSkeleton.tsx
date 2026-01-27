/**
 * Skeleton loader for dashboard
 */

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-48 rounded" />
        <div className="bg-muted h-10 w-32 rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={`stat-${i}`}
            className="border-border bg-card rounded-lg border p-4"
          >
            <div className="bg-muted mb-2 h-4 w-24 rounded" />
            <div className="bg-muted h-8 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Post list skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`post-${i}`}
            className="border-border bg-card rounded-lg border p-4"
          >
            <div className="flex items-start gap-3">
              <div className="bg-muted h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-3/4 rounded" />
                <div className="bg-muted h-4 w-1/2 rounded" />
                <div className="bg-muted mt-2 h-20 w-full rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
