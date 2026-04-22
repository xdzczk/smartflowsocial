/**
 * Loading-state placeholder for the Giveaway Detail page.
 * Co-located with GiveawayDetailPage.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function GiveawayDetailPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton.Text variant="body" w="w-24" />
          <Skeleton.Text variant="h1" w="w-56" />
          <Skeleton.Text variant="body" w="max-w-md" />
        </div>
        <Skeleton.Button w="w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton.Block h="h-36" r="lg" />
        <Skeleton.Block h="h-36" r="lg" />
      </div>
      <Skeleton.Block h="h-56" r="xl" />
      <SkeletonMobileCardList
        count={4}
        titleWidthClass="w-32"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-56" />
    </div>
  );
}
