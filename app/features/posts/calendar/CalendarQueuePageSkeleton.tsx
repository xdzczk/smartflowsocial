/**
 * Loading-state placeholder for the Calendar Queue page.
 * Co-located with CalendarQueuePage so layout edits update both.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function CalendarQueuePageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton.Text variant="h1" w="w-56" />
      </div>
      <div className="border-border border-b pb-2">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton.Button key={i} size="sm" w="w-24" />
          ))}
        </div>
      </div>
      <div className="border-border/60 bg-surface-hover/30 flex min-h-14 items-center border px-2 py-3 sm:px-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Skeleton.Button w="w-24" />
            <Skeleton.Button w="w-28" />
          </div>
          <Skeleton.Button w="w-40" />
        </div>
      </div>
      <Skeleton.Block h="h-[420px]" r="xl" />
    </div>
  );
}
