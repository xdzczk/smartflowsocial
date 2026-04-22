/**
 * Loading-state placeholder for the Broadcasts index page.
 * Co-located with the broadcast components (route renders inline).
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function BroadcastIndexPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton.Text variant="h1" w="w-40" />
          <Skeleton.Text variant="body" w="max-w-2xl" />
        </div>
        <Skeleton.Button w="w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton.Block key={i} h="h-20" r="lg" />
        ))}
      </div>
      <Skeleton.Block h="h-24" r="lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-40"
        badgeWidthClass="w-20"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}
