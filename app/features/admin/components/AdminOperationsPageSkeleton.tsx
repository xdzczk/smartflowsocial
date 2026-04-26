/**
 * Loading-state placeholder for the Admin Operations page.
 * Co-located with AdminOperationsPageInner so layout edits update both.
 */
import { SkeletonChartSection } from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function AdminOperationsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="h2" w="w-40" />
        <Skeleton.Text variant="body" w="max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton.Block key={i} h="h-20" r="lg" />
        ))}
      </div>
      <SkeletonChartSection titleWidth="w-40" />
      <SkeletonChartSection titleWidth="w-44" />
    </div>
  );
}
