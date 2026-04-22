/**
 * Loading-state placeholder for the Broadcast Detail page.
 * Co-located with the broadcast components.
 */
import { SkeletonMobileCardList } from "~/components/skeletons/page-helpers";
import { Skeleton } from "~/components/ui/skeleton";

export function BroadcastDetailPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton.Text variant="body" w="w-28" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton.Text variant="h1" w="w-56" />
            <Skeleton.Pill w="w-24" />
          </div>
          <Skeleton.Text variant="body" w="max-w-sm" />
          <Skeleton.Text variant="caption" w="max-w-lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton.Button key={i} size="default" w="w-24" />
          ))}
        </div>
      </div>

      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-24" />
        <Skeleton.Block className="mt-3" h="h-2" r="full" />
        <Skeleton.Text variant="body" className="mt-3" w="max-w-lg" />
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-32" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton.Text key={i} variant="body" w="max-w-xs" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton.Pill w="w-20" />
          <Skeleton.Pill w="w-24" />
          <Skeleton.Pill w="w-16" />
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-24" />
        <Skeleton.Block className="mt-2" h="h-20" />
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" className="mb-2" w="w-20" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton.Block key={i} h="h-10" />
          ))}
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <Skeleton.Text variant="h3" w="w-24" />
          <Skeleton.Input w="w-72" />
        </div>
        <SkeletonMobileCardList
          count={4}
          includeAvatar
          titleWidthClass="w-32"
          subtitleWidthClass="max-w-sm"
        />
        <Skeleton.Block className="hidden md:block" h="h-64" />
      </section>
    </div>
  );
}
