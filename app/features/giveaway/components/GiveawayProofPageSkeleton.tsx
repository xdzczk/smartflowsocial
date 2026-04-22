/**
 * Loading-state placeholder for the Giveaway Proof page.
 * Co-located with the giveaway components.
 */
import { SkeletonMobileCardList } from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function GiveawayProofPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton.Text variant="h2" w="w-56" />
          <Skeleton.Button w="w-36" />
        </div>
        <Skeleton.Block h="h-10" />
        <div className="mt-3">
          <SkeletonMobileCardList
            count={5}
            titleWidthClass="w-36"
            subtitleWidthClass="max-w-sm"
            mobileOnly={false}
          />
        </div>
      </section>
      <Skeleton.Text variant="body" w="w-32" />
    </div>
  );
}
