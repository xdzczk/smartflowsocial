import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo } from "react";

import {
  AdminChartCard,
  AdminLineChart,
  AdminPageHeader,
  AdminProofOfWorkSection,
  AdminSection,
  MetricCard,
} from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminAnalyticsPageData } from "~/features/admin/repositories/admin-analytics-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const preset = parseRangePreset(
    url.searchParams.get("range"),
    defaultRangeForAdminPath(url.pathname)
  );
  const data = await getAdminAnalyticsPageData(preset);
  return json(data);
}

function mergeSeriesForChart(
  a: Array<{ day: string; count: number }>,
  b: Array<{ day: string; count: number }>,
  keys: [string, string]
) {
  const days = new Set<string>();
  for (const row of a) days.add(row.day);
  for (const row of b) days.add(row.day);
  return [...days].sort().map((day) => ({
    day,
    [keys[0]]: a.find((r) => r.day === day)?.count ?? 0,
    [keys[1]]: b.find((r) => r.day === day)?.count ?? 0,
  }));
}

function mergeThreeSeries(
  a: Array<{ day: string; count: number }>,
  b: Array<{ day: string; count: number }>,
  c: Array<{ day: string; count: number }>,
  keys: [string, string, string]
) {
  const days = new Set<string>();
  for (const row of a) days.add(row.day);
  for (const row of b) days.add(row.day);
  for (const row of c) days.add(row.day);
  return [...days].sort().map((day) => ({
    day,
    [keys[0]]: a.find((r) => r.day === day)?.count ?? 0,
    [keys[1]]: b.find((r) => r.day === day)?.count ?? 0,
    [keys[2]]: c.find((r) => r.day === day)?.count ?? 0,
  }));
}

export default function AdminAnalyticsPage() {
  const raw = useLoaderData<typeof loader>();
  const { formatDate } = useFormattedDate();
  const formatChartDay = useMemo(
    () => (isoDay: string) =>
      formatDate(`${isoDay}T12:00:00.000Z`, {
        dateFormatOptions: { month: "short", day: "numeric" },
      }),
    [formatDate]
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminAnalyticsPageData>>;

  const growthData = mergeThreeSeries(
    d.series.newUsersPerDay,
    d.series.postsPublishedPerDay,
    d.series.referredSignupsPerDay,
    ["users", "posts", "referred"]
  );

  const publishingMixData = mergeSeriesForChart(
    d.series.subscriptionsStartedPerDay,
    d.series.postsPublishedPerDay,
    ["subscriptions", "posts"]
  );

  const deltas = d.deltas;

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Growth, publishing mix, adoption proxies, and shareable milestones."
        generatedAt={d.generatedAt}
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        <AdminSection
          eyebrow="Narrative"
          title="Key takeaways"
          description="Honest read on this range — low volume stays intentionally cautious."
        >
          <ul className="border-border bg-card/50 space-y-2 rounded-xl border p-4 text-sm">
            {d.takeaways.map((t) => (
              <li key={t} className="text-foreground/90 list-inside list-disc">
                {t}
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection eyebrow="Totals" title="Growth">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="New users"
              value={d.totals.newUsers}
              deltaPct={deltas?.newUsersPct ?? null}
              definition="Accounts created in the selected range."
            />
            <MetricCard
              title="Posts published"
              value={d.totals.postsPublished}
              deltaPct={deltas?.postsPublishedPct ?? null}
              definition="Short posts that reached PUBLISHED in the range."
            />
            <MetricCard
              title="Long-form published"
              value={d.totals.longFormPublished}
              deltaPct={deltas?.longFormPublishedPct ?? null}
            />
            <MetricCard
              title="Referred signups"
              value={d.totals.referredSignups}
              deltaPct={deltas?.referredSignupsPct ?? null}
              definition="Referral rows created in the range."
            />
          </div>
          <AdminChartCard
            className="mt-4"
            title="Daily growth mix"
            subtitle="New users, posts published, and referred signups by day (UTC)."
            empty={growthData.length === 0}
          >
            <AdminLineChart
              formatDayLabel={formatChartDay}
              data={growthData}
              series={[
                {
                  dataKey: "users",
                  name: "New users",
                  stroke: "hsl(var(--primary))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(142 70% 42%)",
                },
                {
                  dataKey: "referred",
                  name: "Referred signups",
                  stroke: "hsl(280 55% 52%)",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection
          eyebrow="Monetization"
          title="Publishing & subscriptions"
          description="Compare new subscription rows with short-post publish volume."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Active subscriptions (now)"
              value={d.totals.activeSubscriptions}
              definition="Current ACTIVE subscriptions — not range-scoped."
            />
            <MetricCard
              title="Subscriptions started (range)"
              value={d.series.subscriptionsStartedPerDay.reduce(
                (s, x) => s + x.count,
                0
              )}
              deltaPct={deltas?.subscriptionsStartedPct ?? null}
              definition="Subscription rows created in the selected window."
            />
          </div>
          <AdminChartCard
            className="mt-4"
            title="Subscriptions vs post volume"
            subtitle="Daily subscription starts and short-form publishes."
            empty={publishingMixData.length === 0}
          >
            <AdminLineChart
              formatDayLabel={formatChartDay}
              data={publishingMixData}
              series={[
                {
                  dataKey: "subscriptions",
                  name: "Subscriptions started",
                  stroke: "hsl(var(--primary))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(32 90% 48%)",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection eyebrow="Product" title="Feature adoption (range)">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Scheduled reposts"
              value={d.featureAdoption.scheduledReposts}
            />
            <MetricCard
              title="Scheduled quotes"
              value={d.featureAdoption.scheduledQuotes}
            />
            <MetricCard
              title="Thread segments"
              value={d.featureAdoption.threadSegments}
            />
            <MetricCard
              title="Posts with media"
              value={d.featureAdoption.postsWithMedia}
            />
            <MetricCard
              title="Giveaways (locked/paid)"
              value={d.featureAdoption.giveawaysLockedOrPaid}
            />
          </div>
        </AdminSection>

        <AdminSection eyebrow="Retention" title="Retention proxies">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Multi-day publishers"
              value={d.retention.publishersMultiDay}
              definition="Users who published on 2+ different days in this window."
            />
            <MetricCard
              title="Second-publish users"
              value={d.retention.secondPublishUsers}
              definition="Users with ≥2 published short posts (all time)."
            />
          </div>
        </AdminSection>

        <AdminProofOfWorkSection proofCard={d.proofCard} />
      </div>
    </div>
  );
}
