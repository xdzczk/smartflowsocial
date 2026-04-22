/**
 * Skeleton loader for post items
 */

import { Skeleton } from "~/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-xs" />
          <Skeleton className="h-4 w-1/2 rounded-xs" />
          <Skeleton className="mt-2 h-20 w-full rounded-xs" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-xs" />
            <Skeleton className="h-6 w-16 rounded-xs" />
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
