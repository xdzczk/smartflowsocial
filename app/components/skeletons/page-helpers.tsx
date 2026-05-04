/**
 * Shared composition helpers for per-page skeletons.
 *
 * Phase 1i. Several page skeletons share the same recurring structures  -
 * a "page title + subtitle" block, a stat-card grid, a mobile card list,
 * a desktop board placeholder, a chart card. These live here so per-page
 * skeletons compose them rather than re-implementing.
 *
 * The page-level skeleton itself lives next to the real page component
 * (e.g. DraftsPageSkeleton.tsx beside DraftsPage.tsx), so when a page's
 * layout changes, the dev sees the skeleton sitting right next to it.
 *
 * Atoms (Skeleton.Text/Avatar/Button/Input/Pill/Block) come from
 * ~/components/ui/skeleton  -  sizes track the design tokens automatically.
 */
import { Skeleton } from "~/components/ui/skeleton";

export function SkeletonPageTitle({
  titleWidth,
  subtitleWidth = "max-w-xl",
}: {
  titleWidth: string;
  subtitleWidth?: string;
}) {
  return (
    <div className="space-y-2">
      <Skeleton.Text variant="h1" w={titleWidth} />
      <Skeleton.Text variant="body" w={subtitleWidth} />
    </div>
  );
}

export function SkeletonStatGrid({
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
        <Skeleton.Block key={i} h={itemHeightClass} r="lg" />
      ))}
    </div>
  );
}

export function SkeletonDesktopBoard({ heightClass }: { heightClass: string }) {
  return <Skeleton.Block className="hidden md:block" r="xl" h={heightClass} />;
}

export function SkeletonMobileCardList({
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
            <div className="cluster">
              {includeAvatar ? <Skeleton.Avatar size="sm" /> : null}
              <Skeleton.Text variant="body" w={titleWidthClass} />
            </div>
            <Skeleton.Pill w={badgeWidthClass} />
          </div>
          <Skeleton.Text variant="caption" w={subtitleWidthClass} />
          {includeActions ? (
            <div className="mt-2 flex gap-2">
              <Skeleton.Button size="sm" w="w-14" />
              <Skeleton.Button size="sm" w="w-16" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChartSection({ titleWidth }: { titleWidth: string }) {
  return (
    <section className="border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Skeleton.Text variant="h3" w={titleWidth} />
        <Skeleton.Pill w="w-20" />
      </div>
      <Skeleton.Block h="h-56" r="xl" />
    </section>
  );
}
