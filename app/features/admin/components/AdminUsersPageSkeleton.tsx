/**
 * Loading-state placeholder for the Admin Users page.
 * Co-located with the admin users page (route file).
 */
import {
  SkeletonDesktopBoard,
  SkeletonMobileCardList,
} from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function AdminUsersPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="h1" w="w-28" />
        <Skeleton.Text variant="body" w="max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton.Block key={i} h="h-20" r="lg" />
        ))}
      </div>
      <Skeleton.Input w="max-w-xl" />
      <SkeletonMobileCardList
        count={5}
        includeAvatar
        titleWidthClass="w-36"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}
