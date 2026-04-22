/**
 * Loading-state placeholder for the Broadcast Review page.
 * Co-located with the broadcast components.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function BroadcastReviewPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton.Text variant="body" w="w-28" />
        <Skeleton.Text variant="h1" w="w-56" />
        <Skeleton.Text variant="body" w="max-w-3xl" />
        <Skeleton.Text variant="body" w="max-w-2xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="h3" w="w-44" />
            <div className="mt-3 space-y-2">
              <Skeleton.Text variant="body" w="max-w-md" />
              <Skeleton.Text variant="body" w="max-w-lg" />
              <Skeleton.Text variant="body" w="max-w-md" />
              <Skeleton.Block h="h-24" />
            </div>
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="h3" w="w-40" />
            <div className="mt-3 space-y-2">
              <Skeleton.Text variant="body" w="w-52" />
              <Skeleton.Text variant="body" w="w-52" />
              <Skeleton.Text variant="body" w="w-52" />
              <Skeleton.Text variant="body" w="w-52" />
            </div>
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="h3" w="w-32" />
            <Skeleton.Input className="mt-3" w="max-w-sm" />
            <Skeleton.Input className="mt-2" w="w-36" />
          </section>
        </div>

        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="h3" w="w-52" />
            <Skeleton.Text variant="body" className="mt-3" w="max-w-md" />
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="h3" w="w-28" />
            <Skeleton.Text variant="body" className="mt-3" w="max-w-sm" />
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton.Text variant="body" w="max-w-md" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton.Button w="w-32" />
              <Skeleton.Button w="w-36" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
