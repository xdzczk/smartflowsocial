/**
 * Loading-state placeholder for the Admin Analytics page.
 * Co-located with the admin analytics page (route file).
 */
import {
  SkeletonChartSection,
  SkeletonPageTitle,
  SkeletonStatGrid,
} from "~/components/skeletons/page-helpers";

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
