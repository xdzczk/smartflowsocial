/**
 * Loading-state placeholder for the Giveaway Builder page.
 * Co-located with GiveawayNewBuilder.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function GiveawayBuilderPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="h1" w="w-44" />
        <Skeleton.Text variant="body" w="max-w-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-lg border p-4">
          <Skeleton.Text variant="h3" w="w-48" />
          <div className="mt-4 space-y-3">
            <Skeleton.Input />
            <Skeleton.Input />
            <Skeleton.Block h="h-24" />
            <Skeleton.Input />
            <div className="flex gap-2">
              <Skeleton.Pill w="w-16" />
              <Skeleton.Pill w="w-20" />
            </div>
          </div>
        </section>
        <section className="border-border rounded-lg border p-4">
          <Skeleton.Text variant="h3" w="w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton.Block h="h-20" />
            <Skeleton.Block h="h-20" />
            <Skeleton.Button w="w-36" />
          </div>
        </section>
      </div>
    </div>
  );
}
