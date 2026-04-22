/**
 * Loading-state placeholder for the Contest Detail page.
 * Co-located with the contest components.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function ContestDetailPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton.Text variant="body" w="w-24" />
          <Skeleton.Text variant="h1" w="w-56" />
          <Skeleton.Text variant="body" w="max-w-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton.Button w="w-28" />
          <Skeleton.Button w="w-28" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton.Block h="h-24" r="lg" />
        <Skeleton.Block h="h-24" r="lg" />
        <Skeleton.Block h="h-24" r="lg" />
      </div>
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        badgeWidthClass="w-14"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}
