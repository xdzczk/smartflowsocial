/**
 * Loading-state placeholder for the Media Settings page.
 * Co-located with the media settings page (route file).
 */
import { Skeleton } from "~/components/ui/skeleton";

export function MediaSettingsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton.Text variant="h1" w="w-28" />
          <Skeleton.Text variant="body" w="max-w-2xl" />
        </div>
        <Skeleton.Pill w="w-40" />
      </div>
      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-16" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Skeleton.Block h="h-14" />
          <Skeleton.Block className="col-span-2" h="h-14" />
        </div>
        <Skeleton.Block className="mt-4" h="h-2" r="full" />
      </section>
      <section className="border-border rounded-lg border p-4">
        <Skeleton.Text variant="h3" w="w-20" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="border-border rounded-lg border p-3">
              <div className="flex gap-3">
                <Skeleton.Block w="w-24" h="h-20" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton.Text variant="body" w="w-40" />
                  <Skeleton.Text variant="caption" w="max-w-sm" />
                  <div className="flex gap-2">
                    <Skeleton.Button size="sm" w="w-14" />
                    <Skeleton.Button size="sm" w="w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
