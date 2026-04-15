import { Skeleton } from "~/components/ui/skeleton";

function SkeletonPageTitle({
  titleWidth,
  subtitleWidth = "max-w-xl",
}: {
  titleWidth: string;
  subtitleWidth?: string;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-8 ${titleWidth}`} />
      <Skeleton className={`h-4 w-full ${subtitleWidth}`} />
    </div>
  );
}

function SkeletonStatGrid({
  count,
  className,
  itemHeightClass,
}: {
  count: number;
  className: string;
  itemHeightClass: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`${itemHeightClass} w-full rounded-lg`} />
      ))}
    </div>
  );
}

function SkeletonDesktopBoard({ heightClass }: { heightClass: string }) {
  return (
    <Skeleton className={`hidden w-full rounded-xl md:block ${heightClass}`} />
  );
}

function SkeletonMobileCardList({
  count,
  titleWidthClass,
  badgeWidthClass = "w-16",
  includeAvatar = false,
  includeActions = false,
  subtitleWidthClass = "max-w-sm",
  mobileOnly = true,
}: {
  count: number;
  titleWidthClass: string;
  badgeWidthClass?: string;
  includeAvatar?: boolean;
  includeActions?: boolean;
  subtitleWidthClass?: string;
  mobileOnly?: boolean;
}) {
  return (
    <div className={mobileOnly ? "space-y-3 md:hidden" : "space-y-3"}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-border rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {includeAvatar ? (
                <Skeleton className="h-8 w-8 rounded-full" />
              ) : null}
              <Skeleton className={`h-4 ${titleWidthClass}`} />
            </div>
            <Skeleton className={`h-5 rounded-full ${badgeWidthClass}`} />
          </div>
          <Skeleton className={`h-3 w-full ${subtitleWidthClass}`} />
          {includeActions ? (
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-7 w-14 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SkeletonChartSection({ titleWidth }: { titleWidth: string }) {
  return (
    <section className="border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </section>
  );
}

export function BroadcastNewPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-52" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </section>

        <section className="border-border rounded-lg border p-4">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function BroadcastReviewPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-5 w-44" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-24 w-full" />
            </div>
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-52" />
            </div>
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-10 w-full max-w-sm" />
            <Skeleton className="mt-2 h-10 w-36" />
          </section>
        </div>

        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="mt-3 h-4 w-full max-w-md" />
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-3 h-4 w-full max-w-sm" />
          </section>
          <section className="border-border rounded-lg border p-4">
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-36" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function BroadcastDetailPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-3 w-full max-w-lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
      </div>

      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-2 w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-32" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-xs" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-20 w-full" />
      </section>

      <section className="border-border rounded-lg border p-4">
        <Skeleton className="mb-2 h-5 w-20" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </section>

      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-72" />
        </div>
        <SkeletonMobileCardList
          count={4}
          includeAvatar
          titleWidthClass="w-32"
          subtitleWidthClass="max-w-sm"
        />
        <Skeleton className="hidden h-64 w-full md:block" />
      </section>
    </div>
  );
}

export function BroadcastAudiencesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      </div>

      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </section>

      <section>
        <Skeleton className="mb-2 h-5 w-36" />
        <div className="border-border rounded-lg border p-3">
          <Skeleton className="h-10 w-full" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ContestProofPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </section>
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

export function PostsFeedPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ScheduledPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-44" />
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}

export function PublishedPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-44" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        badgeWidthClass="w-14"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}

export function DraftsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-32"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}

export function TemplatesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-32"
        badgeWidthClass="w-12"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <div className="hidden space-y-3 md:block">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function RecyclablesPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}

export function BulkPostsPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <SkeletonMobileCardList
        count={4}
        titleWidthClass="w-40"
        badgeWidthClass="w-12"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="border-border rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full max-w-[10rem]" />
          </div>
        ))}
      </div>
      <Skeleton className="hidden h-[420px] w-full rounded-xl md:block" />
    </div>
  );
}

export function AdminAnalyticsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <SkeletonPageTitle titleWidth="w-44" subtitleWidth="max-w-2xl" />
      <SkeletonStatGrid
        count={4}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        itemHeightClass="h-24"
      />
      <SkeletonChartSection titleWidth="w-40" />
      <SkeletonChartSection titleWidth="w-48" />
      <SkeletonChartSection titleWidth="w-52" />
    </div>
  );
}

export function AdminUsersPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <SkeletonMobileCardList
        count={5}
        includeAvatar
        titleWidthClass="w-36"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}

export function AdminOperationsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <SkeletonChartSection titleWidth="w-40" />
      <SkeletonChartSection titleWidth="w-44" />
    </div>
  );
}

export function MediaSettingsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-6 w-40" />
      </div>
      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-16" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="col-span-2 h-14 w-full" />
        </div>
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
      </section>
      <section className="border-border rounded-lg border p-4">
        <Skeleton className="h-5 w-20" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="border-border rounded-lg border p-3">
              <div className="flex gap-3">
                <Skeleton className="h-20 w-24 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full max-w-sm" />
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-14 rounded-md" />
                    <Skeleton className="h-7 w-16 rounded-md" />
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

export function BroadcastIndexPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-40"
        badgeWidthClass="w-20"
        includeActions
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[420px]" />
    </div>
  );
}

export function GiveawayBuilderPageSkeleton() {
  return (
    <div className="w-full min-w-0 animate-pulse space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-lg border p-4">
          <Skeleton className="h-5 w-48" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </section>
        <section className="border-border rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-36" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function GiveawayDetailPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <SkeletonMobileCardList
        count={4}
        titleWidthClass="w-32"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-56" />
    </div>
  );
}

export function ContestDetailPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <SkeletonMobileCardList
        count={5}
        titleWidthClass="w-36"
        badgeWidthClass="w-14"
        subtitleWidthClass="max-w-sm"
      />
      <SkeletonDesktopBoard heightClass="h-[430px]" />
    </div>
  );
}

export function GiveawayProofPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="mt-3">
          <SkeletonMobileCardList
            count={5}
            titleWidthClass="w-36"
            subtitleWidthClass="max-w-sm"
            mobileOnly={false}
          />
        </div>
      </section>
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
