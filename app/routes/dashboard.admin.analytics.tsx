import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense, useMemo } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import {
  AdminAccessDenied,
  AdminAnalyticsPageSkeleton,
  AdminChartCard,
  AdminLineChart,
  AdminPageHeader,
  AdminProofOfWorkSection,
  AdminSection,
  MetricCard,
  useAdminCurrency,
} from "~/features/admin";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminAnalyticsPageData } from "~/features/admin/repositories/admin-analytics-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

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
  if (isRemixResourceRequest(request)) {
    return json(await getAdminAnalyticsPageData(preset));
  }
  return defer({
    analytics: getAdminAnalyticsPageData(preset),
  });
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

type AdminAnalyticsLoaderResult =
  | { error: string }
  | {
      analytics: Promise<Awaited<ReturnType<typeof getAdminAnalyticsPageData>>>;
    };

export default function AdminAnalyticsPage() {
  const raw = useLoaderData() as AdminAnalyticsLoaderResult;
  if ("error" in raw) {
    return <AdminAccessDenied />;
  }

  return (
    <Suspense fallback={<AdminAnalyticsPageSkeleton />}>
      <Await
        resolve={raw.analytics}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/admin/analytics" />
        }
      >
        {(loaded) => <AdminAnalyticsPageLoaded data={loaded} />}
      </Await>
    </Suspense>
  );
}

