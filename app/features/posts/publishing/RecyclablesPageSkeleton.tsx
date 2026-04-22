/**
 * Loading-state placeholder for the Recyclables page.
 * Co-located with RecyclablesPage so layout edits update both.
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function RecyclablesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="h1" w="w-40" />
        <Skeleton.Text variant="body" w="max-w-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton.Button w="w-44" />
        <Skeleton.Button w="w-36" />
        <Skeleton.Button w="w-36" />
      </div>
      <Skeleton.Input w="max-w-sm" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}
