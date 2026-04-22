/**
 * Loading-state placeholder for the Templates page.
 * Co-located with TemplatesPage so layout edits update both.
 */
import { SkeletonMobileCardList } from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function TemplatesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton.Text variant="h1" w="w-32" />
          <Skeleton.Text variant="body" w="max-w-xl" />
        </div>
        <Skeleton.Button w="w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton.Input w="w-36" />
        <Skeleton.Input w="w-32" />
      </div>
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-32"
        badgeWidthClass="w-12"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <div className="hidden space-y-3 md:block">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton.Block key={i} h="h-20" r="lg" />
        ))}
      </div>
    </div>
  );
}
