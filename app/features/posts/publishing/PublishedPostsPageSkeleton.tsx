/**
 * Loading-state placeholder for the Published Posts page.
 * Co-located with PublishedPostsPage so layout edits update both.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
  SkeletonPageTitle,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function PublishedPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-44" />
      <div className="flex flex-wrap gap-2">
        <Skeleton.Button w="w-36" />
        <Skeleton.Button w="w-36" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Skeleton.Input />
        <Skeleton.Input />
      </div>
      <Skeleton.Block h="h-11" r="lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        badgeWidthClass="w-14"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}
