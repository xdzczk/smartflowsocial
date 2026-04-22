/**
 * Loading-state placeholder for the Broadcast Audiences page.
 * Co-located with the audience picker components.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function BroadcastAudiencesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div>
        <Skeleton.Text variant="h1" w="w-32" />
        <Skeleton.Text variant="body" className="mt-2" w="max-w-2xl" />
      </div>

      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-36" />
        <div className="mt-4 space-y-3">
          <Skeleton.Input />
          <Skeleton.Input />
          <Skeleton.Block h="h-28" />
          <Skeleton.Input />
          <Skeleton.Input w="w-32" />
        </div>
      </section>

      <section>
        <Skeleton.Text variant="h3" className="mb-2" w="w-36" />
        <div className="border-border rounded-lg border p-3">
          <Skeleton.Input />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton.Block key={i} h="h-12" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
