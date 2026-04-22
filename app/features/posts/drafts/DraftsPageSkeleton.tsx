/**
 * Loading-state placeholder for the Drafts page.
 * Co-located with DraftsPage so layout edits update both.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function DraftsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton.Text variant="h1" w="w-28" />
          <Skeleton.Text variant="body" w="max-w-xl" />
        </div>
        <Skeleton.Button w="w-28" />
      </div>
      <Skeleton.Block h="h-11" r="lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-32"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}
