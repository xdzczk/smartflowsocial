/**
 * Loading-state placeholder for the Contest Proof page.
 * Co-located with the contest components.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function ContestProofPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton.Text variant="h2" w="w-56" />
          <Skeleton.Button w="w-36" />
        </div>
        <Skeleton.Block h="h-12" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton.Block key={i} h="h-14" />
          ))}
        </div>
      </section>
      <Skeleton.Text variant="body" w="w-28" />
    </div>
  );
}
