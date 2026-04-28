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
    <div className="w-full min-w-0 animate-pulse pb-8" aria-busy="true">
      <div className="mb-8 pt-2 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <Skeleton.Text variant="h2" w="w-52" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-[5.25rem]" />
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <SkeletonMobileCardList
            count={4}
            titleWidthClass="w-40"
            badgeWidthClass="w-12"
            subtitleWidthClass="max-w-sm"
          />
        </div>
        <SkeletonDesktopBoard heightClass="min-h-[22rem] w-full lg:w-[312px]" />
      </div>
    </div>
  );
}
