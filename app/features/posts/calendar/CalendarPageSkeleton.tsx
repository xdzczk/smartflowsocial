/**
 * Loading-state placeholder for the Calendar page.
 * Co-located with CalendarPage so layout edits update both.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function CalendarPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 animate-pulse flex-col"
      aria-busy="true"
    >
      <div className="border-border/60 bg-surface-hover/30 flex min-h-14 flex-shrink-0 items-center border-b px-2 py-3 sm:px-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Skeleton.Button w="w-24" />
            <Skeleton.Button w="w-28" />
            <Skeleton.Button w="w-20" />
          </div>
          <Skeleton.Button w="w-40" />
        </div>
      </div>
      <div className="bg-surface-hover/20 flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-border rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Skeleton.Text variant="body" w="w-20" />
                <Skeleton.Pill w="w-12" />
              </div>
              <Skeleton.Text variant="caption" w="max-w-[10rem]" />
            </div>
          ))}
        </div>
        <Skeleton.Block
          className="hidden md:block"
          h="h-full min-h-[420px]"
          r="xl"
        />
      </div>
    </div>
  );
}
