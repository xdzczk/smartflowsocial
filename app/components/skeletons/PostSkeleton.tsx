/**
 * Skeleton loader for post items
 */

export function PostSkeleton() {
  return (
    <div className="border-border bg-card animate-pulse rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-muted h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="bg-muted h-4 w-3/4 rounded" />
          <div className="bg-muted h-4 w-1/2 rounded" />
          <div className="bg-muted mt-2 h-20 w-full rounded" />
          <div className="flex gap-2">
            <div className="bg-muted h-6 w-16 rounded" />
            <div className="bg-muted h-6 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={`post-skeleton-${i}`} />
      ))}
    </div>
  );
}
