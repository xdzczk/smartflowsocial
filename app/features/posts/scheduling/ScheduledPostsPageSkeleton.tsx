/**
 * Loading-state placeholder for the Scheduled Posts page.
 * Co-located with ScheduledPostsPage so layout edits update both.
 *
 * Phase 1i. Re-authored from the centralised skeleton file using the
 * Skeleton atom set (~/components/ui/skeleton).
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
  SkeletonPageTitle,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function ScheduledPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-44" />
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton.Button key={i} size="default" w="w-full" />
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Skeleton.Input />
        <Skeleton.Input />
      </div>
      <Skeleton.Block h="h-11" r="lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}