function AdminAnalyticsPageLoaded({
  data: d,
}: {
  data: Awaited<ReturnType<typeof getAdminAnalyticsPageData>>;
}) {
  const { formatDate, dateLocale } = useFormattedDate();
  const { unit, formatSats } = useAdminCurrency();
  const formatChartDay = useMemo(
    () => (isoDay: string) =>
      formatDate(`${isoDay}T12:00:00.000Z`, {
        dateFormatOptions: { month: "short", day: "numeric" },
      }),
    [formatDate]
  );

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
          id="narrative"
          eyebrow="Narrative"
          title="Insight summary"
          description="Rule-based read on this range — low volume stays intentionally cautious."
        >
          <ul className="border-border bg-surface space-y-2 rounded-xl border p-4 text-sm">
            {d.takeaways.map((t) => (
              <li key={t} className="text-text/90 list-inside list-disc">
                {t}
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection id="growth" eyebrow="Growth" title="Growth">
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
                  stroke: "hsl(var(--chart-1))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(var(--chart-5))",
                },
                {
                  dataKey: "referred",
                  name: "Referred signups",
                  stroke: "hsl(var(--chart-4))",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection
          id="monetization"
          eyebrow="Monetization"
          title="Business"
          description="Recurring revenue and paid subscription flow (approximations documented in metric registry)."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title={unit === "SATS" ? "MRR (sats)" : `MRR (${unit})`}
              value={formatSats(d.monetization.mrrSats, dateLocale)}
              definition="Sum of amountSats on active paid subscriptions (30-day periods)."
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "ARR run-rate (sats)"
                  : `ARR run-rate (${unit})`
              }
              value={formatSats(d.monetization.arrRunRateSats, dateLocale)}
              definition="MRR × 12 — run-rate, not recognized revenue."
            />
            <MetricCard
              title="Active paid subscribers"
              value={d.monetization.activePaidSubscribers}
            />
            <MetricCard
              title="Subscriptions started (range)"
              value={d.monetization.subscriptionsStartedInRange}
              deltaPct={deltas?.subscriptionsStartedPct ?? null}
            />
            <MetricCard
              title="Cancellations (range)"
              value={d.monetization.subscriptionsCanceledInRange}
              definition="Subscriptions moved to CANCELED in range (timestamp approximation)."
            />
            <MetricCard
              title="Net paid flow"
              value={d.monetization.netSubscriptionFlowInRange}
              definition="Starts minus cancellations in range."
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "ARPPU (sats, range payments)"
                  : `ARPPU (${unit}, range payments)`
              }
              value={
                d.monetization.arppuSatsInRange == null
                  ? "—"
                  : formatSats(d.monetization.arppuSatsInRange, dateLocale)
              }
              definition="Completed payment amount in range ÷ active paid subscribers."
              confidence={d.monetization.revenueConfidence}
            />
            <MetricCard
              title="Referral commission (range)"
              value={formatSats(
                d.monetization.referredRevenueSatsInRange,
                dateLocale
              )}
              definition="Sum of ReferralEarning.commissionSats with createdAt in range."
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "Payment total (sats, range)"
                  : `Payment total (${unit}, range)`
              }
              value={formatSats(
                d.monetization.totalPaymentSatsInRange,
                dateLocale
              )}
              definition="Completed Payment.amount in range."
            />
          </div>
          <AdminChartCard
            className="mt-4"
            title="Subscriptions vs post volume"
            subtitle="Daily subscription starts and short-form publishes."
            empty={publishingMixData.length === 0}
            emptyDescription="No subscription or publish days in this window."
            emptySuggestedRange="Try 30d or 90d for more subscription movement."
          >
            <AdminLineChart
              formatDayLabel={formatChartDay}
              data={publishingMixData}
              series={[
                {
                  dataKey: "subscriptions",
                  name: "Subscriptions started",
                  stroke: "hsl(var(--chart-1))",
                },
                {
                  dataKey: "posts",
                  name: "Posts published",
                  stroke: "hsl(var(--chart-5))",
                },
              ]}
            />
          </AdminChartCard>
        </AdminSection>

        <AdminSection
          id="product-usage"
          eyebrow="Product usage"
          title="Sessions"
          description="Distinct users with dashboard session beacons — not auth sessions."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active session users (range)"
              value={d.productUsage.activeSessionUsersInRange}
              confidence={d.productUsage.activeUsersConfidence}
            />
            <MetricCard
              title="DAU (rolling)"
              value={d.productUsage.dauRolling}
            />
            <MetricCard
              title="WAU (rolling)"
              value={d.productUsage.wauRolling}
            />
            <MetricCard
              title="MAU (rolling)"
              value={d.productUsage.mauRolling}
            />
          </div>
        </AdminSection>

        <AdminSection
          id="publishing-reliability"
          eyebrow="Publishing"
          title="Reliability"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Publish success (range)"
              value={`${d.publishingReliability.publishSuccessRateInRange}%`}
              definition="Published ÷ (published + failed) with activity timestamps in range."
            />
            <MetricCard
              title="Failed short (range)"
              value={d.publishingReliability.failedShortInRange}
            />
            <MetricCard
              title="Failed long-form (range)"
              value={d.publishingReliability.failedLongInRange}
            />
            <MetricCard
              title="30d success % (context)"
              value={`${d.proofOfWork.publishSuccessRate30d}%`}
              definition="Separate rolling 30-day short-post success rate for context."
            />
          </div>
        </AdminSection>

        <AdminSection
          id="signer-connect"
          eyebrow="Signer"
          title="Remote signer vs extension"
          description="NIP-46 profile counts are a proxy for remote signer preference. Reconnect stats are background NIP-46 retries only."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Enabled users"
              value={d.signerConnect.enabledUsers}
            />
            <MetricCard
              title="NIP-46 profile saved"
              value={d.signerConnect.usersWithNip46Profile}
            />
            <MetricCard
              title="Extension / unset (proxy)"
              value={d.signerConnect.usersExtensionOrUnset}
            />
            <MetricCard
              title="Reconnect attempts (range)"
              value={d.signerConnect.reconnectAttemptsInRange}
            />
            <MetricCard
              title="Reconnect failures (range)"
              value={d.signerConnect.reconnectFailuresInRange}
            />
            <MetricCard
              title="Users with ≥1 failure"
              value={d.signerConnect.distinctUsersWithFailureInRange}
            />
          </div>
          {d.signerConnect.failuresByBucket.length > 0 ? (
            <ul className="text-text-secondary mt-3 text-xs">
              {d.signerConnect.failuresByBucket.map((b) => (
                <li key={b.bucket}>
                  <span className="font-mono">{b.bucket}</span>: {b.count}
                </li>
              ))}
            </ul>
          ) : null}
        </AdminSection>

        <AdminSection
          id="feature-adoption"
          eyebrow="Product"
          title="Feature adoption (range)"
        >
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

        <AdminSection
          id="retention"
          eyebrow="Retention"
          title="Retention proxies"
        >
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
