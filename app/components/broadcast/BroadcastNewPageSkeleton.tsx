/**
 * Loading-state placeholder for the New Broadcast page.
 * Co-located with the broadcast new draft form.
 */
import { SkeletonPageTitle } from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function BroadcastNewPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-52" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-lg border p-4">
          <Skeleton.Text variant="h3" w="w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton.Input />
            <Skeleton.Input />
            <Skeleton.Block h="h-24" />
            <Skeleton.Input />
            <Skeleton.Input />
          </div>
        </section>

        <section className="border-border rounded-lg border p-4">
          <Skeleton.Text variant="h3" w="w-36" />
          <div className="mt-4 space-y-3">
            <Skeleton.Block h="h-16" />
            <Skeleton.Block h="h-16" />
            <Skeleton.Block h="h-16" />
          </div>
          <div className="mt-5 flex gap-2">
            <Skeleton.Button size="default" w="w-32" />
            <Skeleton.Button size="default" w="w-32" />
          </div>
        </section>
      </div>
    </div>
  );
}
