/**
 * Loading-state placeholder for the Bulk Posts page.
 * Co-located with BulkPostsPage so layout edits update both.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function BulkPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="h1" w="w-40" />
        <Skeleton.Text variant="body" w="max-w-lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton.Input w="w-64" />
        <Skeleton.Button w="w-32" />
      </div>
      <SkeletonMobileCardList
        count={4}
        titleWidthClass="w-40"
        badgeWidthClass="w-12"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}
